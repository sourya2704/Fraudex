"""
Duplicate Invoice Detection

Detects exact duplicate invoices and similar invoices that may indicate fraud.
"""

from datetime import timedelta
from decimal import Decimal
from typing import List, Optional

from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from app.fraud.config import FraudConfig
from app.fraud.models import FraudFlag, Severity
from app.models.invoice import Invoice


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

    # Query for invoices with same vendor and invoice number
    # Exclude the current invoice from the search
    duplicate = db.query(Invoice).filter(
        and_(
            Invoice.vendor_id == invoice.vendor_id,
            Invoice.invoice_number == invoice.invoice_number,
            Invoice.id != invoice.id,  # Exclude self
        )
    ).first()

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

    # Create flags for each similar invoice
    for similar in similar_invoices:
        # Calculate similarity metrics
        amount_diff_pct = abs(
            float((similar.total_amount - amount) / amount * 100)
        )
        date_diff_days = abs((similar.invoice_date - invoice_date).days)

        flags.append(
            FraudFlag(
                code="SIMILAR_INVOICE",
                severity=Severity.HIGH,
                message=f"Similar invoice detected: Invoice ID {similar.id} has "
                        f"similar amount (±{amount_diff_pct:.1f}%) and date "
                        f"(±{date_diff_days} days) from the same vendor",
                evidence={
                    "similar_invoice_id": similar.id,
                    "similar_invoice_number": similar.invoice_number,
                    "similar_amount": str(similar.total_amount),
                    "amount_difference_pct": round(amount_diff_pct, 2),
                    "similar_date": similar.invoice_date.isoformat(),
                    "date_difference_days": date_diff_days,
                    "similar_created_at": similar.created_at.isoformat() if similar.created_at else None,
                },
                field_name="total_amount",
            )
        )

    return flags


def check_duplicate_document(db: Session, invoice: Invoice) -> Optional[FraudFlag]:
    """
    Check if the same document has been uploaded before.
    
    Note: This is a placeholder for future implementation that would
    compare document hashes or content similarity.
    
    Args:
        db: Database session
        invoice: Invoice to check
        
    Returns:
        FraudFlag if duplicate document found, None otherwise
    """
    # TODO: Implement document hash comparison
    # This would require calculating and storing document hashes
    # For now, we rely on invoice number and amount similarity
    return None
