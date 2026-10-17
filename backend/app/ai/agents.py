import os
import re
from decimal import Decimal
from typing import Any
from sqlalchemy.orm import Session
from dotenv import load_dotenv

load_dotenv()

from app.ai.state import FraudAnalysisState
from app.models.invoice import Invoice
from app.models.fraud_detection_result import FraudDetectionResult
from app.rag.config import AI_WEIGHT, DETERMINISTIC_WEIGHT
from app.rag.store import RAGStore

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL     = os.getenv("GEMINI_MODEL", "gemini-3-flash-preview")
GEMINI_FALLBACKS = ["gemini-flash-latest", "gemini-pro-latest", "gemini-flash-lite-latest"]


class LLMUnavailable(Exception):
    """No LLM could be reached; callers fall back to deterministic output."""


def _call_gemini(prompt: str) -> str:
    """Call Gemini API with automatic model fallback on 503."""
    from google import genai
    client = genai.Client(api_key=GEMINI_API_KEY)

    models_to_try = [GEMINI_MODEL] + GEMINI_FALLBACKS
    last_error = None

    for model in models_to_try:
        try:
            response = client.models.generate_content(model=model, contents=prompt)
            return response.text.strip()
        except Exception as e:
            err_str = str(e)
            # Only retry on 503 or 429 (rate limit) — fail fast on auth/not found
            if "503" in err_str or "429" in err_str or "UNAVAILABLE" in err_str:
                print(f"[GEMINI] model={model} unavailable, trying next...")
                last_error = e
                continue
            raise  # re-raise other errors (404, auth, etc.)

    raise last_error


def _call_ollama(prompt: str) -> str:
    from langchain_ollama import ChatOllama
    from app.rag.config import OLLAMA_BASE_URL, OLLAMA_LLM_MODEL

    llm = ChatOllama(base_url=OLLAMA_BASE_URL, model=OLLAMA_LLM_MODEL, temperature=0)
    return llm.invoke(prompt).content.strip()


def _call_llm(prompt: str) -> tuple[str, str]:
    """
    Run the prompt on Gemini (if GEMINI_API_KEY is set) and otherwise on the
    local Ollama model. Returns (text, provider). Raises LLMUnavailable when
    neither answers, so callers can say so instead of inventing a score.
    """
    errors = []
    if GEMINI_API_KEY:
        try:
            return _call_gemini(prompt), "gemini"
        except Exception as e:
            errors.append(f"gemini: {type(e).__name__}: {e}")
    try:
        return _call_ollama(prompt), "ollama"
    except Exception as e:
        errors.append(f"ollama: {type(e).__name__}: {e}")
    raise LLMUnavailable("; ".join(errors))


def _parse_score(text: str) -> float:
    """First number in the reply, clamped to 0-100 ("Score: 45/100" -> 45)."""
    match = re.search(r"\d+(?:\.\d+)?", text or "")
    if not match:
        raise ValueError(f"no score in LLM reply: {text!r}")
    return min(100.0, max(0.0, float(match.group())))


def _safe_float(v) -> float | None:
    if v is None:
        return None
    try:
        return float(v)
    except Exception:
        return None


# ── Agent 1: Invoice Analyzer ────────────────────────────────────────────────

def invoice_analyzer(state: FraudAnalysisState, db: Session) -> FraudAnalysisState:
    invoice = db.query(Invoice).filter(Invoice.id == state["invoice_id"]).first()
    if not invoice:
        return {**state, "error": f"Invoice {state['invoice_id']} not found"}

    fraud_result = db.query(FraudDetectionResult).filter(
        FraudDetectionResult.invoice_id == state["invoice_id"]
    ).first()

    if fraud_result:
        det_score = fraud_result.risk_score
        raw_flags = fraud_result.fraud_flags or []
    else:
        # Fraud check was never run: run it now instead of treating the
        # deterministic score as 0.
        from app.fraud.detector import FraudDetector
        detection = FraudDetector(db).detect_fraud(invoice).to_dict()
        det_score = detection["risk_score"]
        raw_flags = detection["fraud_flags"]
    flags_summary = [
        f"{f['severity']}: {f['code']} — {f['message']}" for f in raw_flags
    ]

    from app.ml.model import score_invoice
    try:
        ml = score_invoice(db, invoice)
    except Exception as e:
        print(f"[ML] scoring failed: {e}")
        ml = None

    context = {
        "invoice_id": invoice.id,
        "invoice_number": invoice.invoice_number,
        "vendor_id": invoice.vendor_id,
        "invoice_date": str(invoice.invoice_date) if invoice.invoice_date else None,
        "due_date": str(invoice.due_date) if invoice.due_date else None,
        "total_amount": _safe_float(invoice.total_amount),
        "subtotal": _safe_float(invoice.subtotal),
        "tax": _safe_float(invoice.tax),
        "currency": invoice.currency,
        "status": invoice.status,
        "deterministic_flags": flags_summary,
        "deterministic_score": det_score,
        "ml_fraud_probability": ml["probability"] if ml else None,
        "ml_top_factors": [f["feature"] for f in ml["top_factors"]] if ml else [],
    }

    return {
        **state,
        "invoice_context": context,
        "risk_score_deterministic": det_score,
        "agent_trace": {"invoice_analyzer": "completed"},
    }


# ── Agent 2: Duplicate Check ─────────────────────────────────────────────────

def duplicate_checker(state: FraudAnalysisState, db: Session) -> FraudAnalysisState:
    if state.get("error"):
        return state

    ctx = state["invoice_context"]
    invoice_id = ctx["invoice_id"]
    vendor_id = ctx["vendor_id"]
    invoice_number = ctx["invoice_number"]
    total_amount = ctx["total_amount"]

    findings = {"exact_duplicates": [], "near_duplicates": []}

    if vendor_id and invoice_number:
        dupes = db.execute(
            __import__("sqlalchemy").text(
                "SELECT id, invoice_number, total_amount, invoice_date "
                "FROM invoices WHERE vendor_id = :vid "
                "AND invoice_number = :inv_num AND id != :iid"
            ),
            {"vid": vendor_id, "inv_num": invoice_number, "iid": invoice_id},
        ).fetchall()
        findings["exact_duplicates"] = [dict(r._mapping) for r in dupes]

    trace = {**state.get("agent_trace", {}), "duplicate_checker": "completed"}
    return {**state, "duplicate_findings": findings, "agent_trace": trace}


# ── Agent 3: Vendor Analyzer ─────────────────────────────────────────────────

def vendor_analyzer(state: FraudAnalysisState, db: Session) -> FraudAnalysisState:
    if state.get("error"):
        return state

    ctx = state["invoice_context"]
    vendor_id = ctx["vendor_id"]

    if not vendor_id:
        vendor_ctx = {"error": "No vendor linked to invoice", "is_unknown": True}
        trace = {**state.get("agent_trace", {}), "vendor_analyzer": "no_vendor"}
        return {**state, "vendor_context": vendor_ctx, "agent_trace": trace}

    rows = db.execute(
        __import__("sqlalchemy").text(
            "SELECT id, total_amount, status, invoice_date "
            "FROM invoices WHERE vendor_id = :vid AND id != :iid "
            "ORDER BY invoice_date DESC LIMIT 50"
        ),
        {"vid": vendor_id, "iid": ctx["invoice_id"]},
    ).fetchall()

    amounts = [float(r.total_amount) for r in rows if r.total_amount]
    avg_amount = sum(amounts) / len(amounts) if amounts else 0

    vendor_row = db.execute(
        __import__("sqlalchemy").text(
            "SELECT name, tax_id, email FROM vendors WHERE id = :vid"
        ),
        {"vid": vendor_id},
    ).fetchone()

    vendor_ctx = {
        "vendor_id": vendor_id,
        "vendor_name": vendor_row.name if vendor_row else "Unknown",
        "total_invoices": len(rows),
        "average_amount": avg_amount,
        "is_new_vendor": len(rows) < 3,
        "current_vs_avg_ratio": (
            round(ctx["total_amount"] / avg_amount, 2)
            if avg_amount and ctx["total_amount"] else None
        ),
    }

    trace = {**state.get("agent_trace", {}), "vendor_analyzer": "completed"}
    return {**state, "vendor_context": vendor_ctx, "agent_trace": trace}


# ── Agent 4: Historical Analyzer ─────────────────────────────────────────────

def historical_analyzer(state: FraudAnalysisState, db: Session) -> FraudAnalysisState:
    if state.get("error"):
        return state

    ctx = state["invoice_context"]
    signals = []

    if ctx.get("total_amount") and state["vendor_context"]:
        vc = state["vendor_context"]
        ratio = vc.get("current_vs_avg_ratio")
        if ratio and ratio > 3:
            signals.append({
                "signal": "AMOUNT_SPIKE",
                "severity": "HIGH",
                "detail": f"Invoice amount is {ratio}x vendor average",
            })
        if vc.get("is_new_vendor"):
            from app.fraud.config import FraudConfig
            high_value = ctx["total_amount"] > float(FraudConfig.HIGH_VALUE_THRESHOLD)
            signals.append({
                "signal": "NEW_VENDOR_HIGH_VALUE" if high_value else "NEW_VENDOR",
                "severity": "MEDIUM" if high_value else "LOW",
                "detail": f"New vendor with only {vc.get('total_invoices', 0)} prior invoices",
            })

    ml_prob = ctx.get("ml_fraud_probability")
    if ml_prob is not None and ml_prob >= 0.5:
        signals.append({
            "signal": "ML_FRAUD_PATTERN",
            "severity": "HIGH" if ml_prob >= 0.9 else "MEDIUM",
            "detail": (
                f"Trained model gives {ml_prob:.0%} fraud probability "
                f"(factors: {', '.join(ctx.get('ml_top_factors', [])[:3]) or 'n/a'})"
            ),
        })

    if state["duplicate_findings"] and state["duplicate_findings"]["exact_duplicates"]:
        signals.append({
            "signal": "EXACT_DUPLICATE",
            "severity": "CRITICAL",
            "detail": f"{len(state['duplicate_findings']['exact_duplicates'])} exact duplicate(s) found",
        })

    trace = {**state.get("agent_trace", {}), "historical_analyzer": "completed"}
    return {**state, "historical_signals": signals, "agent_trace": trace}


# ── Agent 5: RAG Evidence Retriever ──────────────────────────────────────────

def rag_evidence_retriever(state: FraudAnalysisState, db: Session) -> FraudAnalysisState:
    if state.get("error"):
        return state

    ctx = state["invoice_context"]
    signals = state.get("historical_signals", [])

    query_parts = [
        f"Invoice amount: {ctx.get('total_amount')}",
        f"Vendor ID: {ctx.get('vendor_id')}",
        f"Fraud signals: {', '.join(s['signal'] for s in signals) if signals else 'none'}",
        f"Deterministic flags: {', '.join(ctx.get('deterministic_flags', [])[:3])}",
    ]
    query = " | ".join(query_parts)

    from app.models.knowledge_chunk import KnowledgeChunk
    status = None
    passages = []
    if db.query(KnowledgeChunk.id).first() is None:
        # Nothing to search; don't spend an embedding call (or time out on Ollama).
        status = "knowledge base empty — upload policies via POST /knowledge/upload"
    else:
        try:
            passages = RAGStore(db).search(query, top_k=5)
        except Exception as e:
            status = f"search failed: {type(e).__name__}: {e}"

    trace = {
        **state.get("agent_trace", {}),
        "rag_evidence_retriever": status or f"found {len(passages)} passages",
    }
    return {**state, "evidence_passages": passages, "agent_trace": trace}


# ── Agent 6: Risk Assessor ────────────────────────────────────────────────────

def risk_assessor(state: FraudAnalysisState, db: Session) -> FraudAnalysisState:
    if state.get("error"):
        return state

    ctx = state["invoice_context"]
    signals = state.get("historical_signals", [])
    det_score = state.get("risk_score_deterministic") or 0.0
    evidence = state.get("evidence_passages", [])

    evidence_text = "\n".join(
        f"- [{p['document_name']}]: {p['chunk_text'][:200]}"
        for p in evidence
    ) if evidence else "No relevant policy passages found."

    signal_text = "\n".join(
        f"- {s['severity']}: {s['signal']} — {s['detail']}"
        for s in signals
    ) if signals else "No additional signals."

    flags_text = "\n".join(ctx.get("deterministic_flags", [])[:5]) or "None"

    ml_prob = ctx.get("ml_fraud_probability")
    ml_text = f"{ml_prob:.0%}" if ml_prob is not None else "not available"
    vc = state.get("vendor_context") or {}
    vendor_text = (
        "No vendor linked to this invoice."
        if vc.get("is_unknown") else
        f"- {vc.get('vendor_name')}: {vc.get('total_invoices', 0)} prior invoices, "
        f"average amount {vc.get('average_amount', 0):.2f}, "
        f"this invoice is {vc.get('current_vs_avg_ratio') or 'n/a'}x the average"
    )

    prompt = f"""You are a financial fraud risk assessor. Analyze this invoice and assign a risk score.

INVOICE SUMMARY:
- Invoice ID: {ctx['invoice_id']}
- Invoice Number: {ctx.get('invoice_number', 'N/A')}
- Total Amount: {ctx.get('total_amount', 'N/A')} {ctx.get('currency', '')}
- Vendor ID: {ctx.get('vendor_id', 'None')}
- Invoice Date: {ctx.get('invoice_date', 'N/A')}

DETERMINISTIC FRAUD FLAGS (already detected):
{flags_text}

AI-DETECTED SIGNALS:
{signal_text}

RELEVANT POLICY EVIDENCE:
{evidence_text}

DETERMINISTIC RISK SCORE: {det_score}/100
TRAINED MODEL FRAUD PROBABILITY: {ml_text}

VENDOR CONTEXT:
{vendor_text}

Based on all evidence above, provide an AI risk score from 0-100.
Consider:
- 0-24: Low risk, likely legitimate
- 25-49: Medium risk, worth reviewing
- 50-74: High risk, likely fraudulent
- 75-100: Critical risk, strong fraud indicators

Respond with ONLY a number between 0 and 100. Nothing else."""

    provider = None
    try:
        reply, provider = _call_llm(prompt)
        ai_score = _parse_score(reply)
    except Exception as e:
        print(f"[LLM ERROR in risk_assessor] {type(e).__name__}: {e}")
        ai_score = None

    if ai_score is None:
        # No LLM opinion: report the deterministic score as-is rather than
        # pretending an AI score equal to it was produced.
        final_score = round(det_score, 2)
    else:
        final_score = round(
            (det_score * DETERMINISTIC_WEIGHT) + (ai_score * AI_WEIGHT), 2
        )

    if final_score >= 75:
        risk_level = "CRITICAL"
    elif final_score >= 50:
        risk_level = "HIGH"
    elif final_score >= 25:
        risk_level = "MEDIUM"
    else:
        risk_level = "LOW"

    trace = {
        **state.get("agent_trace", {}),
        "risk_assessor": {
            "ai_score": ai_score,
            "det_score": det_score,
            "final_score": final_score,
            "llm_provider": provider or "unavailable",
        },
    }

    return {
        **state,
        "risk_score_ai": ai_score,
        "risk_score_final": final_score,
        "risk_level": risk_level,
        "agent_trace": trace,
    }


def _fallback_explanation(ctx: dict, signals: list, risk_level: str, final_score: float) -> str:
    """Evidence-based summary used when no LLM is reachable."""
    flags = ctx.get("deterministic_flags", [])
    parts = [f"Risk level {risk_level} ({final_score}/100), based on the rule engine"]
    if ctx.get("ml_fraud_probability") is not None:
        parts[0] += f" and the trained model ({ctx['ml_fraud_probability']:.0%} fraud probability)"
    parts[0] += "; no LLM was reachable, so this summary is generated without one."
    if flags:
        parts.append("Signals: " + "; ".join(f.split(" — ")[0] for f in flags[:4]) + ".")
    else:
        parts.append("No rule-based fraud signals were raised.")
    extra = [s["detail"] for s in signals if s["signal"] not in " ".join(flags)]
    if extra:
        parts.append("Also noted: " + "; ".join(extra[:2]) + ".")
    if risk_level in ("HIGH", "CRITICAL"):
        parts.append("Recommendation: hold payment and verify with the vendor before approving.")
    elif risk_level == "MEDIUM":
        parts.append("Recommendation: review the flagged items before approving.")
    else:
        parts.append("Recommendation: no blocking issues found; standard approval applies.")
    return " ".join(parts)


# ── Agent 7: Explanation Writer ───────────────────────────────────────────────

def explanation_writer(state: FraudAnalysisState, db: Session) -> FraudAnalysisState:
    if state.get("error"):
        return state

    ctx = state["invoice_context"]
    signals = state.get("historical_signals", [])
    evidence = state.get("evidence_passages", [])
    risk_level = state.get("risk_level", "UNKNOWN")
    final_score = state.get("risk_score_final", 0)

    evidence_text = "\n".join(
        f"- [{p['document_name']}]: {p['chunk_text'][:150]}"
        for p in evidence
    ) if evidence else "No policy references available."

    signal_text = "\n".join(
        f"- {s['severity']}: {s['signal']} — {s['detail']}"
        for s in signals
    ) if signals else "No additional AI signals detected."

    flags_text = "\n".join(ctx.get("deterministic_flags", [])[:5]) or "None detected."

    prompt = f"""You are a financial fraud analyst assistant. Write a professional, evidence-based analysis report for a human reviewer.

IMPORTANT RULES:
1. Never say "this IS fraud" — say "signals suggest" or "evidence indicates"
2. Always cite specific evidence
3. Be concise (3-4 sentences max)
4. End with a clear recommendation for the reviewer
5. You support human review, you do not make final decisions

INVOICE: #{ctx['invoice_id']} | Amount: {ctx.get('total_amount')} {ctx.get('currency', '')} | Risk Level: {risk_level} ({final_score}/100)

FRAUD FLAGS DETECTED:
{flags_text}

AI SIGNALS:
{signal_text}

POLICY EVIDENCE:
{evidence_text}

Write the analysis report now:"""

    try:
        explanation, _ = _call_llm(prompt)
    except Exception as e:
        print(f"[LLM ERROR in explanation_writer] {type(e).__name__}: {e}")
        explanation = _fallback_explanation(ctx, signals, risk_level, final_score)

    trace = {**state.get("agent_trace", {}), "explanation_writer": "completed"}
    return {**state, "ai_explanation": explanation, "agent_trace": trace}
