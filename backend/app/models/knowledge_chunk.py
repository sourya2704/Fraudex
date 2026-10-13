from sqlalchemy import Column, DateTime, Integer, String, Text, JSON
from sqlalchemy.sql import func
from app.database.connection import Base


class KnowledgeChunk(Base):
    __tablename__ = "knowledge_chunks"

    id = Column(Integer, primary_key=True, index=True)
    document_name = Column(String(255), nullable=False, index=True)
    source_type = Column(String(50), nullable=False, default="policy")
    chunk_text = Column(Text, nullable=False)
    embedding = Column(JSON, nullable=True)   # stored as float list — works without pgvector extension
    created_at = Column(DateTime(timezone=True), server_default=func.now())
