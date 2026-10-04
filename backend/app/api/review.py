from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.core.audit import log_action
from app.core.dependencies import get_current_user, get_db, require_role
from app.models.audit_log import AuditLog
from app.models.invoice import Invoice, InvoiceStatus
from app.models.invoice_review import InvoiceReview
from app.models.user import User
from app.schemas.review import AuditLogResponse, ReviewRequest, ReviewResponse

router = APIRouter(tags=["Review & Audit"])

_DECISION_TO_STATUS = {
    "APPROVE": InvoiceStatus.DECIDED.value,
    "REJECT": InvoiceStatus.DECIDED.value,
    "REQUEST_FURTHER_REVIEW": InvoiceStatus.UNDER_REVIEW.value,
}


def _get_invoice_or_404(db: Session, invoice_id: int) -> Invoice:
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Invoice {invoice_id} not found",
        )
    return invoice


@router.post(
    "/invoices/{invoice_id}/review",
    response_model=ReviewResponse,
    status_code=status.HTTP_200_OK,
    summary="Submit a human review decision for an invoice",
)
def review_invoice(
    invoice_id: int,
    body: ReviewRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("ADMIN", "FINANCE_MANAGER")),
):
    invoice = _get_invoice_or_404(db, invoice_id)
    old_status = invoice.status

    existing = (
        db.query(InvoiceReview)
        .filter(InvoiceReview.invoice_id == invoice_id)
        .first()
    )

    if existing:
        existing.reviewer_id = current_user.id
        existing.decision = body.decision
        existing.reason = body.reason
        review = existing
    else:
        review = InvoiceReview(
            invoice_id=invoice_id,
            reviewer_id=current_user.id,
            decision=body.decision,
            reason=body.reason,
        )
        db.add(review)

    new_status = _DECISION_TO_STATUS[body.decision]
    invoice.status = new_status

    log_action(
        db,
        action="REVIEW_DECISION",
        user_id=current_user.id,
        invoice_id=invoice_id,
        detail={
            "decision": body.decision,
            "reason": body.reason,
            "reviewer_name": current_user.name,
            "reviewer_role": current_user.role,
        },
    )

    if old_status != new_status:
        log_action(
            db,
            action="INVOICE_STATUS_CHANGED",
            user_id=current_user.id,
            invoice_id=invoice_id,
            detail={"old_status": old_status, "new_status": new_status},
        )

    db.commit()
    db.refresh(review)
    return review


@router.get(
    "/invoices/{invoice_id}/review",
    response_model=ReviewResponse,
    summary="Get the current review decision for an invoice",
)
def get_review(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_invoice_or_404(db, invoice_id)
    review = (
        db.query(InvoiceReview)
        .filter(InvoiceReview.invoice_id == invoice_id)
        .first()
    )
    if not review:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No review decision found for this invoice",
        )
    return review


@router.get(
    "/audit/{invoice_id}",
    response_model=List[AuditLogResponse],
    summary="Full audit history for one invoice",
)
def get_invoice_audit(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_invoice_or_404(db, invoice_id)
    logs = (
        db.query(AuditLog)
        .filter(AuditLog.invoice_id == invoice_id)
        .order_by(desc(AuditLog.timestamp))
        .all()
    )
    return logs


@router.get(
    "/audit/user/{user_id}",
    response_model=List[AuditLogResponse],
    summary="Activity log for a specific user (ADMIN only)",
)
def get_user_audit(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("ADMIN")),
    limit: int = Query(100, ge=1, le=500),
):
    logs = (
        db.query(AuditLog)
        .filter(AuditLog.user_id == user_id)
        .order_by(desc(AuditLog.timestamp))
        .limit(limit)
        .all()
    )
    return logs


@router.get(
    "/audit/",
    response_model=List[AuditLogResponse],
    summary="Recent audit log across all activity (ADMIN only)",
)
def get_all_audit(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("ADMIN")),
    limit: int = Query(100, ge=1, le=500),
    action: Optional[str] = Query(None, description="Filter by action code"),
):
    q = db.query(AuditLog).order_by(desc(AuditLog.timestamp))
    if action:
        q = q.filter(AuditLog.action == action.upper())
    return q.limit(limit).all()
