"""
Retrain the fraud model with your reviewers' APPROVE/REJECT decisions.

    python scripts/retrain_from_reviews.py

Approved invoices count as legitimate, rejected ones as fraud, each weighted
5x a synthetic invoice. The previous model is kept at
app/ml/fraud_model.prev.joblib; restore it by copying it back over
app/ml/fraud_model.joblib. Admins can also run this from Settings in the app.
"""

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database.connection import SessionLocal  # noqa: E402
import app.main  # noqa: E402,F401  (registers every model)
from app.ml.training import retrain_with_reviews  # noqa: E402


def main():
    db = SessionLocal()
    try:
        summary = retrain_with_reviews(db, progress=lambda m: print(f"… {m}"))
    finally:
        db.close()
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
