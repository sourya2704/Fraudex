import json
from typing import Any, Optional

from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog


def log_action(
    db: Session,
    action: str,
    user_id: Optional[int] = None,
    invoice_id: Optional[int] = None,
    detail: Optional[Any] = None,
) -> AuditLog:
    detail_str: Optional[str] = None
    if detail is not None:
        if isinstance(detail, str):
            detail_str = detail
        else:
            try:
                detail_str = json.dumps(detail, default=str)
            except Exception:
                detail_str = str(detail)

    entry = AuditLog(
        user_id=user_id,
        invoice_id=invoice_id,
        action=action,
        detail=detail_str,
    )
    db.add(entry)
    db.flush()
    return entry
