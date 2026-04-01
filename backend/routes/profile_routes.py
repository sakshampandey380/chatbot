from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from backend.config import UPLOADS_DIR
from backend.database.db import get_db
from backend.database.models import User
from backend.services.user_service import serialize_user, update_user, user_exists
from backend.units.helper import LANGUAGE_OPTIONS, ensure_two_languages, parse_languages, save_profile_photo
from backend.units.security import get_current_user


router = APIRouter(prefix="/api/profile", tags=["profile"])


class ProfilePayload(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    full_name: str | None = Field(default=None, max_length=120)
    email: EmailStr
    bio: str | None = Field(default=None, max_length=800)
    default_languages: list[str]


@router.get("/languages")
def language_options():
    return {"languages": LANGUAGE_OPTIONS}


@router.get("/")
def get_profile(current_user: User = Depends(get_current_user)):
    return {"user": serialize_user(current_user)}


@router.put("/")
def save_profile(
    payload: ProfilePayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    languages = ensure_two_languages(payload.default_languages)
    if user_exists(db, payload.username, payload.email, exclude_user_id=current_user.id):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username or email already exists.")

    user = update_user(
        db,
        current_user,
        username=payload.username,
        full_name=payload.full_name,
        email=payload.email,
        bio=payload.bio,
        default_languages=languages,
    )
    return {"user": serialize_user(user)}


@router.post("/photo")
def upload_profile_photo(
    photo: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not photo.content_type or not photo.content_type.startswith("image/"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Please upload a valid image.")

    filename = save_profile_photo(UPLOADS_DIR, photo)
    user = update_user(
        db,
        current_user,
        username=current_user.username,
        full_name=current_user.full_name,
        email=current_user.email,
        bio=current_user.bio,
        default_languages=parse_languages(current_user.default_languages),
        profile_pic=filename,
    )
    return {"user": serialize_user(user)}
