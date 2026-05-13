import logging
from pathlib import Path
from typing import List

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

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
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Shared RAGPipeline instance (module-level — shared across all requests)
# ---------------------------------------------------------------------------
pipeline = RAGPipeline(data_dir=str(DATA_DIR))

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
async def upload_document(file: UploadFile = File(...)):
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

    # If document already indexed, remove old entries so re-upload refreshes it
    if file.filename in pipeline.get_documents():
        pipeline.delete_document(file.filename)

    try:
        content = await file.read()
        with open(save_path, "wb") as f:
            f.write(content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {e}")

    try:
        chunks_added = pipeline.add_document(str(save_path), file.filename)
    except Exception as e:
        save_path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=500, detail=f"Failed to process document: {e}"
        )

    return {"filename": file.filename, "chunks_added": chunks_added}


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
    # History is owned by the frontend; this endpoint is a no-op hook
    return {"status": "cleared"}
