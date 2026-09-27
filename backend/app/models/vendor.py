from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func

from app.database.connection import Base


class Vendor(Base):
    __tablename__ = "vendors"

    id = Column(Integer, primary_key=True, index=True)

    name = Column(String(255), nullable=False, index=True)

    # Tax identifier (e.g. GSTIN / VAT). Unique when present.
    tax_id = Column(String(100), unique=True, index=True, nullable=True)

    email = Column(String(255), nullable=True)

    phone = Column(String(50), nullable=True)

    address = Column(String(500), nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )
