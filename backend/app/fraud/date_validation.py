"""
Date and Pattern Validation

Validates invoice dates and detects suspicious temporal patterns.
"""

from datetime import datetime, date, timedelta
from typing import Optional

from app.fraud.config import FraudConfig
from app.fraud.models import FraudFlag, Severity
from app.models.invoice import Invoice


def check_future_date(invoice: Invoice) -> Optional[FraudFlag]:
    """
    Check if invoice date is in the future.
    
    Args:
        invoice: Invoice to check
        
    Returns:
        FraudFlag if future date detected, None otherwise
    """
    if not invoice.invoice_date:
        return None

    today = date.today()

    if invoice.invoice_date > today:
        days_future = (invoice.invoice_date - today).days
        
        return FraudFlag(
            code="FUTURE_INVOICE_DATE",
            severity=Severity.HIGH,
            message=f"Invoice date ({invoice.invoice_date}) is {days_future} day(s) in the future",
            evidence={
                "invoice_date": invoice.invoice_date.isoformat(),
                "current_date": today.isoformat(),
                "days_in_future": days_future,
            },
            field_name="invoice_date",
        )

    return None


def check_very_old_invoice(invoice: Invoice) -> Optional[FraudFlag]:
    """
    Check if invoice is very old (being submitted long after creation).
    
    Args:
        invoice: Invoice to check
        
    Returns:
        FraudFlag if very old invoice detected, None otherwise
    """
    if not invoice.invoice_date or not invoice.created_at:
        return None

    # Compare invoice date with upload date
    upload_date = invoice.created_at.date()
    invoice_date = invoice.invoice_date

    age_days = (upload_date - invoice_date).days

    if age_days > FraudConfig.MAX_INVOICE_AGE_DAYS:
        return FraudFlag(
            code="VERY_OLD_INVOICE",
            severity=Severity.MEDIUM,
            message=f"Invoice is {age_days} days old (dated {invoice_date}, "
                    f"uploaded {upload_date})",
            evidence={
                "invoice_date": invoice_date.isoformat(),
                "upload_date": upload_date.isoformat(),
                "age_days": age_days,
                "max_allowed_days": FraudConfig.MAX_INVOICE_AGE_DAYS,
            },
            field_name="invoice_date",
        )

    return None


def check_due_date_anomaly(invoice: Invoice) -> Optional[FraudFlag]:
    """
    Check for suspicious due date patterns.
    
    Args:
        invoice: Invoice to check
        
    Returns:
        FraudFlag if due date anomaly detected, None otherwise
    """
    if not invoice.invoice_date or not invoice.due_date:
        return None

    # Due date should be after invoice date
    if invoice.due_date < invoice.invoice_date:
        return FraudFlag(
            code="DUE_DATE_BEFORE_INVOICE",
            severity=Severity.HIGH,
            message=f"Due date ({invoice.due_date}) is before invoice date "
                    f"({invoice.invoice_date})",
            evidence={
                "invoice_date": invoice.invoice_date.isoformat(),
                "due_date": invoice.due_date.isoformat(),
                "days_difference": (invoice.invoice_date - invoice.due_date).days,
            },
            field_name="due_date",
        )

    # Check for unusually short payment terms (< 1 day)
    payment_terms_days = (invoice.due_date - invoice.invoice_date).days
    
    if payment_terms_days < 1:
        return FraudFlag(
            code="IMMEDIATE_PAYMENT_TERMS",
            severity=Severity.LOW,
            message=f"Invoice has same-day payment terms (invoice: {invoice.invoice_date}, "
                    f"due: {invoice.due_date})",
            evidence={
                "invoice_date": invoice.invoice_date.isoformat(),
                "due_date": invoice.due_date.isoformat(),
                "payment_terms_days": payment_terms_days,
            },
            field_name="due_date",
        )

    # Check for unusually long payment terms (> 180 days)
    if payment_terms_days > 180:
        return FraudFlag(
            code="EXTENDED_PAYMENT_TERMS",
            severity=Severity.LOW,
            message=f"Invoice has unusually long payment terms ({payment_terms_days} days)",
            evidence={
                "invoice_date": invoice.invoice_date.isoformat(),
                "due_date": invoice.due_date.isoformat(),
                "payment_terms_days": payment_terms_days,
            },
            field_name="due_date",
        )

    return None


def check_weekend_invoice(invoice: Invoice) -> Optional[FraudFlag]:
    """
    Check if invoice is dated on a weekend.
    
    This is informational - not necessarily fraudulent but unusual.
    
    Args:
        invoice: Invoice to check
        
    Returns:
        FraudFlag if weekend date detected, None otherwise
    """
    if not invoice.invoice_date:
        return None

    # 5 = Saturday, 6 = Sunday
    if invoice.invoice_date.weekday() in [5, 6]:
        day_name = invoice.invoice_date.strftime("%A")
        
        return FraudFlag(
            code="WEEKEND_INVOICE_DATE",
            severity=Severity.INFO,
            message=f"Invoice is dated on a weekend ({day_name}, {invoice.invoice_date})",
            evidence={
                "invoice_date": invoice.invoice_date.isoformat(),
                "day_of_week": day_name,
            },
            field_name="invoice_date",
        )

    return None


def check_back_dated_invoice(invoice: Invoice) -> Optional[FraudFlag]:
    """
    Check if invoice appears to be back-dated.
    
    An invoice created/uploaded significantly before the invoice date
    is unusual and potentially fraudulent.
    
    Args:
        invoice: Invoice to check
        
    Returns:
        FraudFlag if back-dating detected, None otherwise
    """
    if not invoice.invoice_date or not invoice.created_at:
        return None

    upload_date = invoice.created_at.date()
    invoice_date = invoice.invoice_date

    # If upload date is before invoice date by more than 1 day
    if upload_date < invoice_date:
        days_before = (invoice_date - upload_date).days
        
        if days_before > 1:
            return FraudFlag(
                code="BACK_DATED_INVOICE",
                severity=Severity.MEDIUM,
                message=f"Invoice uploaded {days_before} day(s) before its stated date "
                        f"(uploaded: {upload_date}, invoice date: {invoice_date})",
                evidence={
                    "upload_date": upload_date.isoformat(),
                    "invoice_date": invoice_date.isoformat(),
                    "days_before": days_before,
                },
                field_name="invoice_date",
            )

    return None


def check_suspicious_date_pattern(invoice: Invoice) -> Optional[FraudFlag]:
    """
    Check for suspicious date patterns like repeating numbers.
    
    Args:
        invoice: Invoice to check
        
    Returns:
        FraudFlag if suspicious pattern detected, None otherwise
    """
    if not invoice.invoice_date:
        return None

    # Check for dates like 11/11/2023, 22/02/2022, etc.
    day = invoice.invoice_date.day
    month = invoice.invoice_date.month
    year = invoice.invoice_date.year

    # Check if day and month are the same
    if day == month:
        return FraudFlag(
            code="REPEATING_DATE_PATTERN",
            severity=Severity.INFO,
            message=f"Invoice date has repeating pattern (day={day}, month={month})",
            evidence={
                "invoice_date": invoice.invoice_date.isoformat(),
                "pattern": "day_equals_month",
            },
            field_name="invoice_date",
        )

    # Check for dates on 1st or last day of month (sometimes used for fabricated invoices)
    if day == 1 and invoice.total_amount and invoice.total_amount >= 50000:
        return FraudFlag(
            code="FIRST_DAY_HIGH_VALUE",
            severity=Severity.INFO,
            message=f"High-value invoice dated on first day of month",
            evidence={
                "invoice_date": invoice.invoice_date.isoformat(),
                "day": day,
                "amount": str(invoice.total_amount),
            },
            field_name="invoice_date",
        )

    return None
