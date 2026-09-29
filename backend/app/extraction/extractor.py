import os
import shutil

import pymupdf


class ExtractionError(Exception):
    pass


_MIN_TEXT_LAYER_CHARS = 20


def _ocr_available() -> bool:
    if shutil.which("tesseract") is None:
        return False
    try:
        import pytesseract
    except ImportError:
        return False
    return True


def _extract_pdf_text_layer(path: str) -> str:
    parts = []
    with pymupdf.open(path) as doc:
        for page in doc:
            parts.append(page.get_text())
    return "\n".join(parts).strip()


def _ocr_pdf(path: str) -> str:
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
    import pytesseract
    from PIL import Image

    with Image.open(path) as img:
        return pytesseract.image_to_string(img).strip()


def extract_text(path: str) -> tuple[str, str]:
    if not path or not os.path.exists(path):
        raise ExtractionError("Document file not found on disk")

    ext = os.path.splitext(path)[1].lower()

    if ext == ".pdf":
        text = _extract_pdf_text_layer(path)
        if len(text) >= _MIN_TEXT_LAYER_CHARS:
            return text, "pdf_text_layer"


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
