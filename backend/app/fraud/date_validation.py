from datetime import date, timedelta
from typing import Optional

from app.fraud.config import FraudConfig
from app.fraud.models import FraudFlag, Severity
from app.models.invoice import Invoice


def check_future_date(invoice: Invoice) -> Optional[FraudFlag]:
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
    if not invoice.invoice_date or not invoice.created_at:
        return None

    upload_date = invoice.created_at.date()
    age_days = (upload_date - invoice.invoice_date).days

    if age_days > FraudConfig.MAX_INVOICE_AGE_DAYS:
        return FraudFlag(
            code="VERY_OLD_INVOICE",
            severity=Severity.MEDIUM,
            message=(
                f"Invoice is {age_days} days old "
                f"(dated {invoice.invoice_date}, uploaded {upload_date})"
            ),
            evidence={
                "invoice_date": invoice.invoice_date.isoformat(),
                "upload_date": upload_date.isoformat(),
                "age_days": age_days,
                "max_allowed_days": FraudConfig.MAX_INVOICE_AGE_DAYS,
            },
            field_name="invoice_date",
        )
    return None


def check_due_date_anomaly(invoice: Invoice) -> Optional[FraudFlag]:
    if not invoice.invoice_date or not invoice.due_date:
        return None

    if invoice.due_date < invoice.invoice_date:
        return FraudFlag(
            code="DUE_DATE_BEFORE_INVOICE",
            severity=Severity.HIGH,
            message=(
                f"Due date ({invoice.due_date}) is before "
                f"invoice date ({invoice.invoice_date})"
            ),
            evidence={
                "invoice_date": invoice.invoice_date.isoformat(),
                "due_date": invoice.due_date.isoformat(),
                "days_difference": (invoice.invoice_date - invoice.due_date).days,
            },
            field_name="due_date",
        )

    payment_terms_days = (invoice.due_date - invoice.invoice_date).days

    # Unusually long payment terms > 180 days is a mild signal
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


def check_back_dated_invoice(invoice: Invoice) -> Optional[FraudFlag]:
    """
    Flag invoices uploaded significantly BEFORE their stated date.
    A 30-day window is allowed — it is completely normal to upload an
    invoice from last month. Only flag if the invoice claims a future
    date more than 1 day ahead of the upload date (genuine back-dating).
    """
    if not invoice.invoice_date or not invoice.created_at:
        return None

    upload_date = invoice.created_at.date()

    # Invoice date is more than 1 day AFTER upload date — date is fabricated
    if invoice.invoice_date > upload_date:
        days_ahead = (invoice.invoice_date - upload_date).days
        if days_ahead > 1:
            return FraudFlag(
                code="BACK_DATED_INVOICE",
                severity=Severity.MEDIUM,
                message=(
                    f"Invoice date ({invoice.invoice_date}) is {days_ahead} day(s) "
                    f"after upload date ({upload_date}) — possible post-dating"
                ),
                evidence={
                    "upload_date": upload_date.isoformat(),
                    "invoice_date": invoice.invoice_date.isoformat(),
                    "days_ahead": days_ahead,
                },
                field_name="invoice_date",
            )

    return None


# weekend_invoice, first_day_high_value, repeating_date_pattern removed —
# all produced constant false positives on legitimate invoices:
#   - Invoices dated on weekends are common (automated billing runs on any day)
#   - Month-start invoices are the norm for recurring services
#   - Day==month dates (e.g. Jan 1, Feb 2) are trivially common
def check_weekend_invoice(invoice: Invoice) -> Optional[FraudFlag]:
    return None


def check_suspicious_date_pattern(invoice: Invoice) -> Optional[FraudFlag]:
    return None
