from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from app.database import get_db
from app.routes import auth_router
from app.routes.workspace import router as workspace_router
from app.routes.demo import router as demo_router

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

app.include_router(auth_router)
app.include_router(workspace_router)
app.include_router(demo_router)

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
    try:
        database.execute(text("SELECT 1"))
    except SQLAlchemyError:
        raise HTTPException(status_code=503, detail="PostgreSQL is unavailable.")

    return {
        "status": "healthy",
        "service": "postgresql",
    }
