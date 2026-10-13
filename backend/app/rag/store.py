from typing import Optional
import numpy as np
from sqlalchemy.orm import Session
from app.models.knowledge_chunk import KnowledgeChunk
from app.rag.embeddings import embed_text, embed_texts
from app.rag.chunker import chunk_text
from app.rag.config import RAG_TOP_K


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    """Pure numpy cosine similarity — no pgvector extension needed."""
    va, vb = np.array(a, dtype=np.float32), np.array(b, dtype=np.float32)
    denom = np.linalg.norm(va) * np.linalg.norm(vb)
    if denom == 0:
        return 0.0
    return float(np.dot(va, vb) / denom)


class RAGStore:
    def __init__(self, db: Session):
        self.db = db

    def add_document(
        self,
        document_name: str,
        content: str,
        source_type: str = "policy",
    ) -> int:
        self.db.query(KnowledgeChunk).filter(
            KnowledgeChunk.document_name == document_name
        ).delete()

        chunks = chunk_text(content)
        if not chunks:
            return 0

        embeddings = embed_texts(chunks)

        for chunk_text_val, embedding in zip(chunks, embeddings):
            chunk = KnowledgeChunk(
                document_name=document_name,
                source_type=source_type,
                chunk_text=chunk_text_val,
                embedding=embedding,   # list[float] stored as JSON
            )
            self.db.add(chunk)

        self.db.commit()
        return len(chunks)

    def search(
        self,
        query: str,
        top_k: int = RAG_TOP_K,
        source_type: Optional[str] = None,
    ) -> list[dict]:
        query_embedding = embed_text(query)

        base_query = self.db.query(KnowledgeChunk)
        if source_type:
            base_query = base_query.filter(
                KnowledgeChunk.source_type == source_type
            )

        all_chunks = base_query.all()

        if not all_chunks:
            return []

        # Python-side cosine similarity (no pgvector SQL extension needed)
        scored = []
        for chunk in all_chunks:
            if chunk.embedding:
                sim = _cosine_similarity(query_embedding, chunk.embedding)
                scored.append((sim, chunk))

        scored.sort(key=lambda x: x[0], reverse=True)
        top = scored[:top_k]

        return [
            {
                "id": r.id,
                "document_name": r.document_name,
                "source_type": r.source_type,
                "chunk_text": r.chunk_text,
                "similarity": round(sim, 4),
            }
            for sim, r in top
        ]

    def list_documents(self) -> list[dict]:
        rows = (
            self.db.query(
                KnowledgeChunk.document_name,
                KnowledgeChunk.source_type,
            )
            .distinct()
            .all()
        )
        return [
            {"document_name": r.document_name, "source_type": r.source_type}
            for r in rows
        ]

    def delete_document(self, document_name: str) -> int:
        deleted = (
            self.db.query(KnowledgeChunk)
            .filter(KnowledgeChunk.document_name == document_name)
            .delete()
        )
        self.db.commit()
        return deleted
