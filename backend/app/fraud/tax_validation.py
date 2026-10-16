"""
GST/Tax Validation

Validates tax calculations and detects tax-related fraud patterns.
"""

from decimal import Decimal
from typing import Optional

from sqlalchemy.orm import Session

from app.fraud.config import FraudConfig
from app.fraud.models import FraudFlag, Severity
from app.models.invoice import Invoice


def validate_gst_rate(invoice: Invoice) -> Optional[FraudFlag]:
    """
    Validate if the GST rate matches standard rates.
    
    Args:
        invoice: Invoice to validate
        
    Returns:
        FraudFlag if invalid GST rate detected, None otherwise
    """
    if not invoice.subtotal or not invoice.tax or invoice.subtotal == 0:
        return None

    # Calculate effective tax rate
    tax_rate = float(invoice.tax / invoice.subtotal)

    # Check against valid GST rates
    valid_rates = FraudConfig.VALID_GST_RATES
    
    # Allow 1.5% tolerance — many invoices have composite rates or
    # mixed-rate line items that don't land exactly on standard slabs.
    tolerance = 0.015

    is_valid = any(
        abs(tax_rate - valid_rate) < tolerance
        for valid_rate in valid_rates
    )

    if not is_valid:
        closest_rate = min(valid_rates, key=lambda x: abs(x - tax_rate))
        return FraudFlag(
            code="INVALID_GST_RATE",
            severity=Severity.MEDIUM,
            message=(
                f"Tax rate ({tax_rate * 100:.2f}%) does not match standard GST rates. "
                f"Closest valid rate: {closest_rate * 100:.0f}%"
            ),
            evidence={
                "calculated_tax_rate": round(tax_rate * 100, 2),
                "valid_gst_rates": [r * 100 for r in valid_rates],
                "closest_valid_rate": closest_rate * 100,
                "subtotal": str(invoice.subtotal),
                "tax": str(invoice.tax),
            },
            field_name="tax",
        )

    return None


def validate_tax_calculation(invoice: Invoice) -> Optional[FraudFlag]:
    """
    Validate that tax calculation is correct (tax = subtotal × rate).
    
    Args:
        invoice: Invoice to validate
        
    Returns:
        FraudFlag if tax calculation is incorrect, None otherwise
    """
    if not invoice.subtotal or not invoice.tax or not invoice.total_amount:
        return None

    # Calculate expected total
    expected_total = invoice.subtotal + invoice.tax
    actual_total = invoice.total_amount

    tolerance = FraudConfig.TAX_CALCULATION_TOLERANCE

    if abs(expected_total - actual_total) > tolerance:
        # Determine severity based on difference size
        diff = abs(expected_total - actual_total)
        if diff <= 5:
            sev = Severity.LOW      # small rounding difference
        elif diff <= 50:
            sev = Severity.MEDIUM
        else:
            sev = Severity.HIGH

        return FraudFlag(
            code="TAX_CALCULATION_MISMATCH",
            severity=sev,
            message=f"Tax calculation error: subtotal (₹{invoice.subtotal}) + "
                    f"tax (₹{invoice.tax}) = ₹{expected_total}, "
                    f"but total is ₹{actual_total}",
            evidence={
                "subtotal": str(invoice.subtotal),
                "tax": str(invoice.tax),
                "expected_total": str(expected_total),
                "actual_total": str(actual_total),
                "difference": str(abs(expected_total - actual_total)),
            },
            field_name="total_amount",
        )

    # Also validate that tax is correctly calculated from subtotal
    if invoice.subtotal > 0:
        tax_rate = invoice.tax / invoice.subtotal
        expected_tax = invoice.subtotal * tax_rate
        
        if abs(expected_tax - invoice.tax) > tolerance:
            return FraudFlag(
                code="TAX_AMOUNT_INCONSISTENT",
                severity=Severity.MEDIUM,
                message=f"Tax amount (₹{invoice.tax}) is inconsistent with "
                        f"subtotal and calculated rate",
                evidence={
                    "subtotal": str(invoice.subtotal),
                    "stated_tax": str(invoice.tax),
                    "calculated_tax": str(round(expected_tax, 2)),
                    "tax_rate": round(float(tax_rate) * 100, 2),
                },
                field_name="tax",
            )

    return None


def check_missing_tax(invoice: Invoice) -> Optional[FraudFlag]:
    # 0% GST is legal for many categories (exports, exempt goods, small vendors).
    # Flagging zero-tax invoices was a constant false positive.
    return None


def check_tax_rate_deviation(db: Session, invoice: Invoice) -> Optional[FraudFlag]:
    """
    Check if tax rate deviates from vendor's historical pattern.
    
    Args:
        db: Database session
        invoice: Invoice to check
        
    Returns:
        FraudFlag if tax rate deviation detected, None otherwise
    """
    if not invoice.vendor_id or not invoice.subtotal or not invoice.tax:
        return None

    if invoice.subtotal == 0:
        return None

    current_tax_rate = float(invoice.tax / invoice.subtotal)

    # Get vendor's historical tax rates
    historical_invoices = db.query(Invoice).filter(
        Invoice.vendor_id == invoice.vendor_id,
        Invoice.id != invoice.id,
        Invoice.subtotal.isnot(None),
        Invoice.tax.isnot(None),
        Invoice.subtotal > 0,
    ).all()

    if len(historical_invoices) < 3:
        # Not enough history
        return None

    # Calculate historical tax rates
    historical_rates = [
        float(inv.tax / inv.subtotal)
        for inv in historical_invoices
    ]

    # Find most common rate
    from collections import Counter
    
    # Round rates to nearest 0.01 for grouping
    rounded_rates = [round(r, 2) for r in historical_rates]
    rate_counts = Counter(rounded_rates)
    
    if not rate_counts:
        return None

    most_common_rate, count = rate_counts.most_common(1)[0]

    # If current rate differs from vendor's usual rate
    if abs(current_tax_rate - most_common_rate) > 0.02:  # 2% tolerance
        return FraudFlag(
            code="TAX_RATE_DEVIATION",
            severity=Severity.MEDIUM,
            message=f"Tax rate ({current_tax_rate * 100:.1f}%) differs from "
                    f"vendor's typical rate ({most_common_rate * 100:.1f}%)",
            evidence={
                "current_tax_rate": round(current_tax_rate * 100, 2),
                "typical_tax_rate": round(most_common_rate * 100, 2),
                "historical_invoice_count": len(historical_invoices),
                "typical_rate_frequency": count,
            },
            field_name="tax",
        )

    return None


def check_excessive_tax(invoice: Invoice) -> Optional[FraudFlag]:
    """
    Check for unreasonably high tax amounts.
    
    Args:
        invoice: Invoice to check
        
    Returns:
        FraudFlag if excessive tax detected, None otherwise
    """
    if not invoice.subtotal or not invoice.tax:
        return None

    if invoice.subtotal == 0:
        return None

    tax_rate = float(invoice.tax / invoice.subtotal)

    # In India, maximum GST rate is 28%
    # Flag if tax exceeds 35% (allowing some margin for error)
    if tax_rate > 0.35:
        return FraudFlag(
            code="EXCESSIVE_TAX_RATE",
            severity=Severity.HIGH,
            message=f"Tax rate ({tax_rate * 100:.1f}%) exceeds maximum "
                    f"expected rate (35%)",
            evidence={
                "tax_rate": round(tax_rate * 100, 2),
                "subtotal": str(invoice.subtotal),
                "tax": str(invoice.tax),
                "max_expected_rate": 35,
            },
            field_name="tax",
        )

    return None
