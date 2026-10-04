"""
Audit logging helper.

Usage (inside any route):
    from app.core.audit import log_action
    log_action(db, user_id=current_user.id, invoice_id=invoice.id,
               action="INVOICE_UPLOADED", detail="filename.pdf")

Action codes used across the system:
    INVOICE_UPLOADED
    INVOICE_EXTRACTED
    INVOICE_VALIDATED
    FRAUD_CHECK_RUN
    REVIEW_DECISION        (detail carries decision + reason)
    INVOICE_STATUS_CHANGED (detail carries old→new status)
    USER_REGISTERED
    USER_LOGIN
    USER_LOGOUT
"""

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
    """
    Write one immutable audit log entry and flush it to the DB.

    `detail` can be a string, dict, or anything JSON-serialisable.
    Dicts are serialised to compact JSON automatically.
    """
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
    db.flush()   # write within the current transaction; caller controls commit
    return entry
