"""
Fraud Detection Result Model

Stores the results of fraud detection analysis for each invoice.
"""

from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database.connection import Base


class FraudDetectionResult(Base):
    """
    Fraud detection analysis results for an invoice.
    
    Each invoice can have one fraud detection result containing:
    - Overall risk score (0-100)
    - Risk level classification (LOW, MEDIUM, HIGH, CRITICAL)
    - Individual fraud flags with details
    - Detection timestamp
    """
    __tablename__ = "fraud_detection_results"

    id = Column(Integer, primary_key=True, index=True)

    # Link to the analyzed invoice
    invoice_id = Column(
        Integer,
        ForeignKey("invoices.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
        unique=True,  # One fraud result per invoice
    )

    # Overall risk assessment
    risk_score = Column(
        Float,
        nullable=False,
        default=0.0,
    )  # 0-100 score

    risk_level = Column(
        String(20),
        nullable=False,
        default="LOW",
        index=True,
    )  # LOW, MEDIUM, HIGH, CRITICAL

    # Detailed fraud flags stored as JSON array
    # Each flag: {code, severity, message, evidence, field_name}
    fraud_flags = Column(
        JSON,
        nullable=False,
        default=list,
    )

    # Detection metadata
    detection_timestamp = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # Summary counts for quick filtering
    critical_count = Column(Integer, nullable=False, default=0)
    high_count = Column(Integer, nullable=False, default=0)
    medium_count = Column(Integer, nullable=False, default=0)
    low_count = Column(Integer, nullable=False, default=0)

    # Relationships
    invoice = relationship("Invoice", backref="fraud_result")
