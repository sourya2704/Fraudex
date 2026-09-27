from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class VendorInputBase(BaseModel):
    """Shared input cleanup for create and update requests."""

    # Trim leading/trailing spaces on every text field,
    # so "   " counts as empty and " GST-1 " matches "GST-1".
    model_config = ConfigDict(str_strip_whitespace=True)

    @field_validator(
        "tax_id", "email", "phone", "address",
        mode="before",
        check_fields=False,
    )
    @classmethod
    def blank_to_none(cls, value):
        # Forms often send "" for empty inputs. Store those as NULL.
        # Otherwise two vendors with tax_id "" clash on the unique index.
        if isinstance(value, str) and not value.strip():
            return None
        return value


class VendorCreate(VendorInputBase):
    # max_length values match the column sizes in models/vendor.py,
    # so oversized input gets a 422 instead of a database crash (500).
    name: str = Field(min_length=1, max_length=255)
    tax_id: Optional[str] = Field(default=None, max_length=100)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(default=None, max_length=50)
    address: Optional[str] = Field(default=None, max_length=500)


class VendorUpdate(VendorInputBase):
    # All optional: only the fields the client sends are updated.
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    tax_id: Optional[str] = Field(default=None, max_length=100)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(default=None, max_length=50)
    address: Optional[str] = Field(default=None, max_length=500)

    @field_validator("name")
    @classmethod
    def name_cannot_be_null(cls, value):
        # name is NOT NULL in the database: it can be changed, not cleared.
        if value is None:
            raise ValueError("name cannot be null")
        return value


class VendorResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    tax_id: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    created_at: datetime
