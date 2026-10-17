"""
Feature extraction for the invoice fraud model.

The same function is used to build the training set (scripts/train_fraud_model.py)
and to score a live invoice (app/ml/model.py), so training and serving cannot
drift apart. It works on any object with the Invoice attributes below, so it
accepts both SQLAlchemy Invoice rows and the plain records of the training set.
"""

import math
import re
import statistics
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Any, Iterable, Optional

GST_SLABS = (0.0, 0.05, 0.12, 0.18, 0.28)
APPROVAL_THRESHOLDS = (50_000, 100_000, 500_000, 1_000_000)

FEATURE_NAMES = [
    "log_total",
    "has_vendor",
    "vendor_history_count",
    "amount_z_score",
    "ratio_to_vendor_mean",
    "ratio_to_vendor_max",
    "tax_rate",
    "gst_slab_distance",
    "tax_rate_deviation_from_vendor",
    "total_mismatch_log",
    "total_mismatch_ratio",
    "payment_terms_days",
    "due_before_invoice",
    "days_dated_after_upload",
    "invoice_age_days",
    "just_below_threshold",
    "is_round_thousand",
    "duplicate_number_count",
    "similar_invoice_count",
    "same_day_submissions",
    "missing_field_count",
]


def _f(value: Any) -> Optional[float]:
    if value is None:
        return None
    if isinstance(value, Decimal):
        return float(value)
    return float(value)


def _as_date(value: Any) -> Optional[date]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date()
    return value


def normalize_invoice_number(value: Optional[str]) -> str:
    return re.sub(r"[^0-9A-Za-z]", "", value or "").upper()


def build_features(invoice: Any, history: Iterable[Any]) -> list[float]:
    """
    Turn one invoice plus its vendor's other invoices into a feature vector.

    `history` must not contain the invoice itself. Missing values are encoded
    as neutral numbers (0 or -1) rather than NaN so any classifier can use them.
    """
    history = list(history)

    total = _f(invoice.total_amount)
    subtotal = _f(invoice.subtotal)
    tax = _f(invoice.tax)
    inv_date = _as_date(invoice.invoice_date)
    due_date = _as_date(invoice.due_date)
    uploaded = invoice.created_at or datetime.now()
    upload_date = _as_date(uploaded)

    hist_totals = [_f(h.total_amount) for h in history if h.total_amount is not None]

    # ── Amount vs vendor history ──────────────────────────────────────────────
    z_score = 0.0
    ratio_mean = 1.0
    ratio_max = 1.0
    if total is not None and len(hist_totals) >= 5:
        mean = statistics.mean(hist_totals)
        std = statistics.pstdev(hist_totals)
        if std > 0:
            z_score = (total - mean) / std
        if mean > 0:
            ratio_mean = total / mean
        peak = max(hist_totals)
        if peak > 0:
            ratio_max = total / peak

    # ── Tax ───────────────────────────────────────────────────────────────────
    tax_rate = -1.0
    slab_distance = 0.0
    rate_deviation = 0.0
    if subtotal and tax is not None and subtotal > 0:
        tax_rate = tax / subtotal
        slab_distance = min(abs(tax_rate - s) for s in GST_SLABS)
        hist_rates = [
            round(_f(h.tax) / _f(h.subtotal), 2)
            for h in history
            if h.tax is not None and h.subtotal and _f(h.subtotal) > 0
        ]
        if len(hist_rates) >= 3:
            modal = statistics.mode(hist_rates)
            rate_deviation = abs(tax_rate - modal)

    mismatch_log = 0.0
    mismatch_ratio = 0.0
    if total is not None and subtotal is not None and tax is not None:
        diff = abs(subtotal + tax - total)
        mismatch_log = math.log1p(diff)
        mismatch_ratio = diff / total if total else 0.0

    # ── Dates ─────────────────────────────────────────────────────────────────
    terms = -1.0
    due_before = 0.0
    if inv_date and due_date:
        terms = float((due_date - inv_date).days)
        due_before = 1.0 if due_date < inv_date else 0.0
    dated_after_upload = 0.0
    age = 0.0
    if inv_date and upload_date:
        delta = (inv_date - upload_date).days
        dated_after_upload = float(max(0, delta))
        age = float(max(0, -delta))

    # ── Amount shape ──────────────────────────────────────────────────────────
    below_threshold = 0.0
    round_thousand = 0.0
    if total is not None:
        for threshold in APPROVAL_THRESHOLDS:
            if threshold * 0.98 <= total < threshold:
                below_threshold = 1.0
        round_thousand = 1.0 if total >= 1000 and total % 1000 == 0 else 0.0

    # ── Relationship to other invoices of the vendor ──────────────────────────
    number = normalize_invoice_number(invoice.invoice_number)
    dup_count = sum(
        1 for h in history if number and normalize_invoice_number(h.invoice_number) == number
    )

    similar = 0
    if total and inv_date:
        for h in history:
            h_total = _f(h.total_amount)
            h_date = _as_date(h.invoice_date)
            if h_total is None or h_date is None:
                continue
            if abs(h_total - total) <= 0.05 * total and abs((h_date - inv_date).days) <= 7:
                similar += 1

    same_day = 0
    for h in history:
        if h.created_at is not None and abs(h.created_at - uploaded) <= timedelta(hours=24):
            same_day += 1

    missing = sum(
        1 for v in (invoice.invoice_number, inv_date, subtotal, tax, total) if v is None
    )

    return [
        math.log1p(total) if total and total > 0 else 0.0,
        1.0 if invoice.vendor_id else 0.0,
        float(min(len(history), 200)),
        max(-20.0, min(20.0, z_score)),
        min(ratio_mean, 50.0),
        min(ratio_max, 50.0),
        tax_rate,
        slab_distance,
        rate_deviation,
        mismatch_log,
        min(mismatch_ratio, 5.0),
        terms,
        due_before,
        min(dated_after_upload, 3650.0),
        min(age, 3650.0),
        below_threshold,
        round_thousand,
        float(dup_count),
        float(min(similar, 20)),
        float(min(same_day, 50)),
        float(missing),
    ]
