"""
Local file storage for uploaded invoice documents.

Development uses the local filesystem under `backend/storage/invoices/`.
This module is the single place that knows *where* and *how* files are
stored, so it can later be swapped for S3 without touching the API layer.
"""

import os
import uuid

# backend/  (three levels up from app/core/storage.py)
BASE_DIR = os.path.dirname(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
)

STORAGE_DIR = os.path.join(BASE_DIR, "storage", "invoices")

# Allowed upload types: extension -> MIME type(s) we accept.
ALLOWED_EXTENSIONS = {
    ".pdf": {"application/pdf"},
    ".png": {"image/png"},
    ".jpg": {"image/jpeg"},
    ".jpeg": {"image/jpeg"},
}

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


def ensure_storage_dir() -> None:
    os.makedirs(STORAGE_DIR, exist_ok=True)


def build_stored_path(original_filename: str) -> tuple[str, str]:
    """
    Generate a safe, collision-free storage path for a new upload.

    Returns (absolute_path, extension). The stored name is a random UUID,
    so a user-supplied filename can never cause path traversal or overwrite
    another file.
    """
    ext = os.path.splitext(original_filename or "")[1].lower()
    stored_name = f"{uuid.uuid4().hex}{ext}"
    return os.path.join(STORAGE_DIR, stored_name), ext
