from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from backend.database.db import get_db
from backend.database.models import User
from backend.services.user_service import (
    authenticate_user,
    create_user,
    serialize_user,
    user_exists,
)
from backend.units.helper import ensure_two_languages
from backend.units.security import create_access_token, get_current_user


router = APIRouter(prefix="/api/auth", tags=["auth"])


class RegisterPayload(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    full_name: str | None = Field(default=None, max_length=120)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    bio: str | None = Field(default=None, max_length=800)
    default_languages: list[str]


class LoginPayload(BaseModel):
    identifier: str = Field(min_length=3, max_length=150)
    password: str = Field(min_length=6, max_length=128)


@router.post("/register")
def register(payload: RegisterPayload, db: Session = Depends(get_db)):
    languages = ensure_two_languages(payload.default_languages)
    if user_exists(db, payload.username, payload.email):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username or email already exists.")

    user = create_user(
        db,
        username=payload.username,
        full_name=payload.full_name,
        email=payload.email,
        password=payload.password,
        bio=payload.bio,
        default_languages=languages,
    )
    token = create_access_token(user.id)
    return {"token": token, "user": serialize_user(user)}


@router.post("/login")
def login(payload: LoginPayload, db: Session = Depends(get_db)):
    user = authenticate_user(db, payload.identifier, payload.password)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials.")
    token = create_access_token(user.id)
    return {"token": token, "user": serialize_user(user)}


@router.get("/me")
def me(current_user: User = Depends(get_current_user)):
    return {"user": serialize_user(current_user)}
