"""
Invoice text extraction.

Strategy (reliable first, OCR fallback):
  1. PDF with a text layer  -> extract text directly with PyMuPDF (exact, fast).
  2. Scanned PDF / image     -> OCR with Tesseract (only if it is installed).

This module returns the raw text and a short note about *how* it was
extracted. It deliberately does NOT parse fields yet (invoice number,
amounts, etc.) — that structured step comes later. Getting reliable raw
text first is the foundation everything else builds on.
"""

import os
import shutil

class ExtractionError(Exception):
    """Raised when text cannot be extracted from a document."""


# Minimum characters for a PDF page's text layer to count as "real text".
# Below this we assume the PDF is scanned and fall back to OCR.
_MIN_TEXT_LAYER_CHARS = 20


def _ocr_available() -> bool:
    """True only if both pytesseract (Python) and the tesseract binary exist."""
    if shutil.which("tesseract") is None:
        return False
    try:
        import pytesseract  # noqa: F401
    except ImportError:
        return False
    return True


def _extract_pdf_text_layer(path: str) -> str:
    """Pull the embedded text layer from a PDF. Empty string if none."""
    import pymupdf

    parts = []
    with pymupdf.open(path) as doc:
        for page in doc:
            parts.append(page.get_text())
    return "\n".join(parts).strip()


def _ocr_pdf(path: str) -> str:
    """Rasterize each PDF page and OCR it. Requires tesseract."""
    import pymupdf
    import pytesseract
    from PIL import Image
    import io

    texts = []
    with pymupdf.open(path) as doc:
        for page in doc:
            pix = page.get_pixmap(dpi=200)
            img = Image.open(io.BytesIO(pix.tobytes("png")))
            texts.append(pytesseract.image_to_string(img))
    return "\n".join(texts).strip()


def _ocr_image(path: str) -> str:
    """OCR a single image file. Requires tesseract."""
    import pytesseract
    from PIL import Image

    with Image.open(path) as img:
        return pytesseract.image_to_string(img).strip()


def extract_text(path: str) -> tuple[str, str]:
    """
    Extract raw text from an invoice document.

    Returns (raw_text, method) where method describes how it was obtained,
    e.g. "pdf_text_layer", "pdf_ocr", "image_ocr".

    Raises ExtractionError if the file is missing, the type is unsupported,
    or OCR is needed but not installed.
    """
    if not path or not os.path.exists(path):
        raise ExtractionError("Document file not found on disk")

    ext = os.path.splitext(path)[1].lower()

    if ext == ".pdf":
        text = _extract_pdf_text_layer(path)
        if len(text) >= _MIN_TEXT_LAYER_CHARS:
            return text, "pdf_text_layer"

        # Little or no text layer -> looks scanned. Try OCR if available.
        if _ocr_available():
            ocr_text = _ocr_pdf(path)
            if ocr_text:
                return ocr_text, "pdf_ocr"
            raise ExtractionError("PDF produced no text via OCR")
        raise ExtractionError(
            "PDF has no extractable text layer and OCR (tesseract) "
            "is not installed"
        )

    if ext in (".png", ".jpg", ".jpeg"):
        if not _ocr_available():
            raise ExtractionError(
                "Image files require OCR (tesseract), which is not installed"
            )
        text = _ocr_image(path)
        if not text:
            raise ExtractionError("Image produced no text via OCR")
        return text, "image_ocr"

    raise ExtractionError(f"Unsupported file type for extraction: {ext}")
