
from fastapi import FastAPI
from sqlalchemy import text

from app.database.connection import engine, Base
from app.models.user import User
from app.api.users import router as users_router

app = FastAPI(
    title="FrauDex API",
    description="AI Invoice Fraud Detector",
    version="1.0.0",
    
)
Base.metadata.create_all(bind=engine)
app.include_router(users_router)

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
