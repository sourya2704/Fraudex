
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.database.connection import engine, Base
from app.models.user import User
from app.models.vendor import Vendor
from app.models.invoice import Invoice
from app.models.invoice_item import InvoiceItem
from app.api.users import router as users_router
from app.api.auth import router as auth_router
from app.api.vendors import router as vendors_router
from app.api.invoices import router as invoices_router
app = FastAPI(
    title="FrauDex API",
    description="AI Invoice Fraud Detector",
    version="1.0.0",
    
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
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

@app.get("/")
def root():
    return {
        "message": "FrauDex API is running"
    }


@app.get("/db-test")
def database_test():
    with engine.connect() as connection:
        result = connection.execute(text("SELECT 1"))

        return {
            "database": "connected",
            "result": result.scalar()
        }
