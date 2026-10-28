"""
Trained fraud model: loading and scoring.

The base model is trained by scripts/train_fraud_model.py and saved to
app/ml/fraud_model.joblib; a model retrained from reviewer decisions is saved
next to it as fraud_model.local.joblib and takes priority. If the file or scikit-learn is missing, scoring
returns None and the rest of the pipeline works exactly as before.
"""

import os
from functools import lru_cache
from typing import Any, Optional

from sqlalchemy.orm import Session

from app.ml.features import FEATURE_NAMES, build_features

_ML_DIR = os.path.dirname(os.path.abspath(__file__))
# Base model, committed to the repository (scripts/train_fraud_model.py).
MODEL_PATH = os.getenv("FRAUD_MODEL_PATH", os.path.join(_ML_DIR, "fraud_model.joblib"))
# Model retrained in this installation from reviewer decisions (git-ignored).
# When present it is used instead of the base model.
LOCAL_MODEL_PATH = os.path.join(_ML_DIR, "fraud_model.local.joblib")


def active_model_path() -> str:
    return LOCAL_MODEL_PATH if os.path.exists(LOCAL_MODEL_PATH) else MODEL_PATH


@lru_cache(maxsize=1)
def load_model() -> Optional[dict]:
    """Return the saved bundle {model, feature_names, threshold, metrics} or None."""
    path = active_model_path()
    if not os.path.exists(path):
        return None
    try:
        import joblib

        bundle = joblib.load(path)
    except Exception as e:  # sklearn missing / incompatible pickle
        print(f"[ML] could not load fraud model: {e}")
        return None
    if bundle.get("feature_names") != FEATURE_NAMES:
        print("[ML] fraud model was trained on different features; retrain it")
        return None
    return bundle


def vendor_history(db: Session, invoice: Any) -> list:
    from app.models.invoice import Invoice

    if not invoice.vendor_id:
        return []
    return (
        db.query(Invoice)
        .filter(Invoice.vendor_id == invoice.vendor_id, Invoice.id != invoice.id)
        .all()
    )


def score_invoice(db: Session, invoice: Any) -> Optional[dict]:
    """
    Fraud probability for one invoice, with the features that pushed it up.

    Returns {"probability", "threshold", "top_factors"} or None when no model
    is available.
    """
    bundle = load_model()
    if bundle is None:
        return None

    features = build_features(invoice, vendor_history(db, invoice))
    probability = float(bundle["model"].predict_proba([features])[0][1])

    # Explain with the gap from a typical legitimate invoice, weighted by how
    # much the model relies on each feature.
    baseline = bundle.get("legit_median", [0.0] * len(features))
    importance = bundle.get("importance", [1.0] * len(features))
    scale = bundle.get("feature_scale", [1.0] * len(features))
    contributions = sorted(
        (
            (abs(f - b) / (s or 1.0) * w, name, f)
            for name, f, b, w, s in zip(FEATURE_NAMES, features, baseline, importance, scale)
        ),
        reverse=True,
    )
    top = [
        {"feature": name, "value": round(value, 4)}
        for weight, name, value in contributions[:4]
        if weight > 0
    ]

    return {
        "probability": round(probability, 4),
        "threshold": bundle["threshold"],
        "top_factors": top,
        "model_version": bundle.get("version"),
    }


def ml_fraud_flag(db: Session, invoice: Any):
    """FraudFlag for the detector when the model's probability crosses its threshold."""
    from app.fraud.models import FraudFlag, Severity

    result = score_invoice(db, invoice)
    return flag_from_score(result, FraudFlag, Severity)


def flag_from_score(result: Optional[dict], FraudFlag, Severity):
    if result is None or result["probability"] < result["threshold"]:
        return None
    probability = result["probability"]
    severity = Severity.HIGH if probability >= 0.9 else Severity.MEDIUM
    factors = ", ".join(f["feature"].replace("_", " ") for f in result["top_factors"][:3])
    return FraudFlag(
        code="ML_FRAUD_PATTERN",
        severity=severity,
        message=(
            f"Fraud model rates this invoice {probability:.0%} likely fraudulent"
            + (f" (driven by: {factors})" if factors else "")
        ),
        evidence=result,
        field_name=None,
    )
