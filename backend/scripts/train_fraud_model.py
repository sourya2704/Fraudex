"""
Train and evaluate the invoice fraud model.

    python scripts/generate_training_invoices.py     # once: builds data/training/
    python scripts/train_fraud_model.py

Steps
  1. Load data/training/invoices.jsonl and build features with app/ml/features.py,
     where each invoice only sees its vendor's EARLIER invoices (no look-ahead).
  2. Time-based split: oldest 80% train (last 15% of that picks the threshold),
     newest 20% test — the model is judged on invoices it has never seen,
     from a later period, as it would be in production.
  3. Run the existing 16-rule engine (app/fraud) on the same test invoices in a
     scratch SQLite database, inserting invoices in upload order.
  4. Report rules-only, model-only and rules+model on the test set, plus the
     parser's field accuracy on the rendered invoice texts.
  5. Save app/ml/fraud_model.joblib and docs/ML_MODEL_REPORT.md.
"""

import json
import os
import sys
import tempfile
from collections import defaultdict
from decimal import Decimal

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

# Scratch database for the rule-engine run; must be set before app imports.
_tmpdir = tempfile.mkdtemp(prefix="fraudex-train-")
os.environ["DATABASE_URL"] = f"sqlite:///{os.path.join(_tmpdir, 'eval.db')}"
os.environ["SQL_ECHO"] = "false"

import joblib  # noqa: E402
import numpy as np  # noqa: E402
from sklearn.ensemble import HistGradientBoostingClassifier  # noqa: E402
from sklearn.inspection import permutation_importance  # noqa: E402
from sklearn.metrics import (  # noqa: E402
    average_precision_score,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)

from app.ml.features import FEATURE_NAMES, build_features  # noqa: E402
from app.ml.training import PARAMS, best_threshold, featurize_chronological, load_synthetic_rows  # noqa: E402

DATA = os.path.join(ROOT, "data", "training")
MODEL_OUT = os.path.join(ROOT, "app", "ml", "fraud_model.joblib")
REPORT_OUT = os.path.join(ROOT, "..", "docs", "ML_MODEL_REPORT.md")
MODEL_VERSION = "1.0"


def load_rows():
    return load_synthetic_rows(os.path.join(DATA, "invoices.jsonl"))


featurize = featurize_chronological


def run_rule_engine(rows, test_ids, model_bundle):
    """Rules-only and rules+model results for the test invoices."""
    from app.database.connection import Base, SessionLocal, engine
    from app.fraud.detector import FraudDetector
    from app.fraud.models import FraudDetectionResult, FraudFlag, Severity
    from app.ml.model import flag_from_score
    from app.models import invoice as _inv  # noqa: F401  (register models)
    from app.models.invoice import Invoice
    from app.models.vendor import Vendor
    import app.models.invoice_item  # noqa: F401
    import app.models.invoice_review  # noqa: F401
    import app.models.user  # noqa: F401

    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    vendors = {}
    results = {}
    history = defaultdict(list)
    model = model_bundle["model"]

    for r in rows:
        if r.vendor_id not in vendors:
            v = Vendor(id=r.vendor_id, name=r.vendor_name, tax_id=r.vendor_gstin)
            db.add(v)
            vendors[r.vendor_id] = v
        inv = Invoice(
            id=r.id, vendor_id=r.vendor_id, invoice_number=r.invoice_number,
            invoice_date=r.invoice_date, due_date=r.due_date, created_at=r.created_at,
            subtotal=Decimal(str(r.subtotal)), tax=Decimal(str(r.tax)),
            total_amount=Decimal(str(r.total_amount)), currency="INR", status="ANALYSIS_READY",
        )
        db.add(inv)
        db.flush()

        if r.id in test_ids:
            rules = FraudDetector(db, use_ml=False).detect_fraud(inv)
            rule_score = rules.calculate_risk_score()

            features = build_features(r, history[r.vendor_id])
            prob = float(model.predict_proba([features])[0][1])
            flag = flag_from_score(
                {"probability": prob, "threshold": model_bundle["threshold"], "top_factors": []},
                FraudFlag, Severity,
            )
            combined = FraudDetectionResult(invoice_id=r.id, flags=list(rules.flags) + ([flag] if flag else []))
            results[r.id] = {
                "rule_score": rule_score,
                "rule_codes": sorted({f.code for f in rules.flags}),
                "ml_prob": prob,
                "combined_score": combined.calculate_risk_score(),
            }
        history[r.vendor_id].append(r)

    db.commit()
    db.close()
    return results


def metrics(y, flagged, score=None):
    out = {
        "precision": precision_score(y, flagged, zero_division=0),
        "recall": recall_score(y, flagged, zero_division=0),
        "f1": f1_score(y, flagged, zero_division=0),
        "false_positive_rate": float(np.mean(flagged[y == 0])) if (y == 0).any() else 0.0,
    }
    if score is not None:
        out["roc_auc"] = roc_auc_score(y, score)
        out["pr_auc"] = average_precision_score(y, score)
    return {k: round(float(v), 4) for k, v in out.items()}


def parser_accuracy(rows_by_id):
    from app.extraction.parser import normalize_gstin, parse_invoice_text

    texts_dir = os.path.join(DATA, "texts")
    if not os.path.isdir(texts_dir):
        return None
    fields = ["invoice_number", "invoice_date", "due_date", "subtotal", "tax", "total_amount", "currency", "vendor_gstin"]
    correct = {f: 0 for f in fields}
    n = 0
    for name in sorted(os.listdir(texts_dir)):
        r = rows_by_id[int(name.split(".")[0])]
        with open(os.path.join(texts_dir, name)) as f:
            parsed = parse_invoice_text(f.read())
        got = parsed["fields"]
        n += 1
        checks = {
            "invoice_number": got["invoice_number"] == r.invoice_number,
            "invoice_date": got["invoice_date"] == r.invoice_date,
            "due_date": got["due_date"] == r.due_date,
            "subtotal": got["subtotal"] is not None and abs(float(got["subtotal"]) - r.subtotal) < 0.01,
            "tax": got["tax"] is not None and abs(float(got["tax"]) - r.tax) < 0.02,
            "total_amount": got["total_amount"] is not None and abs(float(got["total_amount"]) - r.total_amount) < 0.01,
            "currency": got["currency"] == "INR",
            "vendor_gstin": normalize_gstin(parsed["vendor"]["gstin"]) == r.vendor_gstin,
        }
        for k, ok in checks.items():
            correct[k] += int(ok)
    return {"documents": n, "field_accuracy": {k: round(v / n, 4) for k, v in correct.items()}}


def main():
    rows = load_rows()
    X, y = featurize(rows)
    n = len(rows)
    split = int(n * 0.8)
    val_start = int(split * 0.85)

    X_fit, y_fit = X[:val_start], y[:val_start]
    X_val, y_val = X[val_start:split], y[val_start:split]
    X_test, y_test = X[split:], y[split:]
    print(f"{n} invoices — fit {len(y_fit)}, threshold-tuning {len(y_val)}, test {len(y_test)} "
          f"({y_test.sum()} fraud in test)")

    params = PARAMS
    model = HistGradientBoostingClassifier(**params).fit(X_fit, y_fit)
    threshold = best_threshold(y_val, model.predict_proba(X_val)[:, 1])

    # Final model on all training data (fit + validation), same threshold.
    model = HistGradientBoostingClassifier(**params).fit(X[:split], y[:split])
    p_test = model.predict_proba(X_test)[:, 1]
    ml_metrics = metrics(y_test, p_test >= threshold, p_test)
    print("model:", ml_metrics)

    imp = permutation_importance(model, X_test, y_test, scoring="average_precision",
                                 n_repeats=5, random_state=7)
    importance = [max(0.0, float(v)) for v in imp.importances_mean]
    legit_train = X[:split][y[:split] == 0]
    bundle = {
        "version": MODEL_VERSION,
        "model": model,
        "feature_names": FEATURE_NAMES,
        "threshold": threshold,
        "importance": importance,
        "legit_median": np.median(legit_train, axis=0).tolist(),
        "feature_scale": (np.std(legit_train, axis=0) + 1e-6).tolist(),
        "trained_on": {"invoices": int(split), "fraud": int(y[:split].sum())},
    }

    print("running the rule engine on the test set (this takes a minute)…")
    test_ids = {r.id for r in rows[split:]}
    engine_results = run_rule_engine(rows, test_ids, bundle)
    test_rows = rows[split:]
    rule_score = np.array([engine_results[r.id]["rule_score"] for r in test_rows])
    comb_score = np.array([engine_results[r.id]["combined_score"] for r in test_rows])

    rules_medium = metrics(y_test, rule_score >= 25, rule_score)
    rules_high = metrics(y_test, rule_score >= 50, rule_score)
    combined_medium = metrics(y_test, comb_score >= 25, comb_score)
    combined_high = metrics(y_test, comb_score >= 50, comb_score)

    by_type = defaultdict(lambda: [0, 0, 0, 0])
    for r, rs, cs, p in zip(test_rows, rule_score, comb_score, p_test):
        if r.is_fraud:
            row = by_type[r.fraud_type]
            row[0] += 1
            row[1] += int(rs >= 25)
            row[2] += int(p >= threshold)
            row[3] += int(cs >= 25)

    legit_fp_codes = defaultdict(int)
    for r in test_rows:
        if not r.is_fraud and engine_results[r.id]["rule_score"] >= 25:
            for c in engine_results[r.id]["rule_codes"]:
                legit_fp_codes[c] += 1

    parsing = parser_accuracy({r.id: r for r in rows})

    bundle["metrics"] = {
        "model": ml_metrics, "rules_medium": rules_medium, "rules_high": rules_high,
        "combined_medium": combined_medium, "combined_high": combined_high, "parser": parsing,
    }
    joblib.dump(bundle, MODEL_OUT, compress=3)
    print(f"saved {MODEL_OUT} ({os.path.getsize(MODEL_OUT) / 1024:.0f} KB), threshold {threshold}")

    def row(name, m):
        return (f"| {name} | {m['precision']:.1%} | {m['recall']:.1%} | {m['f1']:.3f} | "
                f"{m['false_positive_rate']:.2%} | {m.get('roc_auc', float('nan')):.3f} |")

    top_imp = sorted(zip(FEATURE_NAMES, importance), key=lambda x: -x[1])[:10]
    lines = [
        "# FrauDex fraud model — training report",
        "",
        "Generated by `backend/scripts/train_fraud_model.py`. Re-run it after regenerating data.",
        "",
        "## Data",
        "",
        f"- {n:,} synthetic Indian GST invoices from `scripts/generate_training_invoices.py` "
        f"({int(y.sum())} fraudulent, {y.mean():.1%}), {len({r.vendor_key for r in rows})} vendors.",
        "- **Synthetic, not real invoices.** Vendor behaviour and fraud patterns are modelled on Indian "
        "B2B invoicing; real labelled invoices (approved/rejected by your reviewers) should replace "
        "or be added to this set before relying on the numbers below.",
        f"- Time-based split: first {split:,} uploads for training, last {n - split:,} "
        f"({int(y_test.sum())} fraudulent) held out for testing.",
        "",
        "## Results on the held-out test set",
        "",
        "| System | Precision | Recall | F1 | False-positive rate | ROC-AUC |",
        "|---|---|---|---|---|---|",
        row("Rules only, flag at MEDIUM (score ≥ 25)", rules_medium),
        row("Rules only, flag at HIGH (score ≥ 50)", rules_high),
        row(f"ML model only (p ≥ {threshold})", ml_metrics),
        row("Rules + ML flag, MEDIUM (≥ 25) — what the app now runs", combined_medium),
        row("Rules + ML flag, HIGH (≥ 50)", combined_high),
        "",
        "### Recall by fraud type (MEDIUM threshold)",
        "",
        "| Fraud type | Test cases | Rules | ML | Rules + ML |",
        "|---|---|---|---|---|",
    ]
    for t, (cnt, r_hit, m_hit, c_hit) in sorted(by_type.items(), key=lambda x: -x[1][0]):
        lines.append(f"| {t} | {cnt} | {r_hit / cnt:.0%} | {m_hit / cnt:.0%} | {c_hit / cnt:.0%} |")
    lines += [
        "",
        "### Rules that fired on legitimate invoices (score ≥ 25)",
        "",
        "| Rule | Legit invoices flagged |",
        "|---|---|",
    ]
    for code, cnt in sorted(legit_fp_codes.items(), key=lambda x: -x[1]):
        lines.append(f"| {code} | {cnt} |")
    if not legit_fp_codes:
        lines.append("| — | 0 |")
    lines += ["", "## Most important features", "", "| Feature | Permutation importance (PR-AUC drop) |", "|---|---|"]
    for name, v in top_imp:
        lines.append(f"| {name} | {v:.4f} |")
    if parsing:
        lines += ["", f"## Parser accuracy ({parsing['documents']} rendered invoices)", "",
                  "| Field | Exact match |", "|---|---|"]
        for k, v in parsing["field_accuracy"].items():
            lines.append(f"| {k} | {v:.1%} |")
    os.makedirs(os.path.dirname(REPORT_OUT), exist_ok=True)
    with open(REPORT_OUT, "w") as f:
        f.write("\n".join(lines) + "\n")
    print("\n".join(lines))


if __name__ == "__main__":
    main()
