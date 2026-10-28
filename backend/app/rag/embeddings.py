"""
Text embeddings for the knowledge base.

Uses the Ollama embedding model when Ollama is running. When it is not (or
RAG_EMBEDDER=local), falls back to a local hashed bag-of-words embedding, so
policy search keeps working on a laptop without Ollama. The two kinds of
vector have different lengths (768 vs 1024), which is how the
store tells them apart: a query is always compared with vectors of its own
kind.
"""

import hashlib
import math
import re
import urllib.request
from functools import lru_cache

from app.rag.config import OLLAMA_BASE_URL, OLLAMA_EMBED_MODEL, RAG_EMBEDDER

LOCAL_DIMENSION = 1024

_STOPWORDS = frozenset(
    "a an and are as at be by for from has have if in into is it its of on or "
    "that the this to was were will with which than then so not no any all can "
    "may must should each per such these those use used when where who".split()
)


@lru_cache(maxsize=1)
def _ollama_embedder():
    from langchain_ollama import OllamaEmbeddings
    return OllamaEmbeddings(base_url=OLLAMA_BASE_URL, model=OLLAMA_EMBED_MODEL)


@lru_cache(maxsize=1)
def ollama_available() -> bool:
    """One quick check per process; a down Ollama otherwise costs a timeout per call."""
    if RAG_EMBEDDER == "local":
        return False
    try:
        with urllib.request.urlopen(f"{OLLAMA_BASE_URL}/api/tags", timeout=1.5) as r:
            return r.status == 200
    except Exception:
        return False


def _tokens(text: str) -> list[str]:
    words = [w for w in re.findall(r"[a-z0-9_]+", text.lower()) if w not in _STOPWORDS]
    # Flag codes such as INVALID_GST_RATE also count as their separate words.
    parts = [p for w in words if "_" in w for p in w.split("_") if p]
    return words + parts + [f"{a} {b}" for a, b in zip(words, words[1:])]


def _bucket(token: str) -> tuple[int, float]:
    h = hashlib.blake2b(token.encode(), digest_size=8).digest()
    n = int.from_bytes(h, "little")
    return n % LOCAL_DIMENSION, 1.0 if (n >> 40) & 1 else -1.0


def local_embed(text: str) -> list[float]:
    """Hashed bag of words and word pairs, log-scaled and L2-normalised."""
    counts: dict[str, int] = {}
    for t in _tokens(text):
        counts[t] = counts.get(t, 0) + 1
    vec = [0.0] * LOCAL_DIMENSION
    for t, c in counts.items():
        i, sign = _bucket(t)
        # A whole flag code (INVALID_GST_RATE) names exactly one rule; weight
        # it above common words such as "fraud" or "invoice".
        weight = 3.0 if "_" in t else 1.0
        vec[i] += sign * weight * (1.0 + math.log(c))
    norm = math.sqrt(sum(v * v for v in vec)) or 1.0
    return [v / norm for v in vec]


def embedder_name() -> str:
    return f"ollama:{OLLAMA_EMBED_MODEL}" if ollama_available() else "local-hashing"


# Ollama can be running without the embedding model pulled; fall back then too.

def embed_text(text: str) -> list[float]:
    if ollama_available():
        try:
            return _ollama_embedder().embed_query(text)
        except Exception as e:
            print(f"[embeddings] Ollama failed, using local embedding: {type(e).__name__}: {e}")
    return local_embed(text)


def embed_texts(texts: list[str]) -> list[list[float]]:
    if ollama_available():
        try:
            return _ollama_embedder().embed_documents(texts)
        except Exception as e:
            print(f"[embeddings] Ollama failed, using local embedding: {type(e).__name__}: {e}")
    return [local_embed(t) for t in texts]
