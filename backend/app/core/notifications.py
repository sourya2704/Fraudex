from typing import Optional
from sqlalchemy.orm import Session

from app.models.notification import Notification
from app.models.user import User


TYPES = {
    "INVOICE_UPLOADED":        "info",
    "PROCESSING_FAILED":       "error",
    "FRAUD_HIGH":              "warning",
    "FRAUD_CRITICAL":          "critical",
    "REVIEW_DECISION":         "success",
    "INVOICE_STATUS_CHANGED":  "info",
    "AI_ANALYSIS_COMPLETE":    "info",
}


def notify(
    db: Session,
    user_id: int,
    type: str,
    title: str,
    message: str,
    invoice_id: Optional[int] = None,
) -> Notification:
    n = Notification(
        user_id=user_id,
        invoice_id=invoice_id,
        type=type,
        title=title,
        message=message,
    )
    db.add(n)
    db.flush()
    return n


def notify_all_admins(
    db: Session,
    type: str,
    title: str,
    message: str,
    invoice_id: Optional[int] = None,
    exclude_user_id: Optional[int] = None,
) -> None:
    admins = db.query(User).filter(
        User.role.in_(["ADMIN", "FINANCE_MANAGER"])
    ).all()
    for admin in admins:
        if exclude_user_id and admin.id == exclude_user_id:
            continue
        notify(db, admin.id, type, title, message, invoice_id)
