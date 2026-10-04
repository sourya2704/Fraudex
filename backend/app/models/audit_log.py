from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database.connection import Base


class AuditLog(Base):
    """
    Immutable record of every significant action in the system.

    Written by the API layer after each key operation. Never updated or
    deleted — this is the system's tamper-evident trail.
    """

    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)

    # Who performed the action. NULL if the action was system-initiated.
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Which invoice this relates to. NULL for user-level actions.
    invoice_id = Column(
        Integer,
        ForeignKey("invoices.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Machine-readable action code, e.g. INVOICE_UPLOADED, FRAUD_CHECK_RUN.
    action = Column(String(100), nullable=False, index=True)

    # Optional human-readable context (JSON string or plain text).
    detail = Column(Text, nullable=True)

    timestamp = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        index=True,
    )

    # Relationships (read-only — never cascade-delete audit rows)
    user = relationship("User", backref="audit_logs")
    invoice = relationship("Invoice", backref="audit_logs")
