from datetime import datetime
from typing import Optional

from pydantic import BaseModel, field_validator

_VALID_DECISIONS = {"APPROVE", "REJECT", "REQUEST_FURTHER_REVIEW"}

class ReviewRequest(BaseModel):

    decision: str
    reason: str

    @field_validator("decision")
    @classmethod
    def validate_decision(cls, v: str) -> str:
        upper = v.upper()
        if upper not in _VALID_DECISIONS:
            raise ValueError(
                f"Invalid decision '{v}'. "
                f"Must be one of: {', '.join(sorted(_VALID_DECISIONS))}"
            )
        return upper

    @field_validator("reason")
    @classmethod
    def reason_not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Reason must not be blank — a written justification is required")
        return v.strip()

class ReviewResponse(BaseModel):

    id: int
    invoice_id: int
    reviewer_id: Optional[int]
    decision: str
    reason: str
    reviewed_at: datetime

    class Config:
        from_attributes = True

class AuditLogResponse(BaseModel):

    id: int
    user_id: Optional[int]
    invoice_id: Optional[int]
    action: str
    detail: Optional[str]
    timestamp: datetime

    class Config:
        from_attributes = True
