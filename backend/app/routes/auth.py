import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User, UserRole
from app.models.session import LoginSession
from app.schemas.user import UserLogin, UserRegister, UserResponse
from app.security.password import hash_password, verify_password
from app.config import settings


router = APIRouter(
    prefix="/auth",
    tags=["Authentication"],
)


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
)
def register_user(
    registration: UserRegister,
    database: Session = Depends(get_db),
) -> User:
    normalized_email = registration.email.lower()

    existing_user = database.scalar(
        select(User).where(User.email == normalized_email)
    )

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    user = User(
        full_name=registration.full_name.strip(),
        email=normalized_email,
        hashed_password=hash_password(registration.password),
        role=UserRole(registration.role),
    )

    database.add(user)

    try:
        database.commit()
    except IntegrityError:
        database.rollback()

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    database.refresh(user)

    return user


def current_user(talentlens_session: str | None = Cookie(default=None), database: Session = Depends(get_db)) -> User:
    if not talentlens_session:
        raise HTTPException(status_code=401, detail="Please sign in.")
    session = database.get(LoginSession, hashlib.sha256(talentlens_session.encode()).hexdigest())
    if not session or session.expires_at.replace(tzinfo=timezone.utc) <= datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Your session has expired.")
    user = database.get(User, session.user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Account unavailable.")
    return user


@router.post("/login", response_model=UserResponse)
def login(credentials: UserLogin, response: Response, database: Session = Depends(get_db)) -> User:
    user = database.scalar(select(User).where(User.email == credentials.email.lower()))
    if not user or not verify_password(credentials.password, user.hashed_password) or not user.is_active:
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    token = secrets.token_urlsafe(32)
    database.add(LoginSession(token_hash=hashlib.sha256(token.encode()).hexdigest(), user_id=user.id,
                              expires_at=datetime.now(timezone.utc) + timedelta(days=7)))
    database.commit()
    response.set_cookie("talentlens_session", token, httponly=True, secure=settings.cookie_secure,
                        samesite="lax", max_age=7 * 86400, path="/")
    return user


@router.get("/me", response_model=UserResponse)
def me(user: User = Depends(current_user)) -> User:
    return user


@router.post("/logout", status_code=204)
def logout(response: Response, talentlens_session: str | None = Cookie(default=None), database: Session = Depends(get_db)):
    if talentlens_session:
        session = database.get(LoginSession, hashlib.sha256(talentlens_session.encode()).hexdigest())
        if session:
            database.delete(session)
            database.commit()
    response.delete_cookie("talentlens_session", path="/")
