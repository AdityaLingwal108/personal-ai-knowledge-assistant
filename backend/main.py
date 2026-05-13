import asyncio
import logging
from pathlib import Path
from typing import Dict, List

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

# ---------------------------------------------------------------------------
# Background processing state
# ---------------------------------------------------------------------------
processing_status: Dict[str, str] = {}  # filename -> "processing" | "ready" | "error"
_processing_lock = asyncio.Lock()  # one document at a time to protect FAISS index


async def _process_document(save_path: Path, filename: str) -> None:
    async with _processing_lock:
        try:
            await run_in_threadpool(pipeline.add_document, str(save_path), filename)
            processing_status[filename] = "ready"
            logger.info(f"Processing complete: {filename}")
        except Exception as e:
            logger.error(f"Processing failed for {filename}: {e}", exc_info=True)
            save_path.unlink(missing_ok=True)
            processing_status[filename] = "error"


# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------
ALLOWED_EXTENSIONS = {".pdf", ".txt", ".docx", ".doc"}


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
async def upload_document(file: UploadFile = File(...), background_tasks: BackgroundTasks = BackgroundTasks()):
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

    try:
        content = await file.read()
        with open(save_path, "wb") as f:
            f.write(content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {e}")

    processing_status[file.filename] = "processing"
    background_tasks.add_task(_process_document, save_path, file.filename)

    return {"filename": file.filename, "status": "processing"}


@app.get("/api/documents/{filename}/status")
async def get_document_status(filename: str):
    status = processing_status.get(filename)
    if status is None:
        # Not tracked — check if it's actually in the index (e.g. persisted from before restart)
        status = "ready" if filename in pipeline.get_documents() else "error"
    return {"filename": filename, "status": status}


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
