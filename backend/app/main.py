from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.database.connection import engine, Base

from app.models.user import User
from app.models.vendor import Vendor
from app.models.invoice import Invoice
from app.models.invoice_item import InvoiceItem
from app.models.fraud_detection_result import FraudDetectionResult
from app.models.vendor_stats import VendorStats
from app.models.invoice_review import InvoiceReview
from app.models.audit_log import AuditLog
from app.models.knowledge_chunk import KnowledgeChunk
from app.models.ai_fraud_analysis import AIFraudAnalysis

from app.api.users import router as users_router
from app.api.auth import router as auth_router
from app.api.vendors import router as vendors_router
from app.api.invoices import router as invoices_router
from app.api.fraud_analytics import router as fraud_analytics_router
from app.api.review import router as review_router
from app.api.ai_analysis import router as ai_router

app = FastAPI(
    title="FrauDex API",
    description="AI Invoice Fraud Detection System",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Base.metadata.create_all(bind=engine)

app.include_router(users_router)
app.include_router(auth_router)
app.include_router(vendors_router)
app.include_router(invoices_router)
app.include_router(fraud_analytics_router)
app.include_router(review_router)
app.include_router(ai_router)


@app.get("/", tags=["Health"])
def root():
    return {"message": "FrauDex API is running", "version": "2.0.0"}


@app.get("/db-test", tags=["Health"])
def database_test():
    with engine.connect() as connection:
        result = connection.execute(text("SELECT 1"))
        return {"database": "connected", "result": result.scalar()}
