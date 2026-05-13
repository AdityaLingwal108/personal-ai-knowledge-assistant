import asyncio
import logging
import time
import shutil
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import BackgroundTasks, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from starlette.concurrency import run_in_threadpool

from rag_pipeline import RAGPipeline

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Directory setup — runs before anything else
# ---------------------------------------------------------------------------
BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / "data"
DOCS_DIR = DATA_DIR / "documents"
DATA_DIR.mkdir(exist_ok=True)
DOCS_DIR.mkdir(exist_ok=True)

# ---------------------------------------------------------------------------
# App + CORS
# ---------------------------------------------------------------------------
app = FastAPI(title="Cortex", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://mycortexapp.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Shared RAGPipeline instance (module-level — shared across all requests)
# ---------------------------------------------------------------------------
pipeline = RAGPipeline(data_dir=str(DATA_DIR))

# Force the ONNX session to compile now, before the first real request.
# fastembed lazily initializes on first embed call (~5-10s); doing it here
# moves that cost off the user's first upload.
try:
    pipeline.embedding_service.embed(["warmup"])
    logger.info("Embedding model warmed up")
except Exception as e:
    logger.warning(f"Embedding warmup skipped: {e}")

# ---------------------------------------------------------------------------
# Background processing state
#   processing_status[filename] = {
#       "status": "processing" | "ready" | "error",
#       "stage":  "parsing" | "embedding" | "saving" | "done" | "error",
#       "progress": float in [0, 1],
#       "started_at": epoch seconds,
#       "error": optional str,
#   }
# ---------------------------------------------------------------------------
processing_status: Dict[str, Dict[str, Any]] = {}
_processing_lock = asyncio.Lock()  # one document at a time to protect FAISS index

UPLOAD_CHUNK = 1024 * 1024  # 1 MiB
ALLOWED_EXTENSIONS = {".pdf", ".txt", ".docx", ".doc"}


def _set_status(filename: str, **patch: Any) -> None:
    entry = processing_status.setdefault(filename, {})
    entry.update(patch)


async def _process_document(
    filename: str,
    save_path: Optional[Path] = None,
    text: Optional[str] = None,
) -> None:
    async with _processing_lock:
        loop = asyncio.get_running_loop()

        def progress_cb(stage: str, frac: float) -> None:
            # Called from worker thread — schedule the update on the event loop.
            loop.call_soon_threadsafe(
                _set_status, filename, stage=stage, progress=frac
            )

        try:
            _set_status(
                filename,
                status="processing",
                stage="parsing",
                progress=0.0,
                started_at=time.time(),
            )
            await run_in_threadpool(
                pipeline.add_document,
                str(save_path) if save_path else None,
                filename,
                progress_cb,
                text,
            )
            _set_status(filename, status="ready", stage="done", progress=1.0)
            logger.info(f"Processing complete: {filename}")
        except Exception as e:
            logger.error(f"Processing failed for {filename}: {e}", exc_info=True)
            if save_path is not None:
                save_path.unlink(missing_ok=True)
            _set_status(
                filename, status="error", stage="error", error=str(e)
            )


# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------


class ChatRequest(BaseModel):
    query: str
    history: List[dict] = []
    top_k: int = 5
    api_key: str = ""


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@app.get("/api/health")
async def health():
    docs = pipeline.get_documents()
    return {
        "status": "ok",
        "doc_count": len(docs),
        "chunk_count": len(pipeline.chunks),
    }


@app.post("/api/documents/upload")
async def upload_document(
    file: UploadFile = File(...),
    background_tasks: BackgroundTasks = BackgroundTasks(),
):
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Unsupported file type '{ext}'. "
                f"Allowed types: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
            ),
        )

    save_path = DOCS_DIR / file.filename

    if file.filename in pipeline.get_documents():
        pipeline.delete_document(file.filename)

    # Stream to disk without blocking the event loop
    try:
        def save_to_disk():
            with open(save_path, "wb") as f:
                shutil.copyfileobj(file.file, f)
        
        await run_in_threadpool(save_to_disk)
        logger.info(f"Saved {file.filename}")
    except Exception as e:
        save_path.unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail=f"Failed to save file: {e}")

    _set_status(
        file.filename,
        status="processing",
        stage="queued",
        progress=0.0,
        started_at=time.time(),
        error=None,
    )
    background_tasks.add_task(
        _process_document, file.filename, save_path, None
    )

    return {"filename": file.filename, "status": "processing"}


class UploadTextRequest(BaseModel):
    filename: str
    text: str


@app.post("/api/documents/upload-text")
async def upload_text(
    payload: UploadTextRequest,
    background_tasks: BackgroundTasks = BackgroundTasks(),
):
    """Accept pre-extracted text (e.g., from client-side PDF.js).

    Much faster path than uploading binary: skips network transfer of the raw
    file and server-side parsing entirely.
    """
    filename = payload.filename.strip()
    text = payload.text
    if not filename:
        raise HTTPException(status_code=400, detail="filename is required")
    if not text or not text.strip():
        raise HTTPException(
            status_code=400,
            detail="No text extracted from the document. It may be encrypted or image-only.",
        )

    ext = Path(filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Unsupported file type '{ext}'. "
                f"Allowed types: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
            ),
        )

    if filename in pipeline.get_documents():
        pipeline.delete_document(filename)

    _set_status(
        filename,
        status="processing",
        stage="queued",
        progress=0.0,
        started_at=time.time(),
        error=None,
    )
    background_tasks.add_task(_process_document, filename, None, text)

    return {"filename": filename, "status": "processing"}


def filename_size_log(name: str, n: int) -> str:
    if n < 1024:
        size = f"{n} B"
    elif n < 1024 * 1024:
        size = f"{n / 1024:.1f} KB"
    else:
        size = f"{n / (1024 * 1024):.1f} MB"
    return f"{name} ({size})"


@app.get("/api/documents/{filename}/status")
async def get_document_status(filename: str):
    entry = processing_status.get(filename)
    if entry is None:
        # Not tracked — check if it's actually in the index (persisted from before restart).
        if filename in pipeline.get_documents():
            return {
                "filename": filename,
                "status": "ready",
                "stage": "done",
                "progress": 1.0,
            }
        return {
            "filename": filename,
            "status": "error",
            "stage": "error",
            "progress": 0.0,
            "error": "Unknown document",
        }
    return {"filename": filename, **entry}


@app.get("/api/documents")
async def get_documents():
    counts = pipeline.get_chunk_count_per_document()
    documents = [
        {"filename": fn, "chunk_count": cnt}
        for fn, cnt in sorted(counts.items())
    ]
    return {"documents": documents}


@app.delete("/api/documents/{filename}")
async def delete_document(filename: str):
    if filename not in pipeline.get_documents():
        raise HTTPException(
            status_code=404, detail=f"Document '{filename}' not found in index."
        )

    try:
        pipeline.delete_document(filename)
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to delete document from index: {e}"
        )

    file_path = DOCS_DIR / filename
    if file_path.exists():
        file_path.unlink()

    processing_status.pop(filename, None)
    return {"deleted": filename}


@app.post("/api/chat")
async def chat(request: ChatRequest):
    if not request.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty.")

    if not pipeline.get_documents():
        raise HTTPException(
            status_code=400,
            detail="No documents are indexed. Please upload at least one document first.",
        )

    if not request.api_key.strip():
        raise HTTPException(
            status_code=400,
            detail="Groq API key is required. Enter your key in Settings (gear icon).",
        )

    try:
        result = pipeline.generate_response(
            query=request.query,
            history=request.history,
            top_k=request.top_k,
            api_key=request.api_key,
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Chat error: {type(e).__name__}: {e}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"Failed to generate response: {e}"
        )


@app.delete("/api/chat")
async def clear_chat():
    return {"status": "cleared"}
