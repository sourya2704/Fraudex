from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.invoice import InvoiceStatus


# ---------------------------------------------------------------------------
# Invoice line items
# ---------------------------------------------------------------------------

class InvoiceItemBase(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    description: Optional[str] = Field(default=None, max_length=500)
    # ge=0: quantities and money can be zero but never negative.
    quantity: Optional[Decimal] = Field(default=None, ge=0)
    unit_price: Optional[Decimal] = Field(default=None, ge=0)
    tax: Optional[Decimal] = Field(default=None, ge=0)
    line_total: Optional[Decimal] = Field(default=None, ge=0)


class InvoiceItemCreate(InvoiceItemBase):
    pass


class InvoiceItemResponse(InvoiceItemBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    invoice_id: int


# ---------------------------------------------------------------------------
# Invoices
# ---------------------------------------------------------------------------

class InvoiceInputBase(BaseModel):
    """Shared input cleanup for invoice create/update."""

    model_config = ConfigDict(str_strip_whitespace=True)

    @field_validator(
        "invoice_number", "currency",
        mode="before",
        check_fields=False,
    )
    @classmethod
    def blank_to_none(cls, value):
        if isinstance(value, str) and not value.strip():
            return None
        return value

    @field_validator("currency", check_fields=False)
    @classmethod
    def uppercase_currency(cls, value):
        # Normalize "inr" -> "INR" so comparisons are consistent.
        return value.upper() if isinstance(value, str) else value


class InvoiceCreate(InvoiceInputBase):
    invoice_number: Optional[str] = Field(default=None, max_length=100)
    vendor_id: Optional[int] = None
    invoice_date: Optional[date] = None
    due_date: Optional[date] = None
    subtotal: Optional[Decimal] = Field(default=None, ge=0)
    tax: Optional[Decimal] = Field(default=None, ge=0)
    total_amount: Optional[Decimal] = Field(default=None, ge=0)
    currency: Optional[str] = Field(default=None, min_length=3, max_length=3)
    items: List[InvoiceItemCreate] = Field(default_factory=list)


class InvoiceUpdate(InvoiceInputBase):
    # All optional: only provided fields are updated.
    invoice_number: Optional[str] = Field(default=None, max_length=100)
    vendor_id: Optional[int] = None
    invoice_date: Optional[date] = None
    due_date: Optional[date] = None
    subtotal: Optional[Decimal] = Field(default=None, ge=0)
    tax: Optional[Decimal] = Field(default=None, ge=0)
    total_amount: Optional[Decimal] = Field(default=None, ge=0)
    currency: Optional[str] = Field(default=None, min_length=3, max_length=3)
    status: Optional[InvoiceStatus] = None


class InvoiceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    invoice_number: Optional[str] = None
    vendor_id: Optional[int] = None
    uploaded_by: Optional[int] = None
    invoice_date: Optional[date] = None
    due_date: Optional[date] = None
    subtotal: Optional[Decimal] = None
    tax: Optional[Decimal] = None
    total_amount: Optional[Decimal] = None
    currency: Optional[str] = None
    status: str
    document_path: Optional[str] = None
    raw_text: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    items: List[InvoiceItemResponse] = Field(default_factory=list)
