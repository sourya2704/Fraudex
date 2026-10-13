from decimal import Decimal
from typing import Any
from langchain_ollama import ChatOllama
from sqlalchemy.orm import Session

from app.ai.state import FraudAnalysisState
from app.models.invoice import Invoice
from app.models.fraud_detection_result import FraudDetectionResult
from app.rag.config import (
    OLLAMA_BASE_URL, OLLAMA_LLM_MODEL,
    AI_WEIGHT, DETERMINISTIC_WEIGHT,
)
from app.rag.store import RAGStore


def _get_llm() -> ChatOllama:
    return ChatOllama(
        base_url=OLLAMA_BASE_URL,
        model=OLLAMA_LLM_MODEL,
        temperature=0.1,
    )


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

    flags_summary = []
    det_score = None
    if fraud_result:
        det_score = fraud_result.risk_score
        flags_summary = [
            f"{f['severity']}: {f['code']} — {f['message']}"
            for f in (fraud_result.fraud_flags or [])
        ]

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
            signals.append({
                "signal": "NEW_VENDOR_HIGH_VALUE",
                "severity": "MEDIUM",
                "detail": f"New vendor with only {vc.get('total_invoices', 0)} prior invoices",
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

    try:
        rag = RAGStore(db)
        passages = rag.search(query, top_k=5)
    except Exception as e:
        passages = []

    trace = {**state.get("agent_trace", {}), "rag_evidence_retriever": f"found {len(passages)} passages"}
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

Based on all evidence above, provide an AI risk score from 0-100.
Consider:
- 0-24: Low risk, likely legitimate
- 25-49: Medium risk, worth reviewing
- 50-74: High risk, likely fraudulent
- 75-100: Critical risk, strong fraud indicators

Respond with ONLY a number between 0 and 100. Nothing else."""

    try:
        llm = _get_llm()
        response = llm.invoke(prompt)
        ai_score_raw = response.content.strip().split()[0]
        ai_score = min(100.0, max(0.0, float(ai_score_raw)))
    except Exception:
        ai_score = det_score

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
        },
    }

    return {
        **state,
        "risk_score_ai": ai_score,
        "risk_score_final": final_score,
        "risk_level": risk_level,
        "agent_trace": trace,
    }


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
        llm = _get_llm()
        response = llm.invoke(prompt)
        explanation = response.content.strip()
    except Exception as e:
        explanation = (
            f"Automated analysis completed. Risk level: {risk_level} "
            f"(score: {final_score}/100). "
            f"{len(ctx.get('deterministic_flags', []))} fraud signals detected. "
            f"Human review recommended."
        )

    trace = {**state.get("agent_trace", {}), "explanation_writer": "completed"}
    return {**state, "ai_explanation": explanation, "agent_trace": trace}
