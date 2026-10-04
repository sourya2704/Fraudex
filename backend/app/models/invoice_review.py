from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database.connection import Base


class InvoiceReview(Base):
    """
    Stores the human review decision for an invoice.

    One row per invoice (upserted on re-review so the latest decision wins).
    The previous decision is overwritten — full history is kept in AuditLog.
    """

    __tablename__ = "invoice_reviews"

    id = Column(Integer, primary_key=True, index=True)

    invoice_id = Column(
        Integer,
        ForeignKey("invoices.id", ondelete="CASCADE"),
        unique=True,       # one active decision per invoice
        nullable=False,
        index=True,
    )

    # Who made the decision (ADMIN / FINANCE_MANAGER).
    reviewer_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # APPROVE | REJECT | REQUEST_FURTHER_REVIEW
    decision = Column(String(50), nullable=False)

    # Mandatory written justification.
    reason = Column(Text, nullable=False)

    reviewed_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    # Relationships
    invoice = relationship("Invoice", backref="review")
    reviewer = relationship("User", backref="reviews_made")
