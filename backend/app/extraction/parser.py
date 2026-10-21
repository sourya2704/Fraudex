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
    r"(?<!sub)(?<!sub[\-\s])total\s*amount",
    r"amount\s*payable",
    r"net\s*payable",
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


_DATE_TOKEN_RE = re.compile(
    r"\d{4}[-/]\d{1,2}[-/]\d{1,2}"
    r"|\d{1,2}[-/.]\d{1,2}[-/.]\d{4}"
    r"|\d{1,2}[- ][A-Za-z]{3,9},?[- ]\d{4}"
    r"|[A-Za-z]{3,9} \d{1,2}, \d{4}"
)


def _to_date(raw: str) -> Optional[date]:
    raw = raw.strip()
    candidates = [raw] + _DATE_TOKEN_RE.findall(raw)
    for candidate in candidates:
        for fmt in _DATE_FORMATS:
            try:
                return datetime.strptime(candidate.strip(), fmt).date()
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

    Labels are tried in order (most specific first) and the first label that
    matches wins, so "Grand Total" beats a bare "Total" and "GST:" beats a
    "tax" mentioned in a footnote. Within that label, prefer_last picks the
    last occurrence (summary rows come after line items).
    """
    for label in labels:
        matches = []
        # Percent rates ("CGST @ 9%") are skipped so the rate is never read as the amount.
        # Fonts without a rupee glyph often render "₹" as "I" ("I10,000.00").
        junk = r"(?:@?\s*\d+(?:\.\d+)?\s*%|[:\-=@]|\([^)]*\)|[$₹€£#]|Rs\.?|INR|I(?=\d)|\s)*"
        # Same line match (the junk also spans a line break). The lookahead
        # stops a rate such as "18%" from being taken as the value.
        pattern = rf"{label}{junk}({value_pattern})(?![\d,.]*\s*%)"
        for match in re.finditer(pattern, text, flags=re.IGNORECASE | re.MULTILINE):
            matches.append(match.group(1).strip())
        # Next line match — label alone on its line, value on next
        pattern2 = rf"^[ \t]*{label}[ \t]*$\s*^[ \t]*({value_pattern})[ \t]*$"
        for match in re.finditer(pattern2, text, flags=re.IGNORECASE | re.MULTILINE):
            matches.append(match.group(1).strip())
        if matches:
            return matches[-1] if prefer_last else matches[0]
    return None


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
    # Some Indian invoice generators render ₹ as '#'. Only treat '#' as a
    # currency mark when it prefixes a money amount, never "Invoice #123".
    if not currency and re.search(r"#\s?\d[\d,]*\.\d{2}\b", text):
        currency = "INR"
    # A GSTIN or CGST/SGST/IGST line means an Indian GST invoice.
    if not currency and (_GSTIN_RE.search(text.upper()) or re.search(r"\b[CSI]GST\b", text, re.IGNORECASE)):
        currency = "INR"

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

    vendor = parse_vendor(text)

    return {
        "fields": fields,
        "found": found,
        "missing": missing,
        "vendor": vendor,
        "line_items": parse_line_items(text),
    }


# GSTIN: 2-digit state code + PAN (5 letters, 4 digits, 1 letter) + entity + 'Z' + checksum
_GSTIN_RE = re.compile(r"\b(\d{2}[A-Z]{5}\d{4}[A-Z][0-9A-Z]Z[0-9A-Z])\b")
_BUYER_SECTION_RE = re.compile(
    r"^\s*(?:bill(?:ed)?\s*to|buyer|ship(?:ped)?\s*to|consignee|customer|sold\s*to)\b",
    re.IGNORECASE | re.MULTILINE,
)
_VENDOR_NAME_LABELS = [
    r"^[ \t]*(?:vendor|supplier|seller|sold\s*by|billed\s*by)(?:\s*name)?[ \t]*:",
]
_COMPANY_SUFFIX_RE = re.compile(
    r"\b(?:pvt\.?|private|ltd\.?|limited|llp|inc\.?|corp\.?|co\.?|company|"
    r"enterprises|industries|traders|services|solutions|technologies)\b",
    re.IGNORECASE,
)


def normalize_gstin(value: Optional[str]) -> Optional[str]:
    """Upper-case and strip a GSTIN, tolerating a leading 'GSTIN' label."""
    if not value:
        return None
    cleaned = re.sub(r"[^0-9A-Za-z]", "", value).upper()
    if cleaned.startswith("GSTIN"):
        cleaned = cleaned[5:]
    return cleaned or None


def parse_vendor(raw_text: str) -> dict:
    """
    Identify the supplier on the invoice.

    The supplier GSTIN is the first one that appears before any buyer section
    ("Bill To", "Buyer", "Ship To"...); if every GSTIN is inside a buyer
    section, the first one is used. The name comes from an explicit vendor
    label, otherwise the first line near the top that looks like a company.
    """
    text = raw_text or ""
    upper = text.upper()

    buyer_match = _BUYER_SECTION_RE.search(text)
    buyer_start = buyer_match.start() if buyer_match else len(text)

    gstins = [(m.start(), m.group(1)) for m in _GSTIN_RE.finditer(upper)]
    supplier_gstin = None
    for pos, value in gstins:
        if pos < buyer_start:
            supplier_gstin = value
            break
    if supplier_gstin is None and gstins:
        supplier_gstin = gstins[0][1]

    name = _find_labeled_value(text, _VENDOR_NAME_LABELS, r"[A-Za-z0-9&.,'() \-]{3,}")
    if name:
        name = name.strip(" .,-")
    if not name:
        for line in text[:buyer_start].splitlines()[:12]:
            candidate = line.strip()
            if 3 <= len(candidate) <= 120 and _COMPANY_SUFFIX_RE.search(candidate) \
                    and not re.search(r"invoice|gstin|date", candidate, re.IGNORECASE):
                name = candidate
                break

    return {"gstin": supplier_gstin, "name": name or None}


_SUMMARY_KEYWORDS = (
    "subtotal", "sub-total", "sub total", "total", "tax", "gst", "vat",
    "grand", "amount due", "balance", "discount", "shipping", "round off",
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
    (quantity, ..., unit_price, line_total) when three or more are present.
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

        # Percentages (GST rate columns) are not money columns.
        without_pct = re.sub(r"\d+(?:\.\d+)?\s*%", " ", stripped)

        # A real item row has 2+ POSITIVE numbers (money/qty are never
        # negative). This also excludes date fragments like "-2026" that the
        # number regex would otherwise capture.
        raw_numbers = re.findall(_NUMBER_RE, without_pct)
        decimals = [_to_decimal(n) for n in raw_numbers]
        decimals = [d for d in decimals if d is not None and d >= 0]
        if len(decimals) < _LINE_TOTAL_MIN_NUMBERS:
            continue

        # The line total is money, printed with paise ("6,000.00"). Requiring
        # that keeps addresses ("Plot 14, Sector 9 ... 201301") and invoice
        # numbers ("NOS/2026/0007") from being read as line items, which made
        # validation report a false subtotal mismatch.
        if not re.search(r"\d\.\d{2}\s*$", without_pct):
            continue

        description = re.split(_NUMBER_RE, without_pct)[0].strip(" \t:-|")
        if not description or not re.search(r"[A-Za-z]", description):
            continue

        quantity = unit_price = line_total = None

        if len(decimals) >= 3:
            quantity, unit_price, line_total = decimals[0], decimals[-2], decimals[-1]
        else:
            unit_price, line_total = decimals[0], decimals[1]

        items.append({
            "description": description[:500],
            "quantity": quantity,
            "unit_price": unit_price,
            "line_total": line_total,
        })

    return items
