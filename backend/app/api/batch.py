import threading
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.invoices import run_and_store_detection
from app.core.audit import log_action
from app.core.dependencies import get_db, require_role
from app.core.notifications import notify_all_admins
from app.database.connection import SessionLocal
from app.models.fraud_detection_result import FraudDetectionResult
from app.models.invoice import Invoice
from app.models.user import User

router = APIRouter(prefix="/batch", tags=["Batch"])

# One batch fraud check at a time; progress is polled through GET.
_lock = threading.Lock()
_job = {"state": "idle", "scope": None, "total": 0, "done": 0, "failed": 0,
        "levels": {}, "started_at": None, "finished_at": None, "error": None}

_COMMIT_EVERY = 50


class FraudCheckRequest(BaseModel):
    # "unanalyzed": only invoices never checked; "all": re-check everything
    scope: Literal["unanalyzed", "all"] = "unanalyzed"


def _target_ids(db: Session, scope: str) -> list[int]:
    query = db.query(Invoice.id)
    if scope == "unanalyzed":
        checked = db.query(FraudDetectionResult.invoice_id)
        query = query.filter(~Invoice.id.in_(checked))
    return [row.id for row in query.order_by(Invoice.created_at, Invoice.id).all()]


def _run(ids: list[int], user_id: int):
    db = SessionLocal()
    try:
        for i, invoice_id in enumerate(ids, 1):
            try:
                invoice = db.get(Invoice, invoice_id)
                if invoice is not None:
                    result, _ = run_and_store_detection(db, invoice)
                    level = result["risk_level"]
                    _job["levels"][level] = _job["levels"].get(level, 0) + 1
                if i % _COMMIT_EVERY == 0:
                    db.commit()
            except Exception:
                db.rollback()
                _job["failed"] += 1
            _job["done"] = i
        db.commit()

        levels = _job["levels"]
        flagged = levels.get("HIGH", 0) + levels.get("CRITICAL", 0)
        log_action(db, action="BATCH_FRAUD_CHECK", user_id=user_id,
                   detail={"checked": len(ids), "failed": _job["failed"], "levels": levels})
        # One summary instead of a notification per flagged invoice.
        if flagged:
            notify_all_admins(
                db, type="FRAUD_HIGH", title="Batch fraud check finished",
                message=f"Checked {len(ids)} invoices: {flagged} high or critical risk. "
                        "Open Fraud Detection to review them.",
            )
        db.commit()
        _job.update(state="done", finished_at=datetime.now(timezone.utc).isoformat(timespec="seconds"))
    except Exception as e:
        _job.update(state="failed", error=f"{type(e).__name__}: {e}",
                    finished_at=datetime.now(timezone.utc).isoformat(timespec="seconds"))
    finally:
        db.close()
        _lock.release()


@router.get("/fraud-check")
def batch_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("ADMIN", "FINANCE_MANAGER")),
):
    return {"job": dict(_job), "unanalyzed": len(_target_ids(db, "unanalyzed"))}


@router.post("/fraud-check", status_code=status.HTTP_202_ACCEPTED)
def start_batch(
    body: FraudCheckRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("ADMIN", "FINANCE_MANAGER")),
):
    if not _lock.acquire(blocking=False):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A batch check is already running")
    ids = _target_ids(db, body.scope)
    if not ids:
        _lock.release()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No invoices to check")
    _job.update(state="running", scope=body.scope, total=len(ids), done=0, failed=0, levels={},
                started_at=datetime.now(timezone.utc).isoformat(timespec="seconds"),
                finished_at=None, error=None)
    threading.Thread(target=_run, args=(ids, current_user.id), daemon=True).start()
    return {"job": dict(_job)}
