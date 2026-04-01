from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from backend.database.models import User
from backend.units.helper import parse_languages, public_profile_pic, serialize_languages
from backend.units.security import hash_password, verify_password


def user_exists(db: Session, username: str, email: str, exclude_user_id: int | None = None) -> bool:
    statement = select(User).where(or_(User.username == username, User.email == email))
    if exclude_user_id is not None:
        statement = statement.where(User.id != exclude_user_id)
    return db.scalar(statement) is not None


def create_user(
    db: Session,
    *,
    username: str,
    full_name: str | None,
    email: str,
    password: str,
    bio: str | None,
    default_languages: list[str],
) -> User:
    user = User(
        username=username.strip(),
        full_name=(full_name or "").strip() or None,
        email=email.strip().lower(),
        password=hash_password(password),
        bio=(bio or "").strip() or None,
        default_languages=serialize_languages(default_languages),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def authenticate_user(db: Session, identifier: str, password: str) -> User | None:
    statement = select(User).where(
        or_(User.username == identifier.strip(), User.email == identifier.strip().lower())
    )
    user = db.scalar(statement)
    if user is None or not verify_password(password, user.password):
        return None
    return user


def update_user(
    db: Session,
    user: User,
    *,
    username: str,
    full_name: str | None,
    email: str,
    bio: str | None,
    default_languages: list[str],
    profile_pic: str | None = None,
) -> User:
    user.username = username.strip()
    user.full_name = (full_name or "").strip() or None
    user.email = email.strip().lower()
    user.bio = (bio or "").strip() or None
    user.default_languages = serialize_languages(default_languages)
    if profile_pic is not None:
        user.profile_pic = profile_pic
    db.commit()
    db.refresh(user)
    return user


def serialize_user(user: User) -> dict:
    return {
        "id": user.id,
        "username": user.username,
        "full_name": user.full_name,
        "email": user.email,
        "bio": user.bio,
        "default_languages": parse_languages(user.default_languages),
        "profile_pic": public_profile_pic(user.profile_pic),
        "created_at": user.created_at.isoformat(),
    }
