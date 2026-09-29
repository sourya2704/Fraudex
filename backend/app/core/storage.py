import os
import uuid


BASE_DIR = os.path.dirname(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
)

STORAGE_DIR = os.path.join(BASE_DIR, "storage", "invoices")


ALLOWED_EXTENSIONS = {
    ".pdf": {"application/pdf"},
    ".png": {"image/png"},
    ".jpg": {"image/jpeg"},
    ".jpeg": {"image/jpeg"},
}

MAX_FILE_SIZE = 10 * 1024 * 1024


def ensure_storage_dir() -> None:
    os.makedirs(STORAGE_DIR, exist_ok=True)


def build_stored_path(original_filename: str) -> tuple[str, str]:
    ext = os.path.splitext(original_filename or "")[1].lower()
    stored_name = f"{uuid.uuid4().hex}{ext}"
    return os.path.join(STORAGE_DIR, stored_name), ext
