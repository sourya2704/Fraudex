"""
Production entry point: one server for the API and the built frontend.

    uvicorn app.serve:app

The API (app.main) is mounted under /api and the React build (STATIC_DIR,
default ./static) is served everywhere else, so the site and the API share
one origin: no CORS, and the login cookie stays first-party. Development
still runs app.main and Vite separately.

On start it can also create the first admin (ADMIN_EMAIL / ADMIN_PASSWORD)
and fill an empty database with demo invoices (SEED_DEMO_DATA=true).
"""

import os

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.main import app as api
from app.database.connection import SessionLocal

STATIC_DIR = os.path.abspath(os.getenv("STATIC_DIR", "static"))


def _ensure_admin():
    email, password = os.getenv("ADMIN_EMAIL"), os.getenv("ADMIN_PASSWORD")
    if not email or not password:
        return
    from app.core.security import hash_password
    from app.models.user import User

    db = SessionLocal()
    try:
        # Only creates; never resets a password someone changed in the app.
        if db.query(User).filter(User.email == email).first() is None:
            db.add(User(name="Admin", email=email, password_hash=hash_password(password), role="ADMIN"))
            db.commit()
            print(f"[startup] created admin {email}")
    finally:
        db.close()


def _seed_demo_data():
    if os.getenv("SEED_DEMO_DATA", "").lower() != "true":
        return
    from app.models.invoice import Invoice

    db = SessionLocal()
    try:
        empty = db.query(Invoice.id).first() is None
    finally:
        db.close()
    if empty:
        import importlib.util
        path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "scripts", "seed_demo_invoices.py")
        spec = importlib.util.spec_from_file_location("seed_demo_invoices", path)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        module.seed()
        print("[startup] seeded demo invoices; run 'Check all' on the Invoices page to fraud-check them")


_ensure_admin()
_seed_demo_data()

app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
app.mount("/api", api)


@app.get("/health", include_in_schema=False)
def health():
    return {"status": "ok"}


if os.path.isdir(STATIC_DIR):
    app.mount("/assets", StaticFiles(directory=os.path.join(STATIC_DIR, "assets")), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str):
        # Real files (favicon, images in public/) as they are; every other
        # path is a React route, so it gets index.html.
        file = os.path.abspath(os.path.join(STATIC_DIR, path))
        if path and file.startswith(STATIC_DIR + os.sep) and os.path.isfile(file):
            return FileResponse(file)
        return FileResponse(os.path.join(STATIC_DIR, "index.html"))
