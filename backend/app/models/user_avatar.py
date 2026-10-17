from sqlalchemy import Column, DateTime, ForeignKey, Integer, Text
from sqlalchemy.sql import func

from app.database.connection import Base


class UserAvatar(Base):
    """Profile photo, kept in its own table so the users table needs no migration."""

    __tablename__ = "user_avatars"

    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )

    # Small resized image as a data URL ("data:image/jpeg;base64,...").
    data_url = Column(Text, nullable=False)

    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )
