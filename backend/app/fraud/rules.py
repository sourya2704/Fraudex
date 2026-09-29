from dataclasses import dataclass, field
from decimal import Decimal

from sqlalchemy.orm import Session

from app.models.invoice import Invoice
from app.models.vendor import Vendor


_UNUSUAL_AMOUNT_MULTIPLIER = Decimal("3")
_MIN_HISTORY_FOR_AMOUNT_CHECK = 3
_AMOUNT_TOLERANCE = Decimal("0.05")


class Severity:
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


@dataclass
class FraudSignal:
    rule: str
    severity: str
    message: str
    detail: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "rule": self.rule,
            "severity": self.severity,
            "message": self.message,
            "detail": self.detail,
        }


@dataclass
class FraudReport:
    invoice_id: int
    signals: list = field(default_factory=list)

    def add(self, rule, severity, message, detail=None):
        self.signals.append(
            FraudSignal(rule, severity, message, detail or {})
        )

    def to_dict(self) -> dict:
        counts = {Severity.HIGH: 0, Severity.MEDIUM: 0, Severity.LOW: 0}
        for s in self.signals:
            counts[s.severity] = counts.get(s.severity, 0) + 1
        return {
            "invoice_id": self.invoice_id,
            "signal_count": len(self.signals),
            "high": counts[Severity.HIGH],
            "medium": counts[Severity.MEDIUM],
            "low": counts[Severity.LOW],
            "signals": [s.to_dict() for s in self.signals],
            "note": (
                "These are deterministic fraud indicators intended to support "
                "a human reviewer. They are not a determination of fraud."
            ),
        }


def _check_missing_key_fields(invoice: Invoice, report: FraudReport) -> None:
    if not invoice.invoice_number:
        report.add(
            "MISSING_INVOICE_NUMBER",
            Severity.MEDIUM,
            "Invoice has no invoice number",
        )
    if invoice.vendor_id is None:
        report.add(
            "MISSING_VENDOR",
            Severity.MEDIUM,
            "Invoice is not linked to a vendor",
        )


def _check_duplicate_invoice_number(
    db: Session, invoice: Invoice, report: FraudReport
) -> None:
    if not invoice.invoice_number or invoice.vendor_id is None:
        return
    match = (
        db.query(Invoice)
        .filter(
            Invoice.vendor_id == invoice.vendor_id,
            Invoice.invoice_number == invoice.invoice_number,
            Invoice.id != invoice.id,
        )
        .first()
    )
    if match:
        report.add(
            "DUPLICATE_INVOICE_NUMBER",
            Severity.HIGH,
            "Another invoice with the same number exists for this vendor",
            {"matching_invoice_id": match.id},
        )


def _check_near_duplicate(
    db: Session, invoice: Invoice, report: FraudReport
) -> None:
    if invoice.vendor_id is None or invoice.total_amount is None:
        return
    query = db.query(Invoice).filter(
        Invoice.vendor_id == invoice.vendor_id,
        Invoice.total_amount == invoice.total_amount,
        Invoice.id != invoice.id,
    )
    if invoice.invoice_date is not None:
        query = query.filter(Invoice.invoice_date == invoice.invoice_date)
    match = query.first()
    if match:
        report.add(
            "NEAR_DUPLICATE",
            Severity.HIGH,
            "Another invoice with the same vendor, amount, and date exists",
            {"matching_invoice_id": match.id},
        )


def _check_unusual_amount(
    db: Session, invoice: Invoice, report: FraudReport
) -> None:
    if invoice.vendor_id is None or invoice.total_amount is None:
        return
    history = (
        db.query(Invoice.total_amount)
        .filter(
            Invoice.vendor_id == invoice.vendor_id,
            Invoice.id != invoice.id,
            Invoice.total_amount.isnot(None),
        )
        .all()
    )
    amounts = [row[0] for row in history if row[0] is not None]
    if len(amounts) < _MIN_HISTORY_FOR_AMOUNT_CHECK:
        return
    average = sum(amounts) / Decimal(len(amounts))
    if average > 0 and invoice.total_amount > average * _UNUSUAL_AMOUNT_MULTIPLIER:
        report.add(
            "UNUSUAL_AMOUNT",
            Severity.MEDIUM,
            "Invoice total is much higher than this vendor's typical amount",
            {
                "invoice_total": str(invoice.total_amount),
                "vendor_average": str(round(average, 2)),
                "history_count": len(amounts),
            },
        )


def _check_tax_total_consistency(invoice: Invoice, report: FraudReport) -> None:
    if (
        invoice.subtotal is not None
        and invoice.tax is not None
        and invoice.total_amount is not None
    ):
        expected = invoice.subtotal + invoice.tax
        if abs(expected - invoice.total_amount) > _AMOUNT_TOLERANCE:
            report.add(
                "TAX_TOTAL_INCONSISTENCY",
                Severity.HIGH,
                "Subtotal plus tax does not equal the stated total",
                {
                    "subtotal": str(invoice.subtotal),
                    "tax": str(invoice.tax),
                    "expected_total": str(expected),
                    "stated_total": str(invoice.total_amount),
                },
            )


def _check_new_vendor(
    db: Session, invoice: Invoice, report: FraudReport
) -> None:
    if invoice.vendor_id is None:
        return
    vendor = db.query(Vendor).filter(Vendor.id == invoice.vendor_id).first()
    if vendor is None:
        return
    prior_count = (
        db.query(Invoice)
        .filter(
            Invoice.vendor_id == invoice.vendor_id,
            Invoice.id != invoice.id,
        )
        .count()
    )
    if prior_count == 0:
        report.add(
            "NEW_VENDOR",
            Severity.LOW,
            "This is the first invoice recorded for this vendor",
            {"vendor_id": vendor.id},
        )


def run_fraud_checks(db: Session, invoice: Invoice) -> FraudReport:
    report = FraudReport(invoice_id=invoice.id)
    _check_missing_key_fields(invoice, report)
    _check_duplicate_invoice_number(db, invoice, report)
    _check_near_duplicate(db, invoice, report)
    _check_unusual_amount(db, invoice, report)
    _check_tax_total_consistency(invoice, report)
    _check_new_vendor(db, invoice, report)
    return report
