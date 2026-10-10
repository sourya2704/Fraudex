from functools import lru_cache
from langchain_ollama import OllamaEmbeddings
from app.rag.config import OLLAMA_BASE_URL, OLLAMA_EMBED_MODEL


@lru_cache(maxsize=1)
def get_embedder() -> OllamaEmbeddings:
    return OllamaEmbeddings(
        base_url=OLLAMA_BASE_URL,
        model=OLLAMA_EMBED_MODEL,
    )


def embed_text(text: str) -> list[float]:
    return get_embedder().embed_query(text)


def embed_texts(texts: list[str]) -> list[list[float]]:
    return get_embedder().embed_documents(texts)
