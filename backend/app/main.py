from fastapi import FastAPI

app = FastAPI(
    title="FrauDex API",
    description="AI Invoice Fraud Detector",
    version="1.0.0"
)


@app.get("/")
def root():
    return {
        "message": "FrauDex API is running"
    }