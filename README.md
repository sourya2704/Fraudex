# Fraudex
Fraudex is an AI-powered invoice fraud detection system that combines rule-based validation, historical analysis, RAG, and multi-agent AI to identify suspicious invoices and provide explainable risk assessments.

## Deploy with Docker

```bash
cp .env.prod.example .env.prod   # change the passwords
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

Then open http://localhost:8080. See [DEPLOY.md](DEPLOY.md) for servers and Render.

## Fraud model (backend/app/ml)

The rule engine (`backend/app/fraud`) is combined with a trained gradient-boosting
model. When the model rates an invoice above its threshold, the fraud check adds an
`ML_FRAUD_PATTERN` flag, and the AI analysis agents see the model's probability.

```bash
cd backend
python scripts/generate_training_invoices.py   # 10,000 labelled invoices -> data/training/
python scripts/train_fraud_model.py            # trains, evaluates, writes app/ml/fraud_model.joblib
```

Results and per-fraud-type recall are in [`docs/ML_MODEL_REPORT.md`](docs/ML_MODEL_REPORT.md).
The training data is **synthetic**; retrain on your reviewers' real APPROVE/REJECT
decisions once you have them.

## Tests

```bash
cd backend
pip install -r requirements-dev.txt
python -m pytest tests
```
