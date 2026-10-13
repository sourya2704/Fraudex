from functools import partial
from langgraph.graph import END, StateGraph
from sqlalchemy.orm import Session

from app.ai.state import FraudAnalysisState
from app.ai.agents import (
    invoice_analyzer,
    duplicate_checker,
    vendor_analyzer,
    historical_analyzer,
    rag_evidence_retriever,
    risk_assessor,
    explanation_writer,
)


def _bind(agent_fn, db: Session):
    return partial(agent_fn, db=db)


def build_workflow(db: Session) -> StateGraph:
    workflow = StateGraph(FraudAnalysisState)

    workflow.add_node("invoice_analyzer",      _bind(invoice_analyzer, db))
    workflow.add_node("duplicate_checker",     _bind(duplicate_checker, db))
    workflow.add_node("vendor_analyzer",       _bind(vendor_analyzer, db))
    workflow.add_node("historical_analyzer",   _bind(historical_analyzer, db))
    workflow.add_node("rag_evidence_retriever",_bind(rag_evidence_retriever, db))
    workflow.add_node("risk_assessor",         _bind(risk_assessor, db))
    workflow.add_node("explanation_writer",    _bind(explanation_writer, db))

    workflow.set_entry_point("invoice_analyzer")

    workflow.add_edge("invoice_analyzer",       "duplicate_checker")
    workflow.add_edge("duplicate_checker",      "vendor_analyzer")
    workflow.add_edge("vendor_analyzer",        "historical_analyzer")
    workflow.add_edge("historical_analyzer",    "rag_evidence_retriever")
    workflow.add_edge("rag_evidence_retriever", "risk_assessor")
    workflow.add_edge("risk_assessor",          "explanation_writer")
    workflow.add_edge("explanation_writer",     END)

    return workflow.compile()


def run_ai_fraud_analysis(invoice_id: int, db: Session) -> FraudAnalysisState:
    initial_state: FraudAnalysisState = {
        "invoice_id": invoice_id,
        "invoice_context": None,
        "duplicate_findings": None,
        "vendor_context": None,
        "historical_signals": None,
        "evidence_passages": None,
        "risk_score_deterministic": None,
        "risk_score_ai": None,
        "risk_score_final": None,
        "risk_level": None,
        "ai_explanation": None,
        "agent_trace": {},
        "error": None,
    }

    app = build_workflow(db)
    final_state = app.invoke(initial_state)
    return final_state
