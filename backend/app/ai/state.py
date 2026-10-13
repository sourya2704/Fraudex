from typing import Any, Optional
from typing_extensions import TypedDict


class FraudAnalysisState(TypedDict):
    invoice_id: int
    invoice_context: Optional[dict]
    duplicate_findings: Optional[dict]
    vendor_context: Optional[dict]
    historical_signals: Optional[list]
    evidence_passages: Optional[list]
    risk_score_deterministic: Optional[float]
    risk_score_ai: Optional[float]
    risk_score_final: Optional[float]
    risk_level: Optional[str]
    ai_explanation: Optional[str]
    agent_trace: Optional[dict]
    error: Optional[str]
