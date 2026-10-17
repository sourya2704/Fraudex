"""
Vendor Risk Analysis

Analyzes vendor risk based on historical patterns and rejection rates.
"""

from decimal import Decimal
from typing import List, Optional

from sqlalchemy import func, true
from sqlalchemy.orm import Session

from app.fraud.config import FraudConfig
from app.fraud.models import FraudFlag, Severity
from app.models.invoice import Invoice, InvoiceStatus
from app.models.vendor import Vendor


def _get_vendor_invoice_stats(
    db: Session, vendor_id: int, exclude_invoice_id: Optional[int] = None
) -> dict:
    """
    Calculate vendor statistics from invoice history.
    
    Args:
        db: Database session
        vendor_id: Vendor ID to analyze
        
    Returns:
        Dict with vendor statistics
    """
    # Get all invoices for this vendor
    query = db.query(Invoice).filter(Invoice.vendor_id == vendor_id)
    if exclude_invoice_id is not None:
        # The invoice under analysis is not part of its own vendor history.
        query = query.filter(Invoice.id != exclude_invoice_id)
    invoices = query.all()

    if not invoices:
        return {
            "total_invoices": 0,
            "approved_invoices": 0,
            "rejected_invoices": 0,
            "pending_invoices": 0,
            "reviewed_invoices": 0,
            "rejection_rate": 0.0,
            "average_amount": None,
            "is_new_vendor": True,
        }

    # Count by status
    total = len(invoices)
    decided_invoices = [
        inv for inv in invoices
        if inv.status == InvoiceStatus.DECIDED.value
    ]

    # Approvals / rejections come from the human review decisions.
    from app.models.invoice_review import InvoiceReview
    decisions = dict(
        db.query(InvoiceReview.decision, func.count(InvoiceReview.id))
        .join(Invoice, Invoice.id == InvoiceReview.invoice_id)
        .filter(Invoice.vendor_id == vendor_id)
        .filter(Invoice.id != exclude_invoice_id if exclude_invoice_id is not None else true())
        .group_by(InvoiceReview.decision)
        .all()
    )
    approved = decisions.get("APPROVE", 0)
    rejected = decisions.get("REJECT", 0)
    pending = total - len(decided_invoices)

    # Calculate average amount
    amounts = [
        float(inv.total_amount)
        for inv in invoices
        if inv.total_amount is not None
    ]
    average_amount = sum(amounts) / len(amounts) if amounts else None

    # Rate over reviewed invoices only: unreviewed ones say nothing yet.
    reviewed = approved + rejected
    rejection_rate = rejected / reviewed if reviewed > 0 else 0.0

    return {
        "total_invoices": total,
        "approved_invoices": approved,
        "rejected_invoices": rejected,
        "pending_invoices": pending,
        "rejection_rate": rejection_rate,
        "average_amount": average_amount,
        "is_new_vendor": total < FraudConfig.NEW_VENDOR_INVOICE_THRESHOLD,
        "reviewed_invoices": reviewed,
    }


def analyze_vendor_risk(db: Session, invoice: Invoice) -> List[FraudFlag]:
    """
    Analyze vendor-level risk factors.
    
    Checks:
    - High rejection rate
    - New/unknown vendor
    - Sudden high-value invoice from vendor
    
    Args:
        db: Database session
        invoice: Invoice to analyze
        
    Returns:
        List of FraudFlags for vendor risk issues
    """
    flags = []

    if not invoice.vendor_id:
        flags.append(
            FraudFlag(
                code="UNKNOWN_VENDOR",
                severity=Severity.LOW,   # no vendor linked is common for new invoices
                message="Invoice has no associated vendor",
                evidence={"vendor_id": None},
                field_name="vendor_id",
            )
        )
        return flags

    # Get vendor statistics
    stats = _get_vendor_invoice_stats(db, invoice.vendor_id, exclude_invoice_id=invoice.id)

    # Only flag as new vendor if there are ZERO prior invoices.
    # Having 1-2 prior invoices is not suspicious — every vendor starts somewhere.
    if stats["total_invoices"] == 0:
        severity = Severity.MEDIUM
        if invoice.total_amount and invoice.total_amount > FraudConfig.HIGH_VALUE_THRESHOLD:
            severity = Severity.HIGH
        flags.append(
            FraudFlag(
                code="NEW_VENDOR",
                severity=severity,
                message="No previous invoices recorded for this vendor",
                evidence={
                    "vendor_id": invoice.vendor_id,
                    "total_invoices": stats["total_invoices"],
                    "invoice_amount": str(invoice.total_amount) if invoice.total_amount else None,
                    "is_high_value": bool(
                        invoice.total_amount and
                        invoice.total_amount > FraudConfig.HIGH_VALUE_THRESHOLD
                    ),
                },
                field_name="vendor_id",
            )
        )

    # Check for high rejection rate
    if (
        stats["reviewed_invoices"] >= FraudConfig.MIN_VENDOR_HISTORY and
        stats["rejection_rate"] > FraudConfig.HIGH_REJECTION_RATE_THRESHOLD
    ):
        flags.append(
            FraudFlag(
                code="HIGH_VENDOR_REJECTION_RATE",
                severity=Severity.HIGH,
                message=f"Vendor has high rejection rate: "
                        f"{stats['rejection_rate'] * 100:.1f}% of invoices rejected",
                evidence={
                    "vendor_id": invoice.vendor_id,
                    "rejection_rate": round(stats["rejection_rate"], 3),
                    "total_invoices": stats["total_invoices"],
                    "rejected_invoices": stats["rejected_invoices"],
                },
                field_name="vendor_id",
            )
        )

    return flags


def analyze_vendor_history(db: Session, invoice: Invoice) -> List[FraudFlag]:
    """
    Analyze vendor's invoice history for patterns.
    
    Checks:
    - Sudden spike in invoice amount
    - Unusual patterns in submission
    
    Args:
        db: Database session
        invoice: Invoice to analyze
        
    Returns:
        List of FraudFlags for unusual patterns
    """
    flags = []

    if not invoice.vendor_id or not invoice.total_amount:
        return flags

    # Get vendor's historical amounts
    historical_invoices = db.query(Invoice).filter(
        Invoice.vendor_id == invoice.vendor_id,
        Invoice.id != invoice.id,
        Invoice.total_amount.isnot(None),
    ).all()

    if len(historical_invoices) < FraudConfig.MIN_VENDOR_HISTORY:
        # Not enough history for reliable analysis
        return flags

    amounts = [float(inv.total_amount) for inv in historical_invoices]
    
    if not amounts:
        return flags

    # Calculate statistics
    import statistics
    mean_amount = statistics.mean(amounts)
    
    if len(amounts) >= 2:
        std_dev = statistics.stdev(amounts)
    else:
        std_dev = 0

    current_amount = float(invoice.total_amount)

    # Check for sudden spike (significantly higher than average)
    if mean_amount > 0:
        multiplier = current_amount / mean_amount
        if multiplier >= 3.0:
            flags.append(
                FraudFlag(
                    code="VENDOR_AMOUNT_SPIKE",
                    severity=Severity.MEDIUM,
                    message=(
                        f"Invoice amount is {multiplier:.1f}x higher than "
                        f"vendor's average ({mean_amount:.2f})"
                    ),
                    evidence={
                        "vendor_id": invoice.vendor_id,
                        "current_amount": str(invoice.total_amount),
                        "average_amount": round(mean_amount, 2),
                        "multiplier": round(multiplier, 2),
                        "historical_invoice_count": len(amounts),
                    },
                    field_name="total_amount",
                )
            )

    # VENDOR_ESCALATING_AMOUNTS removed — consistently increasing amounts
    # simply reflect normal business growth and caused constant false positives.

    return flags


def get_vendor_risk_profile(db: Session, vendor_id: int) -> dict:
    """
    Get comprehensive risk profile for a vendor.
    
    Args:
        db: Database session
        vendor_id: Vendor ID
        
    Returns:
        Dict with vendor risk profile
    """
    stats = _get_vendor_invoice_stats(db, vendor_id)
    
    vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    vendor_name = vendor.name if vendor else "Unknown"

    # Calculate risk level
    risk_factors = 0
    if stats["is_new_vendor"]:
        risk_factors += 1
    if stats["rejection_rate"] > FraudConfig.HIGH_REJECTION_RATE_THRESHOLD:
        risk_factors += 2

    if risk_factors >= 2:
        risk_level = "HIGH"
    elif risk_factors == 1:
        risk_level = "MEDIUM"
    else:
        risk_level = "LOW"

    return {
        "vendor_id": vendor_id,
        "vendor_name": vendor_name,
        "risk_level": risk_level,
        "total_invoices": stats["total_invoices"],
        "rejection_rate": stats["rejection_rate"],
        "average_amount": stats["average_amount"],
        "is_new_vendor": stats["is_new_vendor"],
    }
