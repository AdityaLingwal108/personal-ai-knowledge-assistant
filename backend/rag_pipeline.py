import json
from pathlib import Path
from typing import List, Dict

from document_loader import load_document, chunk_text
from embedding_service import EmbeddingService
from model_interface import CortexModel


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

    def add_document(self, filepath: str, filename: str) -> int:
        text = load_document(filepath)
        text_chunks = chunk_text(text)

        if not text_chunks:
            raise ValueError(
                f"No usable text chunks could be extracted from '{filename}'. "
                "The file may be empty or contain only images."
            )

        embeddings = self.embedding_service.embed(text_chunks)

        # Incremental add — never rebuild index on upload
        self.embedding_service.add_to_index(self.index, embeddings)

        base_id = len(self.chunks)
        for i, chunk_text_item in enumerate(text_chunks):
            self.chunks.append(
                {"id": base_id + i, "text": chunk_text_item, "source": filename}
            )

        self._save()
        return len(text_chunks)

    def delete_document(self, filename: str) -> None:
        self.chunks = [c for c in self.chunks if c["source"] != filename]

        # Rebuild index from remaining chunks (required after deletion)
        self.index = self.embedding_service.create_index(self.dim)
        if self.chunks:
            texts = [c["text"] for c in self.chunks]
            embeddings = self.embedding_service.embed(texts)
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
