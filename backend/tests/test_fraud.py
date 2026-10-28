from datetime import date, datetime, timedelta
from decimal import Decimal

from app.fraud.detector import FraudDetector
from app.models.invoice import Invoice
from app.models.invoice_review import InvoiceReview
from app.models.vendor import Vendor


def _invoice(db, vendor, number, total, day, **kw):
    sub = Decimal(total) / Decimal("1.18")
    inv = Invoice(
        vendor_id=vendor.id, invoice_number=number, invoice_date=day,
        due_date=day + timedelta(days=30), subtotal=sub.quantize(Decimal("0.01")),
        tax=(Decimal(total) - sub).quantize(Decimal("0.01")), total_amount=Decimal(total),
        currency="INR", status=kw.pop("status", "ANALYSIS_READY"),
        created_at=kw.pop("created_at", datetime.combine(day, datetime.min.time()) + timedelta(days=2)),
        **kw,
    )
    db.add(inv)
    db.flush()
    return inv


def _codes(db, inv):
    return {f.code for f in FraudDetector(db, use_ml=False).detect_fraud(inv).flags}


def test_duplicate_number_detected_despite_formatting(db):
    v = Vendor(name="Apex", tax_id="27AAPFU0939F1ZV"); db.add(v); db.flush()
    _invoice(db, v, "INV-0012", "11800", date(2026, 1, 5))
    dup = _invoice(db, v, "inv 0012", "11800", date(2026, 3, 5))
    assert "DUPLICATE_INVOICE" in _codes(db, dup)


def test_new_vendor_fires_only_for_first_invoice(db):
    v = Vendor(name="Fresh", tax_id="29AABCU9603R1ZM"); db.add(v); db.flush()
    first = _invoice(db, v, "F-1", "5900", date(2026, 1, 5))
    assert "NEW_VENDOR" in _codes(db, first)
    second = _invoice(db, v, "F-2", "5900", date(2026, 2, 5))
    assert "NEW_VENDOR" not in _codes(db, second)


def test_rejection_rate_comes_from_reviews(db):
    v = Vendor(name="Shady", tax_id="07AABCD1234E1ZF"); db.add(v); db.flush()
    for i in range(6):
        inv = _invoice(db, v, f"S-{i}", str(10000 + i * 997), date(2026, 1, 1) + timedelta(days=20 * i),
                       status="DECIDED")
        db.add(InvoiceReview(invoice_id=inv.id, decision="REJECT" if i < 3 else "APPROVE", reason="t"))
    db.flush()
    new = _invoice(db, v, "S-99", "12000", date(2026, 6, 1))
    assert "HIGH_VENDOR_REJECTION_RATE" in _codes(db, new)


def test_similar_invoice_is_one_flag_graded_by_closeness(db):
    v = Vendor(name="Busy", tax_id="33AABCE5678F1ZG"); db.add(v); db.flush()
    _invoice(db, v, "B-1", "10000", date(2026, 1, 10))
    _invoice(db, v, "B-2", "10300", date(2026, 1, 12))
    cur = _invoice(db, v, "B-3", "10450", date(2026, 1, 13))
    flags = [f for f in FraudDetector(db, use_ml=False).detect_fraud(cur).flags if f.code == "SIMILAR_INVOICE"]
    assert len(flags) == 1
    assert flags[0].severity == "MEDIUM"


def test_fifteen_percent_gst_is_invalid(db):
    inv = Invoice(subtotal=Decimal("5000"), tax=Decimal("750"), total_amount=Decimal("5750"),
                  invoice_number="X", invoice_date=date(2026, 1, 1), created_at=datetime(2026, 1, 2))
    db.add(inv); db.flush()
    assert "INVALID_GST_RATE" in _codes(db, inv)


def test_review_without_uploader_does_not_crash(db):
    from fastapi.testclient import TestClient

    from app.core.security import create_access_token, hash_password
    from app.main import app
    from app.models.user import User

    admin = User(name="A", email="rev@x.io", password_hash=hash_password("pw123456"), role="ADMIN")
    db.add(admin)
    inv = Invoice(invoice_number="SEED-1", total_amount=Decimal("100"), status="ANALYSIS_READY")
    db.add(inv)
    db.commit()
    token = create_access_token({"sub": str(admin.id), "role": "ADMIN"})
    r = TestClient(app).post(f"/invoices/{inv.id}/review", json={"decision": "APPROVE", "reason": "ok"},
                             headers={"Authorization": f"Bearer {token}"})
    assert r.status_code in (200, 201), r.text
