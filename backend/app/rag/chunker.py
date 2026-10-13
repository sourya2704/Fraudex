from langchain_text_splitters import RecursiveCharacterTextSplitter
from app.rag.config import RAG_CHUNK_SIZE, RAG_CHUNK_OVERLAP


def chunk_text(text: str) -> list[str]:
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=RAG_CHUNK_SIZE,
        chunk_overlap=RAG_CHUNK_OVERLAP,
        separators=["\n\n", "\n", ". ", " ", ""],
    )
    return splitter.split_text(text)
