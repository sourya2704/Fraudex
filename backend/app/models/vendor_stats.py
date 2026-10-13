"""
Vendor Statistics Model

Caches computed statistics for vendors to improve fraud detection performance.
"""

from sqlalchemy import Column, Integer, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database.connection import Base


class VendorStats(Base):
    """
    Cached statistics for a vendor to support fraud detection.
    
    Periodically updated to reflect vendor history without
    recomputing on every fraud check.
    """
    __tablename__ = "vendor_stats"

    id = Column(Integer, primary_key=True, index=True)

    vendor_id = Column(
        Integer,
        ForeignKey("vendors.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
        unique=True,  # One stats record per vendor
    )

    # Invoice counts
    total_invoices = Column(Integer, nullable=False, default=0)
    approved_invoices = Column(Integer, nullable=False, default=0)
    rejected_invoices = Column(Integer, nullable=False, default=0)
    pending_invoices = Column(Integer, nullable=False, default=0)

    # Amount statistics
    average_amount = Column(Float, nullable=True)  # Mean invoice amount
    std_dev_amount = Column(Float, nullable=True)  # Standard deviation
    min_amount = Column(Float, nullable=True)
    max_amount = Column(Float, nullable=True)

    # Risk indicators
    rejection_rate = Column(Float, nullable=False, default=0.0)  # 0.0 to 1.0
    is_new_vendor = Column(Integer, nullable=False, default=1)  # Boolean flag

    # Metadata
    last_computed_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    # Relationships
    vendor = relationship("Vendor", backref="stats")
