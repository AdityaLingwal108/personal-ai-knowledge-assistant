import json
import logging
from pathlib import Path
from typing import Callable, Dict, List, Optional

import numpy as np

from document_loader import load_document, chunk_text
from embedding_service import EmbeddingService
from model_interface import CortexModel

logger = logging.getLogger(__name__)

# How many embeddings to buffer before flushing to FAISS.
# Larger = fewer Python<->C++ hops; smaller = lower peak RAM.
FAISS_FLUSH_SIZE = 256


class RAGPipeline:
    def __init__(self, data_dir: str = "data"):
        self.data_dir = Path(data_dir)
        self.index_path = self.data_dir / "faiss.index"
        self.chunks_path = self.data_dir / "chunks.json"

        self.embedding_service = EmbeddingService()
        self.model = CortexModel()
        self.dim = 384  # all-MiniLM-L6-v2 output dimension

        self._load_or_init()

    # ------------------------------------------------------------------
    # Persistence
    # ------------------------------------------------------------------

    def _load_or_init(self) -> None:
        if self.index_path.exists() and self.chunks_path.exists():
            self.index = self.embedding_service.load_index(str(self.index_path))
            with open(self.chunks_path, "r", encoding="utf-8") as f:
                self.chunks: List[Dict] = json.load(f)
        else:
            self.index = self.embedding_service.create_index(self.dim)
            self.chunks = []

    def _save(self) -> None:
        self.embedding_service.save_index(self.index, str(self.index_path))
        with open(self.chunks_path, "w", encoding="utf-8") as f:
            json.dump(self.chunks, f, ensure_ascii=False, indent=2)

    # ------------------------------------------------------------------
    # Document management
    # ------------------------------------------------------------------

    def add_document(
        self,
        filepath: Optional[str],
        filename: str,
        progress_cb: Optional[Callable[[str, float], None]] = None,
        text: Optional[str] = None,
    ) -> int:
        """Parse, chunk, embed, and index a document.

        Either ``filepath`` (server-side parsing) or ``text`` (pre-extracted)
        must be provided. progress_cb(stage, fraction) is called with stage in
        {"parsing", "embedding", "saving"} and fraction in [0, 1].
        """
        def report(stage: str, frac: float) -> None:
            if progress_cb is not None:
                try:
                    progress_cb(stage, max(0.0, min(1.0, frac)))
                except Exception:
                    pass

        report("parsing", 0.0)
        if text is None:
            if not filepath:
                raise ValueError("add_document requires either filepath or text")
            text = load_document(filepath)
        text_chunks = chunk_text(text)
        report("parsing", 1.0)

        if not text_chunks:
            raise ValueError(
                f"No usable text chunks could be extracted from '{filename}'. "
                "The file may be empty or contain only images."
            )

        total = len(text_chunks)
        logger.info(f"[{filename}] embedding {total} chunks")
        base_id = len(self.chunks)

        buffer: List[np.ndarray] = []
        produced = 0

        def flush() -> None:
            if not buffer:
                return
            arr = np.array(buffer, dtype=np.float32)
            self.embedding_service.add_to_index(self.index, arr)
            buffer.clear()

        # batch_size=32 keeps peak RAM low enough for Render free tier (512 MB).
        for emb in self.embedding_service.embed_stream(text_chunks, batch_size=32):
            buffer.append(emb)
            self.chunks.append(
                {
                    "id": base_id + produced,
                    "text": text_chunks[produced],
                    "source": filename,
                }
            )
            produced += 1

            if len(buffer) >= FAISS_FLUSH_SIZE:
                flush()
                report("embedding", produced / total)

        flush()
        report("embedding", 1.0)

        report("saving", 0.0)
        self._save()
        report("saving", 1.0)
        return total

    def delete_document(self, filename: str) -> None:
        self.chunks = [c for c in self.chunks if c["source"] != filename]

        # Rebuild index from remaining chunks (required after deletion)
        self.index = self.embedding_service.create_index(self.dim)
        if self.chunks:
            texts = [c["text"] for c in self.chunks]
            embeddings = self.embedding_service.embed(texts, batch_size=32)
            self.embedding_service.add_to_index(self.index, embeddings)

        # Re-assign sequential IDs
        for i, chunk in enumerate(self.chunks):
            chunk["id"] = i

        self._save()

    # ------------------------------------------------------------------
    # Retrieval & generation
    # ------------------------------------------------------------------

    def retrieve(self, query: str, top_k: int = 5) -> List[Dict]:
        if not self.chunks or self.index.ntotal == 0:
            return []

        results = self.embedding_service.search(query, self.index, top_k)
        retrieved = []
        for idx, score in results:
            if idx < len(self.chunks):
                chunk = self.chunks[idx]
                retrieved.append(
                    {"text": chunk["text"], "source": chunk["source"], "score": score}
                )
        return retrieved

    def generate_response(
        self,
        query: str,
        history: List[Dict],
        top_k: int,
        api_key: str,
    ) -> Dict:
        context = self.retrieve(query, top_k)
        response = self.model.generate(query, context, history, api_key)
        return {"response": response, "context": context, "query": query}

    # ------------------------------------------------------------------
    # Introspection
    # ------------------------------------------------------------------

    def get_documents(self) -> List[str]:
        return sorted({c["source"] for c in self.chunks})

    def get_chunk_count_per_document(self) -> Dict[str, int]:
        counts: Dict[str, int] = {}
        for chunk in self.chunks:
            counts[chunk["source"]] = counts.get(chunk["source"], 0) + 1
        return counts
