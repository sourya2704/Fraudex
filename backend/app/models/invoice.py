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
    """
    Lifecycle states for an invoice, from the project design.

    Stored as a plain string in the DB (see `status` column), but the
    schema layer validates against these values so an invalid status
    is rejected at the API boundary with a 422.
    """

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

    # Invoice number as printed on the document. Not globally unique on its
    # own (two vendors may reuse numbers); duplicate detection is handled
    # later against vendor + number, not by a DB constraint here.
    invoice_number = Column(String(100), index=True, nullable=True)

    # Which vendor issued the invoice. Nullable because an invoice can be
    # uploaded before the vendor is identified during extraction.
    vendor_id = Column(
        Integer,
        ForeignKey("vendors.id", ondelete="RESTRICT"),
        index=True,
        nullable=True,
    )

    # Who uploaded / created this invoice record.
    uploaded_by = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        index=True,
        nullable=True,
    )

    invoice_date = Column(Date, nullable=True)
    due_date = Column(Date, nullable=True)

    # Money uses Numeric, never Float, so cents are exact.
    subtotal = Column(Numeric(14, 2), nullable=True)
    tax = Column(Numeric(14, 2), nullable=True)
    total_amount = Column(Numeric(14, 2), nullable=True)

    currency = Column(String(3), nullable=True)  # ISO 4217, e.g. "INR"

    status = Column(
        String(50),
        nullable=False,
        default=InvoiceStatus.DRAFT.value,
        index=True,
    )

    # Path/reference to the stored document (local for now, S3 later).
    document_path = Column(String(500), nullable=True)

    # Raw text produced by OCR/extraction (STEP 6).
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

    # Relationships
    vendor = relationship("Vendor", backref="invoices")
    uploader = relationship("User", backref="invoices")
    items = relationship(
        "InvoiceItem",
        back_populates="invoice",
        cascade="all, delete-orphan",
    )
