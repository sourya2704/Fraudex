from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, Text, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database.connection import Base


class AIFraudAnalysis(Base):
    __tablename__ = "ai_fraud_analyses"

    id = Column(Integer, primary_key=True, index=True)

    invoice_id = Column(
        Integer,
        ForeignKey("invoices.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )

    risk_score_deterministic = Column(Float, nullable=True)
    risk_score_ai = Column(Float, nullable=True)
    risk_score_final = Column(Float, nullable=True)
    risk_level = Column(String(20), nullable=True)

    ai_explanation = Column(Text, nullable=True)
    evidence_used = Column(JSON, nullable=True)  # JSON works with both SQLite and PostgreSQL
    agent_trace = Column(JSON, nullable=True)

    analyzed_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    invoice = relationship("Invoice", backref="ai_analysis")
