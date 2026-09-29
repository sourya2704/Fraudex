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
}


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


def _find_labeled_value(text: str, labels: list[str], value_pattern: str) -> Optional[str]:
    for label in labels:


        junk = r"(?:[:\-=]|\([^)]*\)|[$₹€£]|Rs\.?|\s)*"
        pattern = rf"{label}{junk}({value_pattern})"
        m = re.search(pattern, text, flags=re.IGNORECASE | re.MULTILINE)
        if m:
            return m.group(1).strip()
    return None


def parse_invoice_text(raw_text: str) -> dict:
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

    subtotal_raw = _find_labeled_value(text, _SUBTOTAL_LABELS, _NUMBER_RE)
    tax_raw = _find_labeled_value(text, _TAX_LABELS, _NUMBER_RE)
    total_raw = _find_labeled_value(text, _TOTAL_LABELS, _NUMBER_RE)


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

    return {
        "fields": fields,
        "found": found,
        "missing": missing,
        "line_items": parse_line_items(text),
    }


_SUMMARY_KEYWORDS = (
    "subtotal", "sub-total", "sub total", "total", "tax", "gst", "vat",
    "grand", "amount due", "balance", "discount", "shipping",
)

_METADATA_KEYWORDS = (
    "invoice", "date", "due", "number", "bill", "currency", "vendor",
    "customer", "phone", "email", "address", "gstin", "pan", "order",
)

_LINE_TOTAL_MIN_NUMBERS = 2


def parse_line_items(raw_text: str) -> list:
    """
    Extract line items from invoice text.

    A line item is a row that ends in numeric columns. We interpret the
    trailing numbers as (unit_price, line_total) when two are present, or
    (line_total) when one is present, with an optional leading quantity.
    Header rows and summary rows (Subtotal/Tax/Total) are skipped.

    Returns a list of dicts: description, quantity, unit_price, line_total.
    Fields that cannot be read are None. This is deterministic and best-effort.
    """
    items = []
    for line in (raw_text or "").splitlines():
        stripped = line.strip()
        if not stripped:
            continue

        lower = stripped.lower()
        if any(kw in lower for kw in _SUMMARY_KEYWORDS):
            continue
        if any(kw in lower for kw in _METADATA_KEYWORDS):
            continue

        # Skip labeled metadata lines ("Something: value").
        if ":" in stripped:
            continue

        # A real item row has 2+ POSITIVE numbers (money/qty are never
        # negative). This also excludes date fragments like "-2026" that the
        # number regex would otherwise capture.
        raw_numbers = re.findall(_NUMBER_RE, stripped)
        decimals = [_to_decimal(n) for n in raw_numbers]
        decimals = [d for d in decimals if d is not None and d >= 0]
        if len(decimals) < _LINE_TOTAL_MIN_NUMBERS:
            continue

        description = re.split(_NUMBER_RE, stripped)[0].strip(" \t:-|")
        if not description:
            continue

        quantity = unit_price = line_total = None

        if len(decimals) >= 3:
            quantity, unit_price, line_total = decimals[0], decimals[-2], decimals[-1]
        elif len(decimals) == 2:
            unit_price, line_total = decimals[0], decimals[1]

        items.append({
            "description": description,
            "quantity": quantity,
            "unit_price": unit_price,
            "line_total": line_total,
        })

    return items
