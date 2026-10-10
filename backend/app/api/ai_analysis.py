from typing import List, Optional
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, UploadFile, File, Query, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime

from app.core.dependencies import get_current_user, get_db, require_role
from app.models.invoice import Invoice
from app.models.ai_fraud_analysis import AIFraudAnalysis
from app.models.knowledge_chunk import KnowledgeChunk
from app.models.user import User
from app.ai.workflow import run_ai_fraud_analysis
from app.rag.store import RAGStore

router = APIRouter(tags=["AI Analysis"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class AIAnalysisResponse(BaseModel):
    id: int
    invoice_id: int
    risk_score_deterministic: Optional[float]
    risk_score_ai: Optional[float]
    risk_score_final: Optional[float]
    risk_level: Optional[str]
    ai_explanation: Optional[str]
    evidence_used: Optional[list]
    analyzed_at: Optional[datetime]

    class Config:
        from_attributes = True


class KnowledgeDocResponse(BaseModel):
    document_name: str
    source_type: str


class KnowledgeSearchResult(BaseModel):
    id: int
    document_name: str
    source_type: str
    chunk_text: str


# ── AI Analysis endpoints ─────────────────────────────────────────────────────

@router.post(
    "/invoices/{invoice_id}/ai-analyze",
    response_model=AIAnalysisResponse,
    summary="Run full LangGraph AI fraud analysis on an invoice",
)
def run_ai_analysis(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("ADMIN", "FINANCE_MANAGER")),
):
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Invoice {invoice_id} not found",
        )

    try:
        result = run_ai_fraud_analysis(invoice_id, db)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"AI analysis failed: {str(e)}",
        )

    if result.get("error"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=result["error"],
        )

    existing = db.query(AIFraudAnalysis).filter(
        AIFraudAnalysis.invoice_id == invoice_id
    ).first()

    evidence = result.get("evidence_passages", [])

    if existing:
        existing.risk_score_deterministic = result.get("risk_score_deterministic")
        existing.risk_score_ai = result.get("risk_score_ai")
        existing.risk_score_final = result.get("risk_score_final")
        existing.risk_level = result.get("risk_level")
        existing.ai_explanation = result.get("ai_explanation")
        existing.evidence_used = evidence
        existing.agent_trace = result.get("agent_trace")
        db_record = existing
    else:
        db_record = AIFraudAnalysis(
            invoice_id=invoice_id,
            risk_score_deterministic=result.get("risk_score_deterministic"),
            risk_score_ai=result.get("risk_score_ai"),
            risk_score_final=result.get("risk_score_final"),
            risk_level=result.get("risk_level"),
            ai_explanation=result.get("ai_explanation"),
            evidence_used=evidence,
            agent_trace=result.get("agent_trace"),
        )
        db.add(db_record)

    db.commit()
    db.refresh(db_record)
    return db_record


@router.get(
    "/invoices/{invoice_id}/ai-analysis",
    response_model=AIAnalysisResponse,
    summary="Get saved AI analysis result for an invoice",
)
def get_ai_analysis(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    record = db.query(AIFraudAnalysis).filter(
        AIFraudAnalysis.invoice_id == invoice_id
    ).first()
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No AI analysis found for this invoice. Run ai-analyze first.",
        )
    return record


# ── Knowledge Base endpoints ──────────────────────────────────────────────────

@router.post(
    "/knowledge/upload",
    summary="Upload a knowledge document for RAG (PDF text or plain text)",
)
async def upload_knowledge(
    file: UploadFile = File(...),
    source_type: str = Query("policy", description="policy | fraud_rule | case"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("ADMIN")),
):
    content = await file.read()

    if file.filename.endswith(".pdf"):
        try:
            import pymupdf
            import io
            doc = pymupdf.open(stream=content, filetype="pdf")
            text = "\n".join(page.get_text() for page in doc)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"PDF read failed: {e}")
    else:
        try:
            text = content.decode("utf-8")
        except Exception:
            raise HTTPException(status_code=400, detail="File must be PDF or UTF-8 text")

    if not text.strip():
        raise HTTPException(status_code=400, detail="Document has no extractable text")

    rag = RAGStore(db)
    chunk_count = rag.add_document(
        document_name=file.filename,
        content=text,
        source_type=source_type,
    )

    return {
        "message": f"Document '{file.filename}' uploaded and indexed",
        "chunks_created": chunk_count,
        "source_type": source_type,
    }


@router.get(
    "/knowledge/",
    response_model=List[KnowledgeDocResponse],
    summary="List all knowledge documents in the RAG store",
)
def list_knowledge(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rag = RAGStore(db)
    return rag.list_documents()


@router.delete(
    "/knowledge/{document_name}",
    summary="Remove a document from the RAG knowledge base",
)
def delete_knowledge(
    document_name: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("ADMIN")),
):
    rag = RAGStore(db)
    deleted = rag.delete_document(document_name)
    return {"deleted_chunks": deleted, "document_name": document_name}


@router.get(
    "/knowledge/search",
    response_model=List[KnowledgeSearchResult],
    summary="Test RAG similarity search",
)
def search_knowledge(
    q: str = Query(..., description="Search query"),
    top_k: int = Query(5, ge=1, le=20),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rag = RAGStore(db)
    return rag.search(q, top_k=top_k)
