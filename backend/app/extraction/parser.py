"""
Deterministic parsing of raw invoice text into structured fields.
"""

import re
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Optional


_INVOICE_NUMBER_LABELS = [
    r"invoice\s*(?:no|number|num|#)",
    r"inv\s*(?:no|#)",
    r"bill\s*(?:no|number)",
]
_INVOICE_DATE_LABELS = [
    r"invoice\s*date",
    r"bill\s*date",
    r"date\s*of\s*issue",
    r"issued?\s*on",
    r"^date",
]
_DUE_DATE_LABELS = [
    r"due\s*date",
    r"payment\s*due",
    r"due\s*on",
]
_SUBTOTAL_LABELS = [
    r"sub\s*-?\s*total",
    r"net\s*amount",
    r"amount\s*before\s*tax",
    r"total\s*taxable\s*value",
    r"taxable\s*value",
    r"taxable\s*amount",
]
_TAX_LABELS = [
    r"total\s*(?:cgst|igst|sgst|utgst|cess)",
    r"total\s*gst",
    r"total\s*tax",
    r"gst\s*amount",
    r"tax\s*amount",
    r"vat",
    r"gst",
    r"tax",
]
_TOTAL_LABELS = [
    r"grand\s*total",
    r"total\s*amount\s*due",
    r"total\s*payable",
    r"invoice\s*total",
    r"total\s*invoice\s*value",
    r"total\s*invoice\s*amount",
    r"(?<!sub)(?<!sub[\-\s])total",
]

_CURRENCY_CODES = ["INR", "USD", "EUR", "GBP", "JPY", "AUD", "CAD"]
_CURRENCY_SYMBOLS = {
    "₹": "INR",
    "$": "USD",
    "€": "EUR",
    "£": "GBP",
    "Rs": "INR",
    "Rs.": "INR",
    "#": "INR",   # some Indian invoice generators use # instead of ₹
}

_NUMBER_RE = r"[-+]?\d+(?:,\d+)*(?:\.\d+)?"

_DATE_FORMATS = [
    "%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%m/%d/%Y",
    "%d.%m.%Y", "%Y/%m/%d", "%d %b %Y", "%d %B %Y",
    "%b %d, %Y", "%B %d, %Y",
    "%d-%b-%Y", "%d-%B-%Y",    # 29-Jul-2026
    "%d %b, %Y", "%d %B, %Y",  # 29 Jul, 2026
]


def _to_decimal(raw: str) -> Optional[Decimal]:
    if raw is None:
        return None
    cleaned = raw.replace(",", "").strip()
    try:
        return Decimal(cleaned)
    except (InvalidOperation, ValueError):
        return None


def _to_date(raw: str) -> Optional[date]:
    raw = raw.strip()
    for fmt in _DATE_FORMATS:
        try:
            return datetime.strptime(raw, fmt).date()
        except ValueError:
            continue
    return None


def _find_labeled_value(
    text: str,
    labels: list[str],
    value_pattern: str,
    prefer_last: bool = False,
) -> Optional[str]:
    """
    Find value after a label — same line OR immediately next line.
    """
    matches = []
    for label in labels:
        junk = r"(?:[:\-=]|\([^)]*\)|[$₹€£#]|Rs\.?|\s)*"
        # Same line match
        pattern = rf"{label}{junk}({value_pattern})"
        for match in re.finditer(pattern, text, flags=re.IGNORECASE | re.MULTILINE):
            matches.append(match.group(1).strip())
        # Next line match — label alone on its line, value on next
        pattern2 = rf"^[ \t]*{label}[ \t]*$\s*^[ \t]*({value_pattern})[ \t]*$"
        for match in re.finditer(pattern2, text, flags=re.IGNORECASE | re.MULTILINE):
            matches.append(match.group(1).strip())
    return matches[-1] if prefer_last and matches else (matches[0] if matches else None)


def parse_invoice_text(raw_text: str) -> dict:
    """
    Parse raw invoice text into structured fields.
    Returns dict with fields, found, missing.
    """
    text = raw_text or ""

    invoice_number = _find_labeled_value(
        text, _INVOICE_NUMBER_LABELS, r"[A-Za-z0-9\-\/]+"
    )

    invoice_date_raw = _find_labeled_value(
        text, _INVOICE_DATE_LABELS, r"[0-9A-Za-z ,\.\-\/]+"
    )
    due_date_raw = _find_labeled_value(
        text, _DUE_DATE_LABELS, r"[0-9A-Za-z ,\.\-\/]+"
    )

    subtotal_raw = _find_labeled_value(
        text, _SUBTOTAL_LABELS, _NUMBER_RE, prefer_last=True
    )

    # Tax: detect CGST + SGST separately and sum (Indian GST split)
    cgst_raw = _find_labeled_value(text, [r"total\s*cgst", r"cgst"], _NUMBER_RE, prefer_last=True)
    sgst_raw = _find_labeled_value(text, [r"total\s*sgst", r"total\s*utgst", r"sgst", r"utgst"], _NUMBER_RE, prefer_last=True)
    igst_raw = _find_labeled_value(text, [r"total\s*igst", r"igst"], _NUMBER_RE, prefer_last=True)

    cgst_val = _to_decimal(cgst_raw)
    sgst_val = _to_decimal(sgst_raw)
    igst_val = _to_decimal(igst_raw)

    if cgst_val is not None and sgst_val is not None:
        tax_decimal = cgst_val + sgst_val
        tax_raw = None
    elif igst_val is not None:
        tax_decimal = igst_val
        tax_raw = None
    else:
        tax_raw = _find_labeled_value(text, _TAX_LABELS, _NUMBER_RE, prefer_last=True)
        tax_decimal = None

    total_raw = _find_labeled_value(
        text, _TOTAL_LABELS, _NUMBER_RE, prefer_last=True
    )

    # Currency: explicit code, then symbol
    currency = _find_labeled_value(text, [r"currency"], r"[A-Za-z]{3}")
    if currency:
        currency = currency.upper()
    if not currency:
        for code in _CURRENCY_CODES:
            if re.search(rf"\b{code}\b", text):
                currency = code
                break
    if not currency:
        for sym, code in _CURRENCY_SYMBOLS.items():
            if sym in text:
                currency = code
                break

    fields = {
        "invoice_number": invoice_number,
        "invoice_date": _to_date(invoice_date_raw) if invoice_date_raw else None,
        "due_date": _to_date(due_date_raw) if due_date_raw else None,
        "subtotal": _to_decimal(subtotal_raw),
        "tax": tax_decimal if tax_decimal is not None else _to_decimal(tax_raw),
        "total_amount": _to_decimal(total_raw),
        "currency": currency,
    }

    found   = [k for k, v in fields.items() if v is not None]
    missing = [k for k, v in fields.items() if v is None]

    return {"fields": fields, "found": found, "missing": missing}
