"""
Deterministic invoice validation.

Given the structured fields parsed from an invoice, apply a set of explicit,
explainable rules and return a structured result. This is NOT fraud
detection (that comes later) — it is data-integrity checking: are the
required fields present, are the numbers internally consistent, are the
dates sane.

Each issue carries a machine-readable `code`, a `severity`, and a
human-readable `message`, so the API, the UI, and a human reviewer can all
act on the same structured output.
"""

from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal
from typing import Any, Optional


# Amounts within this absolute tolerance are treated as equal, to absorb
# rounding differences (e.g. tax computed to fractions of a cent).
_AMOUNT_TOLERANCE = Decimal("0.05")

# Fields that must be present for an invoice to be considered complete.
_REQUIRED_FIELDS = [
    "invoice_number",
    "invoice_date",
    "total_amount",
]


class Severity:
    ERROR = "ERROR"      # invoice cannot be trusted as-is
    WARNING = "WARNING"  # suspicious but not necessarily invalid
    INFO = "INFO"        # informational only


@dataclass
class ValidationIssue:
    code: str
    severity: str
    message: str
    field_name: Optional[str] = None

    def to_dict(self) -> dict:
        return {
            "code": self.code,
            "severity": self.severity,
            "message": self.message,
            "field": self.field_name,
        }


@dataclass
class ValidationResult:
    issues: list[ValidationIssue] = field(default_factory=list)

    def add(self, code, severity, message, field_name=None):
        self.issues.append(ValidationIssue(code, severity, message, field_name))

    @property
    def valid(self) -> bool:
        # Valid means no ERROR-level issues. Warnings do not fail validation.
        return not any(i.severity == Severity.ERROR for i in self.issues)

    def to_dict(self) -> dict:
        return {
            "valid": self.valid,
            "error_count": sum(1 for i in self.issues if i.severity == Severity.ERROR),
            "warning_count": sum(1 for i in self.issues if i.severity == Severity.WARNING),
            "issues": [i.to_dict() for i in self.issues],
        }


def _is_negative(value: Any) -> bool:
    return isinstance(value, Decimal) and value < 0


def validate_invoice_fields(fields: dict) -> ValidationResult:
    """
    Run all deterministic validation rules against parsed invoice fields.

    `fields` is the dict produced by parse_invoice_text()["fields"]:
      invoice_number, invoice_date, due_date, subtotal, tax,
      total_amount, currency
    Missing values are None.
    """
    result = ValidationResult()

    invoice_number = fields.get("invoice_number")
    invoice_date = fields.get("invoice_date")
    due_date = fields.get("due_date")
    subtotal = fields.get("subtotal")
    tax = fields.get("tax")
    total_amount = fields.get("total_amount")
    currency = fields.get("currency")

    # --- Rule 1: required fields present ---
    for name in _REQUIRED_FIELDS:
        if fields.get(name) is None:
            result.add(
                "MISSING_REQUIRED_FIELD",
                Severity.ERROR,
                f"Required field '{name}' is missing or could not be read",
                field_name=name,
            )

    # --- Rule 2: currency present (warning, not fatal) ---
    if not currency:
        result.add(
            "MISSING_CURRENCY",
            Severity.WARNING,
            "Currency could not be determined",
            field_name="currency",
        )

    # --- Rule 3: no negative amounts ---
    for name in ("subtotal", "tax", "total_amount"):
        if _is_negative(fields.get(name)):
            result.add(
                "NEGATIVE_AMOUNT",
                Severity.ERROR,
                f"Amount '{name}' is negative ({fields.get(name)})",
                field_name=name,
            )

    # --- Rule 4: subtotal + tax == total (only if all three present) ---
    if (
        isinstance(subtotal, Decimal)
        and isinstance(tax, Decimal)
        and isinstance(total_amount, Decimal)
    ):
        expected = subtotal + tax
        if abs(expected - total_amount) > _AMOUNT_TOLERANCE:
            result.add(
                "TOTAL_MISMATCH",
                Severity.ERROR,
                f"subtotal ({subtotal}) + tax ({tax}) = {expected}, "
                f"which does not match total ({total_amount})",
                field_name="total_amount",
            )

    # --- Rule 5: total should not be less than subtotal ---
    if isinstance(subtotal, Decimal) and isinstance(total_amount, Decimal):
        if total_amount < subtotal:
            result.add(
                "TOTAL_LESS_THAN_SUBTOTAL",
                Severity.ERROR,
                f"Total ({total_amount}) is less than subtotal ({subtotal})",
                field_name="total_amount",
            )

    # --- Rule 6: due date not before invoice date ---
    if isinstance(invoice_date, date) and isinstance(due_date, date):
        if due_date < invoice_date:
            result.add(
                "DUE_BEFORE_INVOICE_DATE",
                Severity.WARNING,
                f"Due date ({due_date}) is before invoice date ({invoice_date})",
                field_name="due_date",
            )

    # --- Rule 7: zero total is suspicious ---
    if isinstance(total_amount, Decimal) and total_amount == 0:
        result.add(
            "ZERO_TOTAL",
            Severity.WARNING,
            "Total amount is zero",
            field_name="total_amount",
        )

    return result
