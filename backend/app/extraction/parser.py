"""
Deterministic parsing of raw invoice text into structured fields.

This is intentionally rule-based (regex + label matching), not LLM-based.
It gives predictable, explainable results and a clear record of which
fields were found. Fields it cannot confidently read are left as None so
the validation layer (STEP 7b) can flag them, rather than guessing.
"""

import re
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Optional


# --- helpers ---------------------------------------------------------------

# Common label variants seen on invoices. Order matters: more specific
# labels (e.g. "grand total") should be tried before generic ones.
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
]
_TAX_LABELS = [
    r"gst",
    r"vat",
    r"tax\s*amount",
    r"tax",
]
_TOTAL_LABELS = [
    r"grand\s*total",
    r"total\s*amount\s*due",
    r"total\s*payable",
    r"invoice\s*total",
    # Generic "total" but NOT "subtotal" / "sub-total" / "sub total".
    r"(?<!sub)(?<!sub[\-\s])total",
]

# ISO 4217 codes we care about, plus common symbols.
_CURRENCY_CODES = ["INR", "USD", "EUR", "GBP", "JPY", "AUD", "CAD"]
_CURRENCY_SYMBOLS = {
    "₹": "INR",
    "$": "USD",
    "€": "EUR",
    "£": "GBP",
    "Rs": "INR",
    "Rs.": "INR",
}

# Match the longest numeric form first. A plain run of digits (with optional
# decimals) comes first so "100000.00" is captured whole; the grouped form
# handles thousands separators like "1,20,000" or "2,500.00".
_NUMBER_RE = r"[-+]?\d+(?:,\d+)*(?:\.\d+)?"

_DATE_FORMATS = [
    "%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%m/%d/%Y",
    "%d.%m.%Y", "%Y/%m/%d", "%d %b %Y", "%d %B %Y",
    "%b %d, %Y", "%B %d, %Y",
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
    Find the first value that follows any of the given labels on the same line.
    Labels are matched case-insensitively. Returns the raw matched string.
    """
    matches = []
    for label in labels:
        # After the label, allow optional junk before the value:
        #   - separators (: - =)
        #   - parenthetical notes like "(18%)"
        #   - currency symbols/prefixes ($ ₹ € £ Rs)
        #   - whitespace
        # then capture the value.
        junk = r"(?:[:\-=]|\([^)]*\)|[$₹€£]|Rs\.?|\s)*"
        pattern = rf"{label}{junk}({value_pattern})"
        for match in re.finditer(pattern, text, flags=re.IGNORECASE | re.MULTILINE):
            matches.append(match.group(1).strip())
    return matches[-1] if prefer_last and matches else (matches[0] if matches else None)


# --- public API ------------------------------------------------------------

def parse_invoice_text(raw_text: str) -> dict:
    """
    Parse raw invoice text into structured fields.

    Returns a dict:
      {
        "fields": {invoice_number, invoice_date, due_date,
                   subtotal, tax, total_amount, currency},
        "found":  [list of field names successfully parsed],
        "missing":[list of field names that could not be parsed],
      }

    Amounts are Decimal, dates are datetime.date, others are str.
    Any field that cannot be confidently read is None.
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
    tax_raw = _find_labeled_value(
        text, _TAX_LABELS, _NUMBER_RE, prefer_last=True
    )
    total_raw = _find_labeled_value(
        text, _TOTAL_LABELS, _NUMBER_RE, prefer_last=True
    )

    # currency: explicit code, then symbol
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
        "tax": _to_decimal(tax_raw),
        "total_amount": _to_decimal(total_raw),
        "currency": currency,
    }

    found = [k for k, v in fields.items() if v is not None]
    missing = [k for k, v in fields.items() if v is None]

    return {"fields": fields, "found": found, "missing": missing}
