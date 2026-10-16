from datetime import timedelta
from decimal import Decimal
from typing import Optional
import statistics

from sqlalchemy.orm import Session

from app.fraud.config import FraudConfig
from app.fraud.models import FraudFlag, Severity
from app.models.invoice import Invoice


def detect_amount_anomaly(db: Session, invoice: Invoice) -> Optional[FraudFlag]:
    if not invoice.vendor_id or not invoice.total_amount:
        return None

    historical_invoices = db.query(Invoice).filter(
        Invoice.vendor_id == invoice.vendor_id,
        Invoice.id != invoice.id,
        Invoice.total_amount.isnot(None),
    ).all()

    if len(historical_invoices) < FraudConfig.MIN_VENDOR_HISTORY:
        return None

    amounts = [float(inv.total_amount) for inv in historical_invoices]

    if len(amounts) < 2:
        return None

    mean_amount = statistics.mean(amounts)
    std_dev = statistics.stdev(amounts)

    if std_dev == 0:
        if float(invoice.total_amount) != mean_amount:
            return FraudFlag(
                code="AMOUNT_ANOMALY_UNIFORM",
                severity=Severity.MEDIUM,
                message=(
                    f"Amount deviates from vendor's consistent pattern "
                    f"(all previous invoices were {mean_amount:.2f})"
                ),
                evidence={
                    "current_amount": str(invoice.total_amount),
                    "historical_amount": mean_amount,
                    "deviation": "uniform_pattern_broken",
                },
                field_name="total_amount",
            )
        return None

    current_amount = float(invoice.total_amount)
    z_score = (current_amount - mean_amount) / std_dev

    # Use 3.0 standard deviations — the standard statistical threshold for
    # genuine outliers. 2.0 was far too aggressive (flags ~5% of normal data).
    threshold = FraudConfig.ANOMALY_STD_DEV_MULTIPLIER

    if abs(z_score) > threshold:
        severity = Severity.HIGH if abs(z_score) > threshold * 1.5 else Severity.MEDIUM

        return FraudFlag(
            code="AMOUNT_STATISTICAL_ANOMALY",
            severity=severity,
            message=(
                f"Amount is {abs(z_score):.1f} standard deviations from "
                f"vendor's average ({mean_amount:.2f} ± {std_dev:.2f})"
            ),
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


def detect_rapid_submission(db: Session, invoice: Invoice) -> Optional[FraudFlag]:
    if not invoice.vendor_id or not invoice.created_at:
        return None

    window_start = invoice.created_at - timedelta(
        minutes=FraudConfig.RAPID_SUBMISSION_WINDOW_MINUTES
    )

    rapid_count = db.query(Invoice).filter(
        Invoice.vendor_id == invoice.vendor_id,
        Invoice.created_at >= window_start,
        Invoice.created_at <= invoice.created_at,
    ).count()

    if rapid_count >= FraudConfig.RAPID_SUBMISSION_COUNT:
        return FraudFlag(
            code="RAPID_INVOICE_SUBMISSION",
            severity=Severity.MEDIUM,
            message=(
                f"{rapid_count} invoices submitted from this vendor "
                f"within {FraudConfig.RAPID_SUBMISSION_WINDOW_MINUTES} minutes"
            ),
            evidence={
                "invoice_count": rapid_count,
                "time_window_minutes": FraudConfig.RAPID_SUBMISSION_WINDOW_MINUTES,
                "vendor_id": invoice.vendor_id,
            },
            field_name="created_at",
        )

    return None


def detect_amount_just_below_threshold(invoice: Invoice) -> Optional[FraudFlag]:
    if not invoice.total_amount:
        return None

    amount = float(invoice.total_amount)

    # Only flag if amount is within 2% below a threshold (was 5% — too broad).
    # Common approval thresholds in INR.
    thresholds = [50000, 100000, 500000, 1000000]
    tolerance = 0.02

    for threshold in thresholds:
        lower_bound = threshold * (1 - tolerance)
        if lower_bound <= amount < threshold:
            return FraudFlag(
                code="AMOUNT_BELOW_THRESHOLD",
                severity=Severity.MEDIUM,
                message=(
                    f"Amount ({amount:.2f}) is just below an approval threshold "
                    f"({threshold:,}) — possible invoice splitting"
                ),
                evidence={
                    "amount": str(invoice.total_amount),
                    "threshold": threshold,
                    "percentage_of_threshold": round((amount / threshold) * 100, 1),
                },
                field_name="total_amount",
            )

    return None
