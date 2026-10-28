"""
Loads the built-in policy knowledge base (app/rag/default_policies.py).
Run: python scripts/seed_knowledge_base.py (re-running replaces the same documents).
Uses Ollama embeddings when Ollama is running, otherwise the local embedding.
"""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

from app.database.connection import SessionLocal
from app.rag.default_policies import load_default_policies
from app.rag.embeddings import embedder_name


def main():
    print(f"=== Seeding FrauDex Knowledge Base ({embedder_name()}) ===\n")
    db = SessionLocal()
    try:
        for name, count in load_default_policies(db).items():
            print(f"  {name}: {count} passages")
    finally:
        db.close()
    print("\n✓ Knowledge base seeded.")


if __name__ == "__main__":
    main()
