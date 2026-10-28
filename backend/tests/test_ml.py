"""
Sanity checks on the trained fraud model, built independently of the
training generator: ordinary invoices (late ones included) must score low,
clear fraud patterns high. Guards against the model learning artefacts of the
synthetic data (e.g. "uploaded late = fraud", "amount has paise = fraud").
"""

from datetime import date, datetime, timedelta
from types import SimpleNamespace

import pytest

from app.ml.features import build_features
from app.ml.model import load_model

bundle = load_model()
pytestmark = pytest.mark.skipif(bundle is None, reason="no trained model")


def _inv(d, uploaded, total, number, vendor=1, rate=0.18):
    sub = round(total / (1 + rate), 2)
    return SimpleNamespace(
        vendor_id=vendor, invoice_number=number, invoice_date=d,
        due_date=d + timedelta(days=30), created_at=uploaded,
        subtotal=sub, tax=round(total - sub, 2), total_amount=total,
    )


HISTORY = [_inv(date(2025, m, 5), datetime(2025, m, 8, 11), 11800 + m * 150, f"ACM-{m:04d}")
           for m in range(1, 13)]


def _p(invoice, history):
    return bundle["model"].predict_proba([build_features(invoice, history)])[0][1]


@pytest.mark.parametrize("invoice,history", [
    (_inv(date(2026, 1, 5), datetime(2026, 1, 9, 11), 12500, "ACM-0013"), HISTORY),
    (_inv(date(2025, 12, 31), datetime(2026, 10, 17, 11), 12500, "ACM-0013"), HISTORY),  # 290 days late
])
def test_ordinary_invoices_score_low(invoice, history):
    assert _p(invoice, history) < bundle["threshold"]


@pytest.mark.parametrize("invoice", [
    _inv(date(2024, 8, 1), datetime(2026, 10, 17, 11), 12500, "ACM-0013"),     # over two years old
    _inv(date(2026, 1, 5), datetime(2026, 1, 9, 11), 12500, "ACM-0005"),       # duplicate number
    _inv(date(2026, 1, 5), datetime(2026, 1, 9, 11), 12500, "ACM-0013", rate=0.21),  # invalid GST
    _inv(date(2026, 1, 5), datetime(2026, 1, 9, 11), 100000, "ACM-0013"),      # 8x the usual amount
])
def test_fraud_patterns_score_high(invoice):
    assert _p(invoice, HISTORY) >= bundle["threshold"]
