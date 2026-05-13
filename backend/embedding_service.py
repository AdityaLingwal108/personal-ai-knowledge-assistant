import numpy as np
import faiss
from fastembed import TextEmbedding
from typing import List, Tuple


class EmbeddingService:
    def __init__(self):
        self.model = TextEmbedding("sentence-transformers/all-MiniLM-L6-v2")
        self.dim = 384

    def embed(self, texts: List[str]) -> np.ndarray:
        embeddings = list(self.model.embed(texts))
        return np.array(embeddings, dtype=np.float32)

    def create_index(self, dim: int) -> faiss.IndexFlatIP:
        return faiss.IndexFlatIP(dim)

    def add_to_index(self, index: faiss.Index, embeddings: np.ndarray) -> None:
        index.add(embeddings)

    def search(
        self, query: str, index: faiss.Index, top_k: int
    ) -> List[Tuple[int, float]]:
        query_vec = self.embed([query])
        scores, indices = index.search(query_vec, top_k)
        results = []
        for idx, score in zip(indices[0], scores[0]):
            if idx >= 0:
                results.append((int(idx), float(score)))
        return results

    def save_index(self, index: faiss.Index, path: str) -> None:
        faiss.write_index(index, path)

    def load_index(self, path: str) -> faiss.Index:
        return faiss.read_index(path)
