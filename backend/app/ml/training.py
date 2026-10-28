"""
Model training shared by scripts/train_fraud_model.py (full evaluation run)
and the in-app "retrain with reviewer decisions" job.

Real labels come from human review: an invoice a reviewer APPROVED is
legitimate (0), one they REJECTED is fraud (1). "Further review" is not a
label. Real rows are weighted above synthetic ones, so as reviews accumulate
they increasingly decide what the model learns.
"""

import json
import os
import shutil
from collections import defaultdict
from datetime import date, datetime, timezone
from types import SimpleNamespace
from typing import Callable, Optional

import numpy as np

from app.ml.features import FEATURE_NAMES, build_features

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATA_DIR = os.path.join(ROOT, "data", "training")
# Retrained models never overwrite the committed base model.
from app.ml.model import LOCAL_MODEL_PATH  # noqa: E402

BACKUP_PATH = os.path.join(ROOT, "app", "ml", "fraud_model.local.prev.joblib")

PARAMS = dict(max_iter=400, learning_rate=0.06, max_leaf_nodes=31, l2_regularization=1.0,
              class_weight="balanced", random_state=7)

# How much one real reviewer decision counts against one synthetic invoice.
REAL_WEIGHT = 5.0
# Fewer real labels than this (or only one class) → no cross-validated score.
MIN_REAL_FOR_SCORE = 20


# ── Synthetic data ───────────────────────────────────────────────────────────

def load_synthetic_rows(path: Optional[str] = None) -> list:
    """Synthetic invoices as attribute objects, oldest upload first.

    Generates data/training/invoices.jsonl first if it is missing (it is not
    committed; the generator is seeded, so it rebuilds identically).
    """
    path = path or os.path.join(DATA_DIR, "invoices.jsonl")
    if not os.path.exists(path):
        _generate_dataset(path)
    with open(path) as f:
        raw = [json.loads(line) for line in f]
    raw.sort(key=lambda r: r["created_at"])
    vendor_ids = {}
    rows = []
    for r in raw:
        vid = vendor_ids.setdefault(r["vendor_key"], len(vendor_ids) + 1)
        rows.append(SimpleNamespace(
            id=r["id"], vendor_id=vid, vendor_key=r["vendor_key"],
            vendor_name=r["vendor_name"], vendor_gstin=r["vendor_gstin"],
            invoice_number=r["invoice_number"],
            invoice_date=date.fromisoformat(r["invoice_date"]),
            due_date=date.fromisoformat(r["due_date"]) if r["due_date"] else None,
            created_at=datetime.fromisoformat(r["created_at"]),
            subtotal=r["subtotal"], tax=r["tax"], total_amount=r["total_amount"],
            currency=r["currency"], is_fraud=r["is_fraud"], fraud_type=r["fraud_type"],
            raw_text=None,
        ))
    return rows


def _generate_dataset(path: str) -> None:
    """Run scripts/generate_training_invoices.py's generator with its defaults."""
    import importlib.util

    script = os.path.join(ROOT, "scripts", "generate_training_invoices.py")
    spec = importlib.util.spec_from_file_location("generate_training_invoices", script)
    gen = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(gen)
    rows = gen.generate(count=10_000, seed=2026, fraud_rate=0.10)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        for r in rows:
            f.write(json.dumps(r) + "\n")


def featurize_chronological(rows: list):
    """Features where each invoice sees only its vendor's EARLIER invoices."""
    seen = defaultdict(list)
    X = []
    for r in rows:
        X.append(build_features(r, seen[r.vendor_id]))
        seen[r.vendor_id].append(r)
    return np.array(X, dtype=float), np.array([r.is_fraud for r in rows])


def best_threshold(y, p) -> float:
    from sklearn.metrics import f1_score

    best = (0.5, -1.0)
    for t in np.arange(0.1, 0.91, 0.01):
        f = f1_score(y, p >= t, zero_division=0)
        if f > best[1]:
            best = (round(float(t), 2), f)
    return best[0]


# ── Real labels from human review ────────────────────────────────────────────

def _naive(dt):
    if dt is None:
        return None
    return dt.astimezone(timezone.utc).replace(tzinfo=None) if dt.tzinfo else dt


def reviewed_rows(db) -> tuple[np.ndarray, np.ndarray, dict]:
    """
    Feature rows for every invoice a reviewer approved or rejected.

    Each invoice's history is its vendor's invoices uploaded before it, read
    from the database, exactly as the live fraud check sees it.
    """
    from app.models.invoice import Invoice
    from app.models.invoice_review import InvoiceReview

    decided = (
        db.query(Invoice, InvoiceReview.decision)
        .join(InvoiceReview, InvoiceReview.invoice_id == Invoice.id)
        .filter(InvoiceReview.decision.in_(["APPROVE", "REJECT"]))
        .filter(Invoice.total_amount.isnot(None))
        .all()
    )

    by_vendor = defaultdict(list)
    vendor_ids = {inv.vendor_id for inv, _ in decided if inv.vendor_id}
    if vendor_ids:
        for inv in db.query(Invoice).filter(Invoice.vendor_id.in_(vendor_ids)).all():
            by_vendor[inv.vendor_id].append(inv)

    X, y = [], []
    counts = {"approved": 0, "rejected": 0}
    for inv, decision in decided:
        uploaded = _naive(inv.created_at)
        history = [
            h for h in by_vendor.get(inv.vendor_id, [])
            if h.id != inv.id and _naive(h.created_at) and uploaded and _naive(h.created_at) < uploaded
        ]
        row = SimpleNamespace(
            vendor_id=inv.vendor_id, invoice_number=inv.invoice_number,
            invoice_date=inv.invoice_date, due_date=inv.due_date, created_at=uploaded,
            subtotal=inv.subtotal, tax=inv.tax, total_amount=inv.total_amount,
        )
        hist = [SimpleNamespace(
            vendor_id=h.vendor_id, invoice_number=h.invoice_number, invoice_date=h.invoice_date,
            due_date=h.due_date, created_at=_naive(h.created_at),
            subtotal=h.subtotal, tax=h.tax, total_amount=h.total_amount,
        ) for h in history]
        X.append(build_features(row, hist))
        label = 1 if decision == "REJECT" else 0
        y.append(label)
        counts["rejected" if label else "approved"] += 1

    shape = (len(X), len(FEATURE_NAMES))
    return (np.array(X, dtype=float).reshape(shape), np.array(y, dtype=int), counts)


def count_reviews(db) -> dict:
    from sqlalchemy import func

    from app.models.invoice_review import InvoiceReview

    from app.models.invoice import Invoice

    # Same filter as reviewed_rows(): an invoice without a total can't be scored.
    rows = dict(db.query(InvoiceReview.decision, func.count(InvoiceReview.id))
                .join(Invoice, Invoice.id == InvoiceReview.invoice_id)
                .filter(Invoice.total_amount.isnot(None))
                .group_by(InvoiceReview.decision).all())
    return {"approved": rows.get("APPROVE", 0), "rejected": rows.get("REJECT", 0)}


# ── Training ─────────────────────────────────────────────────────────────────

def _bundle_extras(model, X_eval, y_eval, X_legit):
    from sklearn.inspection import permutation_importance

    imp = permutation_importance(model, X_eval, y_eval, scoring="average_precision",
                                 n_repeats=3, random_state=7)
    return {
        "importance": [max(0.0, float(v)) for v in imp.importances_mean],
        "legit_median": np.median(X_legit, axis=0).tolist(),
        "feature_scale": (np.std(X_legit, axis=0) + 1e-6).tolist(),
    }


def retrain_with_reviews(db, progress: Callable[[str], None] = lambda msg: None) -> dict:
    """
    Train on synthetic + reviewed invoices and replace the live model.

    Returns a summary (counts, metrics, version). The result is saved as
    fraud_model.local.joblib; the committed base model is never touched, and
    the previous local model is kept so a bad retrain can be rolled back.
    """
    import joblib
    from sklearn.ensemble import HistGradientBoostingClassifier
    from sklearn.metrics import f1_score, precision_score, recall_score, roc_auc_score
    from sklearn.model_selection import StratifiedKFold

    progress("Loading synthetic training data")
    syn = load_synthetic_rows()
    Xs, ys = featurize_chronological(syn)

    progress("Reading reviewer decisions")
    Xr, yr, counts = reviewed_rows(db)
    n_real = len(yr)

    split = int(len(ys) * 0.8)
    val_start = int(split * 0.85)

    # Threshold tuned on held-out synthetic + (when there are enough) real rows.
    progress("Tuning the decision threshold")
    probe = HistGradientBoostingClassifier(**PARAMS).fit(Xs[:val_start], ys[:val_start])
    threshold = best_threshold(ys[val_start:split], probe.predict_proba(Xs[val_start:split])[:, 1])

    # Honest score on real labels: cross-validated, never on rows the model saw.
    real_cv = None
    if n_real >= MIN_REAL_FOR_SCORE and len(set(yr.tolist())) == 2:
        progress("Cross-validating on reviewer decisions")
        folds = min(5, int(min(np.bincount(yr))))
        if folds >= 2:
            preds = np.zeros(n_real)
            for tr, te in StratifiedKFold(folds, shuffle=True, random_state=7).split(Xr, yr):
                m = HistGradientBoostingClassifier(**PARAMS).fit(
                    np.vstack([Xs[:split], Xr[tr]]), np.concatenate([ys[:split], yr[tr]]),
                    sample_weight=np.concatenate([np.ones(split), np.full(len(tr), REAL_WEIGHT)]),
                )
                preds[te] = m.predict_proba(Xr[te])[:, 1]
            flagged = preds >= threshold
            real_cv = {
                "precision": round(float(precision_score(yr, flagged, zero_division=0)), 4),
                "recall": round(float(recall_score(yr, flagged, zero_division=0)), 4),
                "f1": round(float(f1_score(yr, flagged, zero_division=0)), 4),
                "roc_auc": round(float(roc_auc_score(yr, preds)), 4),
                "folds": folds,
            }

    progress("Training the final model")
    X_all = np.vstack([Xs[:split], Xr]) if n_real else Xs[:split]
    y_all = np.concatenate([ys[:split], yr]) if n_real else ys[:split]
    w_all = np.concatenate([np.ones(split), np.full(n_real, REAL_WEIGHT)])
    model = HistGradientBoostingClassifier(**PARAMS).fit(X_all, y_all, sample_weight=w_all)

    p_test = model.predict_proba(Xs[split:])[:, 1]
    flagged = p_test >= threshold
    synthetic_test = {
        "precision": round(float(precision_score(ys[split:], flagged, zero_division=0)), 4),
        "recall": round(float(recall_score(ys[split:], flagged, zero_division=0)), 4),
        "roc_auc": round(float(roc_auc_score(ys[split:], p_test)), 4),
    }

    progress("Saving the new model")
    version = f"1.1-reviews-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M')}"
    bundle = {
        "version": version,
        "model": model,
        "feature_names": FEATURE_NAMES,
        "threshold": threshold,
        "trained_on": {
            "synthetic_invoices": int(split),
            "real_reviewed_invoices": n_real,
            "real_approved": counts["approved"],
            "real_rejected": counts["rejected"],
            "real_weight": REAL_WEIGHT,
        },
        "trained_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "metrics": {"synthetic_test": synthetic_test, "real_cross_validated": real_cv},
        **_bundle_extras(model, Xs[split:], ys[split:], X_all[y_all == 0]),
    }
    # Keep the previous retrained model; with none, rollback returns to the base.
    if os.path.exists(LOCAL_MODEL_PATH):
        shutil.copyfile(LOCAL_MODEL_PATH, BACKUP_PATH)
    elif os.path.exists(BACKUP_PATH):
        os.remove(BACKUP_PATH)
    joblib.dump(bundle, LOCAL_MODEL_PATH, compress=3)

    from app.ml.model import load_model
    load_model.cache_clear()

    return {
        "version": version,
        "threshold": threshold,
        "trained_on": bundle["trained_on"],
        "metrics": bundle["metrics"],
    }
