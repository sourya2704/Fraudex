from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class VendorInputBase(BaseModel):


    model_config = ConfigDict(str_strip_whitespace=True)

    @field_validator(
        "tax_id", "email", "phone", "address",
        mode="before",
        check_fields=False,
    )
    @classmethod
    def blank_to_none(cls, value):


        if isinstance(value, str) and not value.strip():
            return None
        return value


class VendorCreate(VendorInputBase):


    name: str = Field(min_length=1, max_length=255)
    tax_id: Optional[str] = Field(default=None, max_length=100)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(default=None, max_length=50)
    address: Optional[str] = Field(default=None, max_length=500)


class VendorUpdate(VendorInputBase):

    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    tax_id: Optional[str] = Field(default=None, max_length=100)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(default=None, max_length=50)
    address: Optional[str] = Field(default=None, max_length=500)

    @field_validator("name")
    @classmethod
    def name_cannot_be_null(cls, value):

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
