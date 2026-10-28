"""
Vendor analytics: a sortable list of every vendor with its risk numbers, and
one vendor's full profile (history, usual amounts and GST rate, risk trend).
"""

from collections import Counter, defaultdict
from statistics import median, mode

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import case, func
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, get_db
from app.models.fraud_detection_result import FraudDetectionResult
from app.models.invoice import Invoice
from app.models.invoice_review import InvoiceReview
from app.models.user import User
from app.models.vendor import Vendor

router = APIRouter(prefix="/vendor-insights", tags=["Vendors"])

_HIGH = ("HIGH", "CRITICAL")


def _f(v):
    return float(v) if v is not None else None


@router.get("/")
def vendor_overview(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Every vendor with its totals, in three grouped queries (no per-vendor calls)."""
    invoices = dict(
        (row.vendor_id, row) for row in db.query(
            Invoice.vendor_id,
            func.count(Invoice.id).label("count"),
            func.sum(Invoice.total_amount).label("total"),
            func.avg(Invoice.total_amount).label("avg"),
            func.max(Invoice.invoice_date).label("last_date"),
        ).filter(Invoice.vendor_id.isnot(None)).group_by(Invoice.vendor_id).all()
    )
    reviews = dict(
        (row.vendor_id, row) for row in db.query(
            Invoice.vendor_id,
            func.sum(case((InvoiceReview.decision == "APPROVE", 1), else_=0)).label("approved"),
            func.sum(case((InvoiceReview.decision == "REJECT", 1), else_=0)).label("rejected"),
        ).join(InvoiceReview, InvoiceReview.invoice_id == Invoice.id)
        .filter(Invoice.vendor_id.isnot(None)).group_by(Invoice.vendor_id).all()
    )
    risk = dict(
        (row.vendor_id, row) for row in db.query(
            Invoice.vendor_id,
            func.avg(FraudDetectionResult.risk_score).label("avg_risk"),
            func.sum(case((FraudDetectionResult.risk_level.in_(_HIGH), 1), else_=0)).label("high"),
            func.count(FraudDetectionResult.id).label("checked"),
        ).join(FraudDetectionResult, FraudDetectionResult.invoice_id == Invoice.id)
        .filter(Invoice.vendor_id.isnot(None)).group_by(Invoice.vendor_id).all()
    )

    out = []
    for v in db.query(Vendor).order_by(Vendor.name).all():
        inv, rev, rk = invoices.get(v.id), reviews.get(v.id), risk.get(v.id)
        approved = int(rev.approved or 0) if rev else 0
        rejected = int(rev.rejected or 0) if rev else 0
        out.append({
            "id": v.id,
            "name": v.name,
            "tax_id": v.tax_id,
            "invoice_count": inv.count if inv else 0,
            "total_amount": _f(inv.total) if inv else 0.0,
            "average_amount": _f(inv.avg) if inv else None,
            "last_invoice_date": inv.last_date.isoformat() if inv and inv.last_date else None,
            "approved": approved,
            "rejected": rejected,
            "rejection_rate": rejected / (approved + rejected) if approved + rejected else None,
            "checked": rk.checked if rk else 0,
            "high_risk_count": int(rk.high or 0) if rk else 0,
            "average_risk": round(_f(rk.avg_risk), 1) if rk and rk.avg_risk is not None else None,
        })
    return out


@router.get("/{vendor_id}")
def vendor_profile(
    vendor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    vendor = db.get(Vendor, vendor_id)
    if vendor is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vendor not found")

    rows = (
        db.query(Invoice, FraudDetectionResult, InvoiceReview.decision)
        .outerjoin(FraudDetectionResult, FraudDetectionResult.invoice_id == Invoice.id)
        .outerjoin(InvoiceReview, InvoiceReview.invoice_id == Invoice.id)
        .filter(Invoice.vendor_id == vendor_id)
        .order_by(Invoice.invoice_date.desc().nullslast(), Invoice.id.desc())
        .all()
    )

    totals = [_f(i.total_amount) for i, _, _ in rows if i.total_amount is not None]
    rates = [round(float(i.tax / i.subtotal) * 100, 1) for i, _, _ in rows
             if i.tax is not None and i.subtotal]
    decisions = Counter(d for _, _, d in rows if d)
    levels = Counter(r.risk_level for _, r, _ in rows if r)
    flag_codes = Counter(f.get("code") for _, r, _ in rows if r for f in (r.fraud_flags or []))

    # Month by month, oldest first: invoices, amount billed, average risk.
    months = defaultdict(lambda: {"count": 0, "amount": 0.0, "risk_sum": 0.0, "risk_n": 0})
    for inv, res, _ in rows:
        if inv.invoice_date is None:
            continue
        m = months[inv.invoice_date.strftime("%Y-%m")]
        m["count"] += 1
        m["amount"] += _f(inv.total_amount) or 0.0
        if res is not None:
            m["risk_sum"] += res.risk_score
            m["risk_n"] += 1
    monthly = [
        {"month": k, "invoices": v["count"], "amount": round(v["amount"], 2),
         "average_risk": round(v["risk_sum"] / v["risk_n"], 1) if v["risk_n"] else None}
        for k, v in sorted(months.items())
    ]

    reviewed = decisions.get("APPROVE", 0) + decisions.get("REJECT", 0)
    return {
        "vendor": {"id": vendor.id, "name": vendor.name, "tax_id": vendor.tax_id,
                   "email": vendor.email, "phone": vendor.phone, "address": vendor.address,
                   "created_at": vendor.created_at.isoformat() if vendor.created_at else None},
        "stats": {
            "invoice_count": len(rows),
            "total_amount": round(sum(totals), 2),
            "average_amount": round(sum(totals) / len(totals), 2) if totals else None,
            "median_amount": round(median(totals), 2) if totals else None,
            "max_amount": max(totals) if totals else None,
            "usual_gst_rate": mode(rates) if rates else None,
            "approved": decisions.get("APPROVE", 0),
            "rejected": decisions.get("REJECT", 0),
            "further_review": decisions.get("REQUEST_FURTHER_REVIEW", 0),
            "rejection_rate": decisions.get("REJECT", 0) / reviewed if reviewed else None,
            "risk_levels": dict(levels),
            "first_invoice_date": min((i.invoice_date for i, _, _ in rows if i.invoice_date), default=None),
            "last_invoice_date": max((i.invoice_date for i, _, _ in rows if i.invoice_date), default=None),
        },
        "top_flags": [{"code": c, "count": n} for c, n in flag_codes.most_common(6)],
        "monthly": monthly,
        "recent_invoices": [
            {"id": i.id, "invoice_number": i.invoice_number,
             "invoice_date": i.invoice_date.isoformat() if i.invoice_date else None,
             "total_amount": _f(i.total_amount), "currency": i.currency, "status": i.status,
             "risk_level": r.risk_level if r else None, "risk_score": r.risk_score if r else None,
             "decision": d}
            for i, r, d in rows[:25]
        ],
    }
