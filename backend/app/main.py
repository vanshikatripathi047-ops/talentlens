from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database import get_db


app = FastAPI(
    title="TalentLens API",
    description="Backend API for creator and brand intelligence.",
    version="0.1.0",
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root() -> dict[str, str]:
    return {
        "message": "TalentLens API is running",
        "status": "healthy",
    }


@app.get("/health")
def health_check() -> dict[str, str]:
    return {
        "status": "healthy",
        "service": "talentlens-api",
    }


@app.get("/health/database")
def database_health_check(
    database: Session = Depends(get_db),
) -> dict[str, str]:
    database.execute(text("SELECT 1"))

    return {
        "status": "healthy",
        "service": "postgresql",
    }