from app.ai.agents import _fallback_explanation, rag_evidence_retriever
from app.rag.default_policies import KNOWLEDGE_DOCS, load_default_policies
from app.rag.store import RAGStore

FLAG_CODES = [
    "DUPLICATE_INVOICE", "DUPLICATE_DOCUMENT", "SIMILAR_INVOICE", "AMOUNT_STATISTICAL_ANOMALY",
    "AMOUNT_ANOMALY_UNIFORM", "VENDOR_AMOUNT_SPIKE", "AMOUNT_BELOW_THRESHOLD",
    "RAPID_INVOICE_SUBMISSION", "NEW_VENDOR", "UNKNOWN_VENDOR", "HIGH_VENDOR_REJECTION_RATE",
    "FUTURE_INVOICE_DATE", "BACK_DATED_INVOICE", "VERY_OLD_INVOICE", "DUE_DATE_BEFORE_INVOICE",
    "EXTENDED_PAYMENT_TERMS", "ML_FRAUD_PATTERN", "INVALID_GST_RATE", "TAX_CALCULATION_MISMATCH",
    "EXCESSIVE_TAX_RATE", "TAX_RATE_DEVIATION",
]


def test_every_flag_has_a_policy_passage():
    text = " ".join(d["content"] for d in KNOWLEDGE_DOCS)
    assert [c for c in FLAG_CODES if f"({c})" not in text] == []


def test_search_finds_the_matching_rule(db):
    load_default_policies(db)
    store = RAGStore(db)
    for query, code in [
        ("tax rate between slabs", "INVALID_GST_RATE"),
        ("vendor never seen before", "NEW_VENDOR"),
        ("MEDIUM: VERY_OLD_INVOICE — invoice is 800 days old", "VERY_OLD_INVOICE"),
    ]:
        assert f"({code})" in store.search(query, top_k=1)[0]["chunk_text"]


def test_explanation_cites_the_rule_behind_each_flag(db):
    load_default_policies(db)
    flags = ["CRITICAL: DUPLICATE_INVOICE — Duplicate invoice detected: Invoice #A-1",
             "MEDIUM: INVALID_GST_RATE — Tax rate 21.0% is not a valid GST rate"]
    state = {"invoice_context": {"deterministic_flags": flags}, "historical_signals": []}
    evidence = rag_evidence_retriever(state, db)["evidence_passages"]

    assert [p["ref"] for p in evidence][:2] == ["P1", "P2"]
    assert "(DUPLICATE_INVOICE)" in evidence[0]["chunk_text"]
    assert "(INVALID_GST_RATE)" in evidence[1]["chunk_text"]

    text = _fallback_explanation(state["invoice_context"], [], "CRITICAL", 90.0, evidence)
    assert "Policy [P1]" in text and "Policy [P2]" in text


def test_empty_knowledge_base_is_reported(db):
    state = {"invoice_context": {"deterministic_flags": []}, "historical_signals": []}
    out = rag_evidence_retriever(state, db)
    assert out["evidence_passages"] == []
    assert "knowledge base empty" in out["agent_trace"]["rag_evidence_retriever"]
