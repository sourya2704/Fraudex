# FrauDex — Complete Project Brief (for viva preparation)

> **Instructions for the AI reading this:** This document fully describes my
> final-year project, FrauDex. I am a student and I built the **entire backend
> and the AI/ML part**; a teammate worked on the frontend. My viva is today.
> Please learn this project from this document, then help me by:
> (1) asking me realistic viva questions about it, one at a time, and checking
> my answers; (2) explaining any concept I don't understand in simple words;
> (3) helping me answer questions on progress, feature completion, technical
> implementation, testing, deployment readiness, and my contribution.
> Only use facts from this document about the project — do not invent features
> or numbers. If a question is not answered here, say so.

---

## 1. One-paragraph summary

FrauDex is an AI-powered invoice fraud detection system for Indian GST
invoices. A user uploads an invoice (PDF or image). The system extracts the
invoice data, links it to a vendor, and checks it three ways: a **rule engine**
(about 20 explainable fraud checks), a **trained machine-learning model**
(gradient boosting, 21 features), and a **pipeline of 7 AI agents** (LangGraph)
that writes an explanation citing the company's fraud policies (RAG). The
invoice gets a risk score (0–100) and level (LOW / MEDIUM / HIGH / CRITICAL).
A **human reviewer** makes the final decision (approve / reject / request
further review) with a written reason; every action goes into an audit log.
The AI is advisory only.

**Problem it solves:** companies lose money to duplicate bills, fake vendors,
inflated amounts, invoice splitting to dodge approval limits, and wrong GST.
Manual checking is slow; pure AI is not trustworthy or explainable. FrauDex
combines explainable rules + pattern-learning ML + AI explanations + a human.

---

## 2. Tech stack and why each was chosen

| Layer | Technology | Why |
|---|---|---|
| Backend API | Python, **FastAPI**, Uvicorn | Fast, type-checked request validation (Pydantic), automatic API docs at `/docs` |
| Database | **PostgreSQL** via **SQLAlchemy 2.0** ORM | Relational data (invoices ↔ vendors ↔ reviews), reliable with many users; SQLite is used only for tests |
| Text extraction | **PyMuPDF** (PDF text), **Tesseract OCR** via pytesseract (scanned images) | Get raw text from uploaded invoices |
| Rule engine | Plain Python (`backend/app/fraud/`) | Every flag is explainable to an auditor |
| ML model | **scikit-learn** `HistGradientBoostingClassifier`; model file saved with **joblib** | Best model family for tabular data; fast; gives feature importance |
| AI agents | **LangGraph** (LangChain), LLM = **Google Gemini** (if API key set) or local **Ollama** (`qwen2.5-coder:7b`) | Multi-step reasoning with a shared state; works offline with Ollama |
| Knowledge base | RAG: policy passages + embeddings + cosine similarity | AI explanations are grounded in real policy text, not hallucinated |
| Auth | **JWT** tokens (python-jose), **bcrypt** password hashing (passlib), role-based access | Security |
| Frontend | React + Vite + Tailwind CSS, Recharts, three.js (3D background) | Dashboard UI (teammate's area; I integrated the APIs) |
| Deployment | **Docker** (multi-stage build), Docker Compose, **Render** (hosting), **Neon** (PostgreSQL) | One container serves website + API |
| Testing | **pytest** (25 tests), Playwright (browser end-to-end checks) | Automated verification |

---

## 3. System architecture and data flow

```
Upload invoice (PDF/image)
   → Extraction (PyMuPDF / Tesseract OCR) → Parser (regex) → structured fields
   → Validation (required fields, totals add up)
   → Vendor linking (by name / GSTIN)
   → Fraud check:  Rule engine (≈20 checks)  +  ML model (probability)
   → Risk score 0–100 + risk level + list of fraud flags
   → (optional) AI analysis: 7 LangGraph agents + RAG policy citations
   → Human review: APPROVE / REJECT / REQUEST_FURTHER_REVIEW + written reason
   → Audit log + notifications to admins
   → Reviewer decisions can be used to RETRAIN the ML model
```

Invoice status lifecycle (`InvoiceStatus` enum):
`DRAFT → DOCUMENTS_UPLOADED → PROCESSING → ANALYSIS_READY → UNDER_REVIEW → DECIDED`
(or `PROCESSING_FAILED`).

User roles: `ADMIN`, `FINANCE_MANAGER`, `EMPLOYEE`. Sensitive actions
(batch check, model retrain/rollback, knowledge upload) are restricted by a
`require_role(...)` dependency. Signing up as admin needs a secret
`ADMIN_SIGNUP_KEY`.

---

## 4. Backend code layout (`backend/app/`)

| Folder / file | What it contains |
|---|---|
| `main.py` | Creates the FastAPI app, CORS, creates DB tables, registers all routers, loads the policy knowledge base on first start |
| `serve.py` | Production entry point: mounts the API under `/api` and serves the built React app from the same server |
| `api/` | Route handlers: `auth.py`, `password_reset.py`, `users.py`, `vendors.py`, `invoices.py`, `fraud_analytics.py`, `review.py`, `ai_analysis.py`, `notifications.py`, `ml.py`, `batch.py`, `vendor_insights.py` |
| `models/` | SQLAlchemy tables: user, user_avatar, password_history, password_reset (OTP), vendor, vendor_stats, invoice, invoice_item, fraud_detection_result, invoice_review, ai_fraud_analysis, knowledge_chunk, notification, audit_log |
| `schemas/` | Pydantic request/response models |
| `core/` | `security.py` (JWT, hashing), `dependencies.py` (current user, role checks, DB session), `audit.py`, `notifications.py`, `storage.py` (file storage) |
| `extraction/` | `extractor.py` (PDF text / OCR), `parser.py` (regex field extraction) |
| `validation/` | Field validation (required fields, ₹2 tolerance on totals) |
| `fraud/` | Rule engine: `duplicate.py`, `tax_validation.py`, `date_validation.py`, `anomaly.py`, `vendor_analysis.py`, `detector.py` (runs all), `models.py` (flags + scoring), `config.py` (thresholds) |
| `ml/` | `features.py` (21 features), `model.py` (load + predict), `training.py` (retraining), `fraud_model.joblib` (trained model) |
| `ai/` | `agents.py` (7 agents), `workflow.py` (LangGraph graph) |
| `rag/` | `store.py` (index + search), `embeddings.py`, `chunker.py`, `default_policies.py` (built-in policies), `config.py` |

Main API groups: `/auth` (login, logout, me, change-password, forgot/reset
password with 15-minute OTP), `/users`, `/vendors`, `/invoices` (upload,
extract, validate, detect-fraud, fraud-summary), `/fraud` (statistics,
high-risk invoices, risk distribution, trends, vendor risk), review endpoints
(`/invoices/{id}/review`, `/audit/...`), AI (`/invoices/{id}/ai-analyze`,
`/knowledge/...`), `/notifications`, `/ml` (status, retrain, rollback),
`/batch/fraud-check`, `/vendor-insights`.

---

## 5. Feature-by-feature: what, where, how, why

### 5.1 Invoice extraction
- **Where:** `app/extraction/extractor.py`, `parser.py`.
- **How:** PyMuPDF reads embedded PDF text; if the file is a scanned image,
  Tesseract OCR reads it. The parser uses regular expressions to extract
  invoice number, invoice date, due date, subtotal, tax, total, currency,
  vendor name/GSTIN and line items. A bug was fixed where addresses were
  wrongly read as line items.
- **Accuracy:** tested on 1,000 rendered invoices (reported in
  `docs/ML_MODEL_REPORT.md`).

### 5.2 Rule engine (deterministic fraud detection)
- **Where:** `app/fraud/`. Thresholds in `app/fraud/config.py`.
- **Checks (flag code → severity):**
  - `DUPLICATE_INVOICE` — same vendor + same invoice number → CRITICAL
  - `DUPLICATE_DOCUMENT` — identical extracted text already uploaded → CRITICAL
  - `SIMILAR_INVOICE` — same vendor, amount within 5%, date within 7 days → HIGH if within 0.5% and 2 days, MEDIUM within 2%, else LOW
  - `AMOUNT_STATISTICAL_ANOMALY` — more than 3 standard deviations from the vendor's mean (needs ≥5 past invoices) → MEDIUM, HIGH above 4.5σ
  - `AMOUNT_ANOMALY_UNIFORM` — vendor always billed one fixed amount and this differs → MEDIUM
  - `VENDOR_AMOUNT_SPIKE` — ≥3× the vendor's average → MEDIUM
  - `AMOUNT_BELOW_THRESHOLD` — within 2% below ₹50,000 / ₹1,00,000 / ₹5,00,000 / ₹10,00,000 (invoice splitting) → MEDIUM
  - `RAPID_INVOICE_SUBMISSION` — 5+ invoices from one vendor within 5 minutes → MEDIUM
  - `INVALID_GST_RATE` — effective rate not 0 / 0.25 / 3 / 5 / 12 / 18 / 28% (±1.5 points) → MEDIUM
  - `TAX_CALCULATION_MISMATCH` — total ≠ subtotal + tax beyond ₹2 → LOW/MEDIUM/HIGH by size
  - `EXCESSIVE_TAX_RATE` — above 35% → HIGH
  - `TAX_RATE_DEVIATION` — more than 2 points from the vendor's usual rate → MEDIUM
  - `NEW_VENDOR` — no previous invoices → MEDIUM, HIGH if above ₹10,000
  - `UNKNOWN_VENDOR` — no vendor linked → LOW
  - `HIGH_VENDOR_REJECTION_RATE` — over 30% of the vendor's reviewed invoices rejected (≥5 reviews) → HIGH
  - `FUTURE_INVOICE_DATE` → HIGH; `BACK_DATED_INVOICE` (dated >1 day after upload) → MEDIUM; `VERY_OLD_INVOICE` (>730 days) → MEDIUM; `DUE_DATE_BEFORE_INVOICE` → HIGH; `EXTENDED_PAYMENT_TERMS` (>180 days) → LOW
  - `ML_FRAUD_PATTERN` — added when the ML model's probability is above its threshold → HIGH at ≥90%, else MEDIUM
- **Risk score formula** (`app/fraud/models.py`): each flag adds points by
  severity (INFO 2, LOW 8, MEDIUM 18, HIGH 30, CRITICAL 55), but each severity
  bucket is **capped** (INFO 5, LOW 15, MEDIUM 30, HIGH 45, CRITICAL 70) so,
  for example, two HIGH flags don't automatically reach 100. Total is clamped
  to 0–100. Levels: 0–24 LOW, 25–49 MEDIUM, 50–74 HIGH, 75–100 CRITICAL.
- **Why rules:** fully explainable and deterministic.
- **Tuning done:** removed rules that caused constant false positives
  (weekend invoices, month-start invoices); raised the outlier threshold from
  2σ to 3σ (2σ flags about 5% of normal invoices); the threshold-splitting
  window was narrowed from 5% to 2%.

### 5.3 Machine-learning fraud model
- **Where:** `app/ml/`; scripts `backend/scripts/generate_training_invoices.py`,
  `train_fraud_model.py`, `retrain_from_reviews.py`; report `docs/ML_MODEL_REPORT.md`.
- **Data:** 10,000 **synthetic** Indian GST invoices (938 fraudulent = 9.4%,
  306 vendors), generated with realistic vendor behaviour and 9 fraud types:
  duplicate resubmission, threshold splitting, inflated amount, tax tampering,
  near duplicate, fake vendor, invalid GST rate, date manipulation, rate switch.
- **Model:** `HistGradientBoostingClassifier` (gradient-boosted decision
  trees). Chosen because it is the strongest model family for tabular data,
  needs no feature scaling, handles missing values, trains fast, and gives
  feature importance.
- **21 features** (`app/ml/features.py`): log_total, has_vendor,
  vendor_history_count, amount_z_score, ratio_to_vendor_mean,
  ratio_to_vendor_max, tax_rate, gst_slab_distance,
  tax_rate_deviation_from_vendor, total_mismatch_log, total_mismatch_ratio,
  payment_terms_days, due_before_invoice, days_dated_after_upload,
  invoice_age_days, just_below_threshold, is_round_thousand,
  duplicate_number_count, similar_invoice_count, same_day_submissions,
  missing_field_count. Features are computed only from data available
  **before** the invoice (vendor history up to that point) to avoid leakage.
- **Training method:** time-based split — first 8,000 uploads train, last
  2,000 (191 fraudulent) test — because in real use you predict future
  invoices from past ones. The decision threshold is tuned for best F1
  (≈0.59 probability).
- **Results on the held-out test set:**

| System | Precision | Recall | F1 | False-positive rate | ROC-AUC |
|---|---|---|---|---|---|
| Rules only (score ≥ 25) | 78.6% | 74.9% | 0.767 | 2.16% | 0.968 |
| ML only (p ≥ 0.59) | 84.9% | 88.0% | 0.864 | 1.66% | 0.992 |
| **Rules + ML flag (what the app runs)** | 77.9% | **90.6%** | 0.838 | 2.71% | 0.988 |

- **Recall by fraud type (rules → rules+ML):** duplicate 100→100%, threshold
  splitting 65→77%, inflated amount 88→88%, tax tampering 77→100%, near
  duplicate 15→60%, fake vendor 100→100%, invalid GST 100→100%, date
  manipulation 73→100%, rate switch 0→100%. The ML catches what rules miss.
- **Most important features (permutation importance):**
  tax_rate_deviation_from_vendor (0.178), duplicate_number_count (0.177),
  ratio_to_vendor_mean (0.069), similar_invoice_count (0.063),
  payment_terms_days (0.055), just_below_threshold (0.053).
- **Bug found and fixed — data leakage / overconfidence:** the model gave an
  ordinary invoice 99.7% fraud probability. Cause: in the synthetic data, only
  fraudulent invoices had paise (decimal) amounts and legitimate ones were
  whole rupees, and late uploads were rare — so the model learned "paise =
  fraud". Fix: the generator now gives legitimate invoices realistic paise
  amounts and a realistic tail of late uploads (up to 540 days), and tax-rate
  features are rounded so floating-point noise can't leak the label. After
  the fix, that invoice scores 12.8%, and recall is the honest 90.6% (earlier
  inflated figure was 95.5%).
- **Performance fix:** scoring one invoice took ~4.5 s because scikit-learn's
  OpenMP threads oversubscribed the CPU. Limiting prediction to 1 thread with
  `threadpoolctl` → 37 ms per invoice (~120× faster). ~1,000 invoices can be
  re-checked in about a minute.
- **Retraining from reviewer decisions (human-in-the-loop learning):**
  Settings → Fraud model panel (admins). Retraining uses the synthetic data
  plus real reviewer decisions (APPROVE → legit, REJECT → fraud), with real
  decisions weighted 5×. It runs in a background thread, saves to a separate
  file (`fraud_model.local.joblib`, not in git) so the original model is never
  overwritten, keeps a backup, and supports **Rollback** to the previous or
  original model.

### 5.4 AI agents (LangGraph multi-agent pipeline)
- **Where:** `app/ai/agents.py`, `app/ai/workflow.py`; API
  `POST /invoices/{id}/ai-analyze`.
- **The 7 agents, in order** (each reads and adds to a shared state):
  1. `invoice_analyzer` — loads the invoice, rule flags, deterministic score, ML probability and top ML factors
  2. `duplicate_checker` — exact and near-duplicate findings
  3. `vendor_analyzer` — vendor context (history count, average amount, this invoice vs average)
  4. `historical_analyzer` — turns history into signals (e.g. amount far above average, new vendor with high value, ML pattern)
  5. `rag_evidence_retriever` — finds the policy passage behind each flag (see 5.5), tags them P1, P2, …
  6. `risk_assessor` — asks the LLM for a 0–100 score; **final = 60% deterministic + 40% AI**; maps to a level
  7. `explanation_writer` — LLM writes a short, evidence-based report for the reviewer, citing policies as [P1], [P2]; says "signals suggest", never "this IS fraud"
- **LLM choice:** Gemini if `GEMINI_API_KEY` is set, otherwise local Ollama.
- **No-LLM fallback:** if no LLM is reachable, the system does **not**
  invent an AI score. It reports the deterministic score and writes a
  rule-based summary that still cites the relevant policies.
- **Why LangGraph:** each agent has one job, the shared state makes each
  step inspectable (an `agent_trace` is stored), and the graph is easy to
  extend.

### 5.5 RAG policy knowledge base
- **Where:** `app/rag/`; built-in content in `app/rag/default_policies.py`.
- **Content:** 34 passages in 4 documents — GST Tax Rules India; Invoice Fraud
  Detection Rules (one passage per flag code, thresholds match the code);
  Financial Fraud Patterns Reference; Human Review Decision Guidelines.
  Loaded automatically on first server start if the knowledge base is empty.
  Admins can also upload their own PDF/text policies (`/knowledge/upload`).
- **How retrieval works:** each passage is stored with an embedding (vector)
  in the `knowledge_chunks` table (JSON column, so no pgvector extension is
  needed). For each flag on an invoice, the retriever first takes the passage
  whose heading names that flag code (exact match); otherwise it runs a
  cosine-similarity search. Flags are processed most-severe first; at most 5
  passages, the last slot reserved for the review guideline.
- **Embeddings:** Ollama's `nomic-embed-text` (768-dim) when Ollama runs;
  otherwise a **local hashing embedding** (bag of words + word pairs hashed
  into 1,024 dimensions, log-scaled, L2-normalised; flag codes weighted 3×).
  The two vector sizes differ, so the store never compares mismatched vectors.
  This makes RAG work in the cloud with no extra service.
- **Why:** grounding — the explanation quotes real policy instead of making
  things up.

### 5.6 Human review, audit and notifications
- Review decisions APPROVE / REJECT / REQUEST_FURTHER_REVIEW, each with a
  mandatory written reason (`api/review.py`); every action is in the audit log
  (`/audit/...`). Admins get notifications for high-risk invoices.
- Bug fixed: submitting a review crashed (HTTP 500) for invoices with no
  uploader (seeded data) because it tried to notify a null user.

### 5.7 Bulk upload and batch fraud check
- Upload up to 50 invoices at once with a results list.
- `POST /batch/fraud-check` (`api/batch.py`) checks all unchecked invoices
  (or re-checks all) in a background thread with a lock (one job at a time),
  commits every 50, shows live progress (polled every 1.5 s), and sends one
  summary notification instead of one per invoice.

### 5.8 Vendor insights
- `GET /vendor-insights/` — every vendor with invoice count, total billed,
  average risk, high-risk count, rejection rate (3 grouped SQL queries, no
  per-vendor query loop).
- `GET /vendor-insights/{id}` — median/max amount, usual GST rate (mode),
  approvals/rejections, risk-level mix, top fraud flags, month-by-month amount
  and average risk, recent invoices. Frontend shows Vendors list and Vendor
  profile with charts.

### 5.9 Security
- JWT access tokens (also set as an HttpOnly cookie), bcrypt-hashed passwords,
  password history (prevents reusing recent passwords), forgot-password with a
  15-minute email OTP, role-based access control, admin signup key, secrets
  only in environment variables, full audit trail.

### 5.10 Frontend (teammate's main area; I integrated it)
- Pages: Login, Signup, Forgot password, Dashboard, Upload Invoice (single and
  bulk), Invoices list (with "Check all"), Invoice detail (fraud flags, AI
  analysis, cited policies, review form, audit timeline), Vendors, Vendor
  profile, Fraud Detection, Analytics, Audit Log, Settings (profile photo,
  password, fraud model panel). 3D animated background, dark and light mode,
  fixed sidebar, custom (non-default) colour palette.

---

## 6. Testing

- **Unit/integration tests — 25 pytest tests** (`backend/tests/`), run on an
  isolated temporary SQLite database:
  - `test_fraud.py` — rule engine behaviour
  - `test_parser.py` — field extraction
  - `test_auth.py` — authentication
  - `test_ml.py` — ordinary invoices (including one uploaded 290 days late)
    must score below the threshold; fraud patterns (invoice >2 years old,
    duplicate number, 21% GST, 8× usual amount) must score at or above it
  - `test_knowledge.py` — every flag code has a policy passage; search finds
    the right rule; the explanation cites [P1] and [P2]; empty knowledge base
    is reported correctly
- **ML evaluation:** held-out time-based test set, precision / recall / F1 /
  ROC-AUC / false-positive rate, recall per fraud type, permutation importance.
- **Parser accuracy:** 1,000 rendered invoices.
- **End-to-end:** Playwright browser tests of login, upload (single and bulk),
  check all, AI analysis with cited policies, vendor pages, retrain/rollback,
  dark and light mode; plus the full flow tested inside Docker.
- **Bugs found by testing:** review endpoint 500, ML leakage/overconfidence,
  slow scoring, retrain overwriting the committed model (fixed with a
  separate local model file + rollback).

---

## 7. Deployment readiness

- **Docker:** multi-stage `Dockerfile` — stage 1 builds the React app with
  Node; stage 2 is Python 3.13 with Tesseract, installs the backend, copies the
  built site, and runs `uvicorn app.serve:app`. Website and API on one origin
  (API under `/api`), so no CORS or cross-site cookie problems.
- **`docker-compose.prod.yml`:** PostgreSQL 16 + the app, with volumes for the
  database and uploaded files, health checks, restart policy;
  settings in `.env.prod` (from `.env.prod.example`).
- **Cloud:** deployed on **Render** (free web service) using `render.yaml`
  (Blueprint), with the database on **Neon** (free PostgreSQL) because Render
  allows only one free database per account.
- **Startup automation:** creates the first admin from `ADMIN_EMAIL` /
  `ADMIN_PASSWORD`, loads the policy knowledge base, optionally seeds ~1,000
  demo invoices (`SEED_DEMO_DATA=true`), exposes `/health`, refuses to start
  without `DATABASE_URL` (instead of silently using a throwaway SQLite file),
  accepts `postgres://` URLs.
- **Known limitations (honest):**
  1. Training data is synthetic — real labelled invoices are needed; that's why
     retraining from reviewer decisions exists.
  2. Render free tier sleeps after 15 minutes idle (first visit ~1 minute) and
     uploaded files are lost on redeploy; production should use cloud storage
     (e.g. S3).
  3. AI-written explanations need an LLM (Gemini key or Ollama); without one
     the rule-based summary is used.
  4. Accounts on the local database don't exist in the deployed database
     (separate databases).

---

## 8. Project progress / feature completion

All planned features are complete, tested and deployed:

| Feature | Status |
|---|---|
| Upload + extraction (PDF, OCR) + validation | Done |
| Rule engine (~20 checks) + risk scoring | Done, tuned for fewer false positives |
| ML model (10k invoices, 21 features) + evaluation report | Done, leakage fixed |
| Retraining from reviewer decisions + rollback | Done |
| 7-agent LangGraph AI analysis | Done, with no-LLM fallback |
| RAG knowledge base with policy citations | Done, works without Ollama |
| Human review + audit log + notifications | Done |
| Bulk upload + batch "Check all" | Done, 120× faster scoring |
| Vendor list and vendor profile pages | Done |
| Auth, roles, password reset (OTP), profile photo | Done |
| UI redesign (3D, dark/light) | Done |
| Tests (25 pytest + browser E2E) | Done |
| Docker + Render/Neon deployment | Done |

**Future work:** real labelled data; cloud file storage; email/Slack alerts;
a purchase-order (PO) matching check; GSTIN verification against the
government GST API; better OCR for low-quality scans.

---

## 9. My contribution (backend + AI)

I designed and built the complete backend and AI/ML layer:
- FastAPI application, all API endpoints, database models and relationships,
  authentication (JWT, bcrypt, roles, password reset with OTP, password
  history), audit logging and notifications;
- invoice extraction (PyMuPDF + Tesseract OCR) and the regex parser;
- the rule-based fraud engine and the capped risk-scoring formula, and tuning
  it to reduce false positives;
- the ML pipeline end to end: synthetic data generator, 21 features,
  gradient-boosting training with a time-based split, evaluation report,
  finding and fixing the data-leakage bug, the 120× speed-up, and retraining
  from reviewer decisions with rollback;
- the 7-agent LangGraph AI pipeline with Gemini/Ollama and a no-LLM fallback;
- the RAG knowledge base with policy citations and a local embedding fallback;
- batch fraud checking and the vendor-insights APIs;
- pytest test suite and Docker/Render deployment.

---

## 10. Key concepts I should be able to explain (with the project example)

- **Precision vs recall:** recall = share of frauds caught; precision = share
  of flags that are real fraud. For fraud detection, recall matters more
  (missing a fraud costs money); a human reviewer filters false alarms. Our
  combined system: recall 90.6%, precision 77.9%.
- **F1 score:** harmonic mean of precision and recall; used to tune the ML threshold.
- **ROC-AUC:** how well the model ranks fraud above legit across all thresholds (0.988).
- **Class imbalance:** only 9.4% fraud — why accuracy is a misleading metric and we report precision/recall.
- **Data leakage:** the model learning from information that won't exist (or
  is artificial) in real use — our paise-amount example.
- **Time-based split:** train on the past, test on the future, like real use.
- **Gradient boosting:** many small decision trees, each correcting the
  previous trees' errors.
- **Feature engineering:** turning raw invoice data into signals the model can
  learn from (e.g. ratio to vendor's mean).
- **Permutation importance:** shuffle one feature and see how much the score drops.
- **Embedding / cosine similarity:** text → vector; similar text → vectors pointing the same way.
- **RAG:** retrieve relevant documents, then generate an answer grounded in them.
- **LangGraph agents:** nodes (agents) in a graph passing a shared state.
- **Human-in-the-loop:** AI advises, a human decides, and the decisions feed back into retraining.
- **JWT:** signed token proving who is logged in; server doesn't store sessions.
- **Docker multi-stage build:** build the frontend in one image, copy only the result into the final image.
- **Z-score:** (value − mean) / standard deviation; >3 means a rare outlier.

---

## 11. Likely viva questions to practise

1. Explain your project in 1 minute.
2. Why combine rules, ML and AI instead of using one?
3. Walk through what happens when an invoice is uploaded.
4. How is the risk score calculated? Why cap each severity?
5. Why gradient boosting and not a neural network?
6. How did you get training data? What are the risks of synthetic data?
7. What is data leakage? Did you face it? How did you fix it?
8. Why a time-based split instead of a random split?
9. What do precision 77.9% and recall 90.6% mean? Which matters more here?
10. What are your most important features and why do they make sense?
11. How does retraining from reviewer decisions work? Why weight real data 5×? What if a retrained model is worse?
12. Explain your LangGraph pipeline. Why 7 agents?
13. What is RAG? How do you retrieve policies? What is an embedding?
14. What happens if the LLM is down?
15. How do you stop the AI from hallucinating?
16. How did you make scoring 120× faster?
17. How is the system secured?
18. How did you test it? Show a test.
19. How is it deployed? Why Docker? Why Neon?
20. What are the limitations and what would you do next?
21. What exactly did you build yourself?
