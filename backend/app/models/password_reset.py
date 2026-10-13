import secrets
from datetime import datetime, timedelta, timezone

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.sql import func

from app.database.connection import Base


class PasswordResetOTP(Base):
    __tablename__ = "password_reset_otps"

    id         = Column(Integer, primary_key=True, index=True)
    user_id    = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    otp_hash   = Column(String(255), nullable=False)          # bcrypt hash of the 6-digit OTP
    expires_at = Column(DateTime(timezone=True), nullable=False)
    used       = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    @staticmethod
    def expiry() -> datetime:
        return datetime.now(timezone.utc) + timedelta(minutes=15)
