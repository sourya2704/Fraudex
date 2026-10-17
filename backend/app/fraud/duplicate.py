"""
Duplicate Invoice Detection

Detects exact duplicate invoices and similar invoices that may indicate fraud.
"""

import re
from datetime import timedelta
from decimal import Decimal
from typing import List, Optional

from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from app.fraud.config import FraudConfig
from app.fraud.models import FraudFlag, Severity
from app.models.invoice import Invoice


def normalize_invoice_number(value: Optional[str]) -> str:
    """Case/separator-insensitive form of an invoice number."""
    return re.sub(r"[^0-9A-Za-z]", "", value or "").upper()


def check_duplicate_invoice(db: Session, invoice: Invoice) -> Optional[FraudFlag]:
    """
    Check for exact duplicate invoices (same vendor + invoice number).
    
    Args:
        db: Database session
        invoice: Invoice to check
        
    Returns:
        FraudFlag if duplicate found, None otherwise
    """
    # Skip if missing required fields
    if not invoice.vendor_id or not invoice.invoice_number:
        return None

    # Same vendor + same invoice number, ignoring case, spaces and
    # separators ("INV-001" == "inv 001"), which is how resubmitted
    # invoices are usually disguised.
    target = normalize_invoice_number(invoice.invoice_number)
    candidates = db.query(Invoice).filter(
        and_(
            Invoice.vendor_id == invoice.vendor_id,
            Invoice.invoice_number.isnot(None),
            Invoice.id != invoice.id,  # Exclude self
        )
    ).all()
    duplicate = next(
        (c for c in candidates if normalize_invoice_number(c.invoice_number) == target),
        None,
    )

    if duplicate:
        return FraudFlag(
            code="DUPLICATE_INVOICE",
            severity=Severity.CRITICAL,
            message=f"Duplicate invoice detected: Invoice #{invoice.invoice_number} "
                    f"already exists for this vendor (Invoice ID: {duplicate.id})",
            evidence={
                "duplicate_invoice_id": duplicate.id,
                "duplicate_invoice_number": duplicate.invoice_number,
                "duplicate_created_at": duplicate.created_at.isoformat() if duplicate.created_at else None,
                "duplicate_amount": str(duplicate.total_amount) if duplicate.total_amount else None,
            },
            field_name="invoice_number",
        )

    return None


def check_similar_invoice(db: Session, invoice: Invoice) -> List[FraudFlag]:
    """
    Check for similar invoices that may indicate duplicate submission.
    
    Looks for invoices from the same vendor with:
    - Similar amount (within threshold)
    - Similar date (within time window)
    
    Args:
        db: Database session
        invoice: Invoice to check
        
    Returns:
        List of FraudFlags for similar invoices found
    """
    flags = []

    # Skip if missing required fields
    if not invoice.vendor_id or not invoice.total_amount or not invoice.invoice_date:
        return flags

    amount = invoice.total_amount
    invoice_date = invoice.invoice_date

    # Calculate amount range (±threshold)
    threshold = FraudConfig.AMOUNT_SIMILARITY_THRESHOLD
    amount_lower = amount * Decimal(1 - threshold)
    amount_upper = amount * Decimal(1 + threshold)

    # Calculate date range
    date_window = timedelta(days=FraudConfig.DATE_WINDOW_DAYS)
    date_lower = invoice_date - date_window
    date_upper = invoice_date + date_window

    # Query for similar invoices
    similar_invoices = db.query(Invoice).filter(
        and_(
            Invoice.vendor_id == invoice.vendor_id,
            Invoice.id != invoice.id,  # Exclude self
            Invoice.total_amount.isnot(None),
            Invoice.total_amount >= amount_lower,
            Invoice.total_amount <= amount_upper,
            Invoice.invoice_date.isnot(None),
            Invoice.invoice_date >= date_lower,
            Invoice.invoice_date <= date_upper,
        )
    ).all()

    if not similar_invoices:
        return flags

    # One flag for the closest match. Vendors that bill often legitimately
    # send invoices of similar size within a week, so only a near-identical
    # amount and date is HIGH; a looser match is a weaker signal. (One HIGH
    # flag per match made this the main source of false positives.)
    def closeness(other):
        pct = abs(float((other.total_amount - amount) / amount * 100))
        days = abs((other.invoice_date - invoice_date).days)
        return pct, days

    closest = min(similar_invoices, key=closeness)
    amount_diff_pct, date_diff_days = closeness(closest)

    if amount_diff_pct <= 0.5 and date_diff_days <= 2:
        severity = Severity.HIGH
    elif amount_diff_pct <= 2.0:
        severity = Severity.MEDIUM
    else:
        severity = Severity.LOW

    flags.append(
        FraudFlag(
            code="SIMILAR_INVOICE",
            severity=severity,
            message=f"Similar invoice detected: Invoice ID {closest.id} has "
                    f"similar amount (±{amount_diff_pct:.1f}%) and date "
                    f"(±{date_diff_days} days) from the same vendor"
                    + (f" ({len(similar_invoices)} similar invoices in total)"
                       if len(similar_invoices) > 1 else ""),
            evidence={
                "similar_invoice_id": closest.id,
                "similar_invoice_number": closest.invoice_number,
                "similar_amount": str(closest.total_amount),
                "amount_difference_pct": round(amount_diff_pct, 2),
                "similar_date": closest.invoice_date.isoformat(),
                "date_difference_days": date_diff_days,
                "similar_created_at": closest.created_at.isoformat() if closest.created_at else None,
                "similar_invoice_count": len(similar_invoices),
            },
            field_name="total_amount",
        )
    )

    return flags


def check_duplicate_document(db: Session, invoice: Invoice) -> Optional[FraudFlag]:
    """
    Check if the same document content has been uploaded before.

    Compares the extracted text, so it also catches a re-upload of the same
    file under a different name, and works when no vendor could be linked.
    """
    text = (invoice.raw_text or "").strip()
    # Too little text (failed OCR, blank page) would match unrelated uploads.
    if len(text) < 50:
        return None

    duplicate = db.query(Invoice).filter(
        Invoice.id != invoice.id,
        Invoice.raw_text == invoice.raw_text,
    ).order_by(Invoice.id).first()

    if duplicate is None:
        return None

    return FraudFlag(
        code="DUPLICATE_DOCUMENT",
        severity=Severity.CRITICAL,
        message=f"The same document was already uploaded as Invoice ID {duplicate.id}",
        evidence={
            "duplicate_invoice_id": duplicate.id,
            "duplicate_invoice_number": duplicate.invoice_number,
            "duplicate_created_at": duplicate.created_at.isoformat() if duplicate.created_at else None,
        },
        field_name="document_path",
    )
