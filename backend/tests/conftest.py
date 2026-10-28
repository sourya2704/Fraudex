import os
import sys
import tempfile

# Isolated SQLite database for tests; must be set before app imports.
os.environ["DATABASE_URL"] = f"sqlite:///{os.path.join(tempfile.mkdtemp(), 'test.db')}"
os.environ.setdefault("JWT_SECRET_KEY", "test-secret")
os.environ["RAG_EMBEDDER"] = "local"  # never wait on Ollama in tests
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest  # noqa: E402

from app.database.connection import Base, SessionLocal, engine  # noqa: E402
import app.main  # noqa: E402,F401  (registers every model)


@pytest.fixture
def db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
