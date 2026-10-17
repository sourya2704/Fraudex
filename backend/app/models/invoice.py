import enum

from sqlalchemy import (
    Column,
    Integer,
    String,
    Numeric,
    Date,
    DateTime,
    ForeignKey,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database.connection import Base


class InvoiceStatus(str, enum.Enum):

    DRAFT = "DRAFT"
    DOCUMENTS_UPLOADED = "DOCUMENTS_UPLOADED"
    PROCESSING = "PROCESSING"
    ANALYSIS_READY = "ANALYSIS_READY"
    UNDER_REVIEW = "UNDER_REVIEW"
    DECIDED = "DECIDED"
    PROCESSING_FAILED = "PROCESSING_FAILED"


class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True, index=True)


    invoice_number = Column(String(100), index=True, nullable=True)


    vendor_id = Column(
        Integer,
        ForeignKey("vendors.id", ondelete="RESTRICT"),
        index=True,
        nullable=True,
    )


    uploaded_by = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        index=True,
        nullable=True,
    )

    invoice_date = Column(Date, nullable=True)
    due_date = Column(Date, nullable=True)


    subtotal = Column(Numeric(14, 2), nullable=True)
    tax = Column(Numeric(14, 2), nullable=True)
    total_amount = Column(Numeric(14, 2), nullable=True)

    currency = Column(String(3), nullable=True)

    status = Column(
        String(50),
        nullable=False,
        default=InvoiceStatus.DRAFT.value,
        index=True,
    )


    document_path = Column(String(500), nullable=True)


    raw_text = Column(String, nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )


    vendor = relationship("Vendor", backref="invoices")
    uploader = relationship("User", backref="invoices")
    items = relationship(
        "InvoiceItem",
        back_populates="invoice",
        cascade="all, delete-orphan",
    )

    @property
    def vendor_name(self):
        return self.vendor.name if self.vendor is not None else None

    @property
    def _latest_fraud_result(self):
        results = getattr(self, "fraud_result", None) or []
        return results[-1] if results else None

    @property
    def risk_score(self):
        result = self._latest_fraud_result
        return result.risk_score if result is not None else None

    @property
    def risk_level(self):
        result = self._latest_fraud_result
        return result.risk_level if result is not None else None
