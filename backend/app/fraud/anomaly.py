"""
Amount Anomaly Detection

Detects anomalous amounts and suspicious patterns using statistical methods.
"""

from datetime import datetime, timedelta
from decimal import Decimal
from typing import List, Optional
import statistics

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.fraud.config import FraudConfig
from app.fraud.models import FraudFlag, Severity
from app.models.invoice import Invoice


def detect_amount_anomaly(db: Session, invoice: Invoice) -> Optional[FraudFlag]:
    """
    Detect statistical anomalies in invoice amount compared to vendor history.
    
    Uses standard deviation to identify outlier amounts.
    
    Args:
        db: Database session
        invoice: Invoice to analyze
        
    Returns:
        FraudFlag if anomaly detected, None otherwise
    """
    if not invoice.vendor_id or not invoice.total_amount:
        return None

    # Get vendor's historical amounts
    historical_invoices = db.query(Invoice).filter(
        Invoice.vendor_id == invoice.vendor_id,
        Invoice.id != invoice.id,
        Invoice.total_amount.isnot(None),
    ).all()

    if len(historical_invoices) < FraudConfig.MIN_VENDOR_HISTORY:
        # Not enough history for statistical analysis
        return None

    amounts = [float(inv.total_amount) for inv in historical_invoices]
    
    if len(amounts) < 2:
        return None

    # Calculate mean and standard deviation
    mean_amount = statistics.mean(amounts)
    std_dev = statistics.stdev(amounts)

    if std_dev == 0:
        # All amounts are the same - any different amount is anomalous
        if float(invoice.total_amount) != mean_amount:
            return FraudFlag(
                code="AMOUNT_ANOMALY_UNIFORM",
                severity=Severity.MEDIUM,
                message=f"Amount deviates from vendor's consistent pattern "
                        f"(all previous invoices were ₹{mean_amount:.2f})",
                evidence={
                    "current_amount": str(invoice.total_amount),
                    "historical_amount": mean_amount,
                    "deviation": "uniform_pattern_broken",
                },
                field_name="total_amount",
            )
        return None

    current_amount = float(invoice.total_amount)
    
    # Calculate z-score (number of standard deviations from mean)
    z_score = (current_amount - mean_amount) / std_dev

    threshold = FraudConfig.ANOMALY_STD_DEV_MULTIPLIER
    
    if abs(z_score) > threshold:
        severity = Severity.MEDIUM
        if abs(z_score) > threshold * 1.5:  # 3 std devs
            severity = Severity.HIGH

        return FraudFlag(
            code="AMOUNT_STATISTICAL_ANOMALY",
            severity=severity,
            message=f"Amount is {abs(z_score):.1f} standard deviations from "
                    f"vendor's average (₹{mean_amount:.2f} ± ₹{std_dev:.2f})",
            evidence={
                "current_amount": str(invoice.total_amount),
                "mean_amount": round(mean_amount, 2),
                "std_dev": round(std_dev, 2),
                "z_score": round(z_score, 2),
                "threshold": threshold,
                "historical_count": len(amounts),
            },
            field_name="total_amount",
        )

    return None


def detect_round_number(invoice: Invoice) -> Optional[FraudFlag]:
    """
    Detect suspiciously round numbers that may indicate fabricated invoices.
    
    Args:
        invoice: Invoice to analyze
        
    Returns:
        FraudFlag if suspicious round number detected, None otherwise
    """
    if not invoice.total_amount:
        return None

    amount = invoice.total_amount
    
    # Check for exact thousands (e.g., 10000.00, 50000.00)
    if amount % 1000 == 0 and amount >= 5000:
        severity = Severity.LOW
        
        # Very round numbers (10k, 50k, 100k) are more suspicious
        if amount >= 10000 and amount % 10000 == 0:
            severity = Severity.MEDIUM

        return FraudFlag(
            code="SUSPICIOUSLY_ROUND_AMOUNT",
            severity=severity,
            message=f"Invoice amount (₹{amount}) is a suspiciously round number",
            evidence={
                "amount": str(amount),
                "divisible_by": 10000 if amount % 10000 == 0 else 1000,
                "note": "Round numbers may indicate fabricated invoices",
            },
            field_name="total_amount",
        )

    # Check for repeating digits (e.g., 11111.00, 22222.00)
    amount_str = str(int(amount))
    if len(amount_str) >= 4:
        # Check if all digits are the same
        if len(set(amount_str)) == 1:
            return FraudFlag(
                code="REPEATING_DIGIT_AMOUNT",
                severity=Severity.MEDIUM,
                message=f"Invoice amount (₹{amount}) has repeating digits pattern",
                evidence={
                    "amount": str(amount),
                    "pattern": "all_same_digit",
                },
                field_name="total_amount",
            )

    return None


def detect_rapid_submission(db: Session, invoice: Invoice) -> Optional[FraudFlag]:
    """
    Detect rapid submission of multiple invoices from same vendor.
    
    Args:
        db: Database session
        invoice: Invoice to analyze
        
    Returns:
        FraudFlag if rapid submission detected, None otherwise
    """
    if not invoice.vendor_id or not invoice.created_at:
        return None

    # Get time window
    window_start = invoice.created_at - timedelta(
        minutes=FraudConfig.RAPID_SUBMISSION_WINDOW_MINUTES
    )

    # Count invoices from same vendor in the window
    rapid_invoices = db.query(Invoice).filter(
        Invoice.vendor_id == invoice.vendor_id,
        Invoice.created_at >= window_start,
        Invoice.created_at <= invoice.created_at,
    ).count()

    if rapid_invoices >= FraudConfig.RAPID_SUBMISSION_COUNT:
        return FraudFlag(
            code="RAPID_INVOICE_SUBMISSION",
            severity=Severity.MEDIUM,
            message=f"{rapid_invoices} invoices submitted from this vendor "
                    f"within {FraudConfig.RAPID_SUBMISSION_WINDOW_MINUTES} minutes",
            evidence={
                "invoice_count": rapid_invoices,
                "time_window_minutes": FraudConfig.RAPID_SUBMISSION_WINDOW_MINUTES,
                "vendor_id": invoice.vendor_id,
            },
            field_name="created_at",
        )

    return None


def detect_sequential_amounts(db: Session, invoice: Invoice) -> Optional[FraudFlag]:
    """
    Detect if invoice amounts follow a suspicious sequential pattern.
    
    Args:
        db: Database session
        invoice: Invoice to analyze
        
    Returns:
        FraudFlag if sequential pattern detected, None otherwise
    """
    if not invoice.vendor_id or not invoice.total_amount:
        return None

    # Get recent invoices from vendor
    recent_invoices = db.query(Invoice).filter(
        Invoice.vendor_id == invoice.vendor_id,
        Invoice.total_amount.isnot(None),
    ).order_by(Invoice.created_at.desc()).limit(10).all()

    if len(recent_invoices) < 5:
        return None

    amounts = [float(inv.total_amount) for inv in recent_invoices]
    
    # Check if amounts increase by a constant amount
    differences = [amounts[i] - amounts[i+1] for i in range(len(amounts) - 1)]
    
    if len(set(differences)) == 1 and differences[0] != 0:
        # All differences are the same (arithmetic sequence)
        return FraudFlag(
            code="SEQUENTIAL_AMOUNT_PATTERN",
            severity=Severity.LOW,
            message="Invoice amounts follow a suspicious arithmetic sequence",
            evidence={
                "pattern": "arithmetic_sequence",
                "constant_difference": round(differences[0], 2),
                "sample_amounts": [round(a, 2) for a in amounts[:5]],
            },
            field_name="total_amount",
        )

    return None


def detect_amount_just_below_threshold(invoice: Invoice) -> Optional[FraudFlag]:
    """
    Detect amounts just below approval thresholds (possible splitting fraud).
    
    Common thresholds: ₹50,000, ₹1,00,000, ₹5,00,000
    
    Args:
        invoice: Invoice to analyze
        
    Returns:
        FraudFlag if suspicious threshold avoidance detected, None otherwise
    """
    if not invoice.total_amount:
        return None

    amount = float(invoice.total_amount)
    
    # Common approval thresholds in INR
    thresholds = [50000, 100000, 500000, 1000000]
    
    # Check if amount is suspiciously close to just below a threshold
    # (within 5% below the threshold)
    for threshold in thresholds:
        lower_bound = threshold * 0.95
        if lower_bound <= amount < threshold:
            return FraudFlag(
                code="AMOUNT_BELOW_THRESHOLD",
                severity=Severity.MEDIUM,
                message=f"Amount (₹{amount:.2f}) is just below approval threshold "
                        f"(₹{threshold:,}) - possible splitting fraud",
                evidence={
                    "amount": str(invoice.total_amount),
                    "threshold": threshold,
                    "percentage_of_threshold": round((amount / threshold) * 100, 1),
                },
                field_name="total_amount",
            )

    return None
