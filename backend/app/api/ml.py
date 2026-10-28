import os
import shutil
import threading
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.audit import log_action
from app.core.dependencies import get_db, require_role
from app.database.connection import SessionLocal
from app.ml.model import LOCAL_MODEL_PATH, load_model
from app.ml.training import BACKUP_PATH, count_reviews, retrain_with_reviews
from app.models.user import User

router = APIRouter(prefix="/ml", tags=["Fraud Model"])

# One retrain at a time; its progress is polled through GET /ml/status.
_job_lock = threading.Lock()
_job = {"state": "idle", "step": None, "started_at": None, "finished_at": None,
        "result": None, "error": None}


def _model_summary() -> dict | None:
    bundle = load_model()
    if bundle is None:
        return None
    return {
        "version": bundle.get("version"),
        "threshold": bundle.get("threshold"),
        "trained_at": bundle.get("trained_at"),
        "trained_on": bundle.get("trained_on"),
        "metrics": bundle.get("metrics"),
    }


@router.get("/status")
def model_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("ADMIN", "FINANCE_MANAGER")),
):
    reviews = count_reviews(db)
    trained = (_model_summary() or {}).get("trained_on") or {}
    used = trained.get("real_reviewed_invoices", 0)
    return {
        "model": _model_summary(),
        "reviews": {**reviews, "total": reviews["approved"] + reviews["rejected"],
                    "new_since_training": max(0, reviews["approved"] + reviews["rejected"] - used)},
        # Rolling back steps from a retrained model to the one before it
        # (the previous retrain, or the committed base model).
        "can_rollback": os.path.exists(LOCAL_MODEL_PATH),
        "using_retrained_model": os.path.exists(LOCAL_MODEL_PATH),
        "job": dict(_job),
    }


def _run_retrain(user_id: int):
    db = SessionLocal()
    try:
        def progress(step):
            _job["step"] = step

        result = retrain_with_reviews(db, progress=progress)
        _job.update(state="done", step=None, result=result,
                    finished_at=datetime.now(timezone.utc).isoformat(timespec="seconds"))
        log_action(db, action="MODEL_RETRAINED", user_id=user_id,
                   detail={"version": result["version"], "trained_on": result["trained_on"]})
        db.commit()
    except Exception as e:  # reported to the UI; the live model is untouched
        _job.update(state="failed", step=None, error=f"{type(e).__name__}: {e}",
                    finished_at=datetime.now(timezone.utc).isoformat(timespec="seconds"))
    finally:
        db.close()
        _job_lock.release()


@router.post("/retrain", status_code=status.HTTP_202_ACCEPTED)
def start_retrain(current_user: User = Depends(require_role("ADMIN"))):
    if not _job_lock.acquire(blocking=False):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A retrain is already running")
    _job.update(state="running", step="Starting", result=None, error=None, finished_at=None,
                started_at=datetime.now(timezone.utc).isoformat(timespec="seconds"))
    threading.Thread(target=_run_retrain, args=(current_user.id,), daemon=True).start()
    return {"job": dict(_job)}


@router.post("/rollback")
def rollback_model(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("ADMIN")),
):
    if _job["state"] == "running":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Wait for the retrain to finish")
    if not os.path.exists(LOCAL_MODEL_PATH):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="Already using the base model; nothing to roll back")
    if os.path.exists(BACKUP_PATH):
        shutil.move(BACKUP_PATH, LOCAL_MODEL_PATH)   # previous retrain
    else:
        os.remove(LOCAL_MODEL_PATH)                  # back to the committed base model
    load_model.cache_clear()
    log_action(db, action="MODEL_ROLLED_BACK", user_id=current_user.id,
               detail={"version": (_model_summary() or {}).get("version")})
    db.commit()
    return {"model": _model_summary()}
