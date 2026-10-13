"""
Fraud Detection Schemas

Pydantic models for fraud detection API requests and responses.
"""

from datetime import datetime
from typing import List, Optional, Dict, Any

from pydantic import BaseModel, Field, ConfigDict


# ---------------------------------------------------------------------------
# Fraud Flag
# ---------------------------------------------------------------------------

class FraudFlag(BaseModel):
    """
    A single fraud detection flag/warning.
    """
    model_config = ConfigDict(from_attributes=True)

    code: str = Field(..., description="Machine-readable fraud flag code")
    severity: str = Field(..., description="Severity level: INFO, LOW, MEDIUM, HIGH, CRITICAL")
    message: str = Field(..., description="Human-readable description")
    evidence: Optional[Dict[str, Any]] = Field(default=None, description="Supporting evidence data")
    field_name: Optional[str] = Field(default=None, description="Invoice field related to this flag")


# ---------------------------------------------------------------------------
# Fraud Detection Result
# ---------------------------------------------------------------------------

class FraudDetectionResponse(BaseModel):
    """
    Complete fraud detection analysis result.
    """
    model_config = ConfigDict(from_attributes=True)

    id: int
    invoice_id: int
    risk_score: float = Field(..., ge=0, le=100, description="Risk score from 0-100")
    risk_level: str = Field(..., description="Risk level: LOW, MEDIUM, HIGH, CRITICAL")
    fraud_flags: List[FraudFlag] = Field(default_factory=list)
    detection_timestamp: datetime
    critical_count: int
    high_count: int
    medium_count: int
    low_count: int


class FraudDetectionSummary(BaseModel):
    """
    Summary of fraud detection for display.
    """
    invoice_id: int
    risk_score: float
    risk_level: str
    total_flags: int
    critical_flags: int
    high_flags: int
    top_concerns: List[str] = Field(
        default_factory=list,
        description="Top 3 fraud concerns"
    )


# ---------------------------------------------------------------------------
# Fraud Analytics
# ---------------------------------------------------------------------------

class FraudStatistics(BaseModel):
    """
    Overall fraud detection statistics.
    """
    total_invoices_analyzed: int
    low_risk_count: int
    medium_risk_count: int
    high_risk_count: int
    critical_risk_count: int
    most_common_fraud_types: List[Dict[str, Any]]
    average_risk_score: float


class HighRiskInvoice(BaseModel):
    """
    High-risk invoice summary for dashboard.
    """
    invoice_id: int
    invoice_number: Optional[str]
    vendor_name: Optional[str]
    total_amount: Optional[float]
    risk_score: float
    risk_level: str
    critical_flags: int
    detection_date: datetime


class VendorRiskProfile(BaseModel):
    """
    Vendor risk profile summary.
    """
    vendor_id: int
    vendor_name: str
    total_invoices: int
    rejection_rate: float
    average_amount: Optional[float]
    average_risk_score: Optional[float]
    is_new_vendor: bool
    last_invoice_date: Optional[datetime]
