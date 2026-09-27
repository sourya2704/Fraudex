from sqlalchemy import Column, Integer, String, Numeric, ForeignKey
from sqlalchemy.orm import relationship

from app.database.connection import Base


class InvoiceItem(Base):
    __tablename__ = "invoice_items"

    id = Column(Integer, primary_key=True, index=True)

    # Parent invoice. Deleting the invoice deletes its items
    # (enforced both here in the DB and via the ORM cascade on Invoice.items).
    invoice_id = Column(
        Integer,
        ForeignKey("invoices.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )

    description = Column(String(500), nullable=True)

    # quantity can be fractional (e.g. 1.5 hours), so Numeric not Integer.
    quantity = Column(Numeric(14, 2), nullable=True)

    unit_price = Column(Numeric(14, 2), nullable=True)
    tax = Column(Numeric(14, 2), nullable=True)
    line_total = Column(Numeric(14, 2), nullable=True)

    invoice = relationship("Invoice", back_populates="items")
