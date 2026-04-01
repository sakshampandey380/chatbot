import json
import re
import secrets
from pathlib import Path

from fastapi import HTTPException, UploadFile, status


LANGUAGE_OPTIONS = [
    {"code": "ar-SA", "label": "Arabic"},
    {"code": "bn-BD", "label": "Bengali"},
    {"code": "bg-BG", "label": "Bulgarian"},
    {"code": "ca-ES", "label": "Catalan"},
    {"code": "zh-CN", "label": "Chinese (Simplified)"},
    {"code": "zh-TW", "label": "Chinese (Traditional)"},
    {"code": "hr-HR", "label": "Croatian"},
    {"code": "cs-CZ", "label": "Czech"},
    {"code": "da-DK", "label": "Danish"},
    {"code": "nl-NL", "label": "Dutch"},
    {"code": "en-US", "label": "English"},
    {"code": "et-EE", "label": "Estonian"},
    {"code": "fi-FI", "label": "Finnish"},
    {"code": "fr-FR", "label": "French"},
    {"code": "de-DE", "label": "German"},
    {"code": "el-GR", "label": "Greek"},
    {"code": "gu-IN", "label": "Gujarati"},
    {"code": "he-IL", "label": "Hebrew"},
    {"code": "hi-IN", "label": "Hindi"},
    {"code": "hu-HU", "label": "Hungarian"},
    {"code": "id-ID", "label": "Indonesian"},
    {"code": "it-IT", "label": "Italian"},
    {"code": "ja-JP", "label": "Japanese"},
    {"code": "kn-IN", "label": "Kannada"},
    {"code": "ko-KR", "label": "Korean"},
    {"code": "ms-MY", "label": "Malay"},
    {"code": "ml-IN", "label": "Malayalam"},
    {"code": "mr-IN", "label": "Marathi"},
    {"code": "ne-NP", "label": "Nepali"},
    {"code": "no-NO", "label": "Norwegian"},
    {"code": "fa-IR", "label": "Persian"},
    {"code": "pl-PL", "label": "Polish"},
    {"code": "pt-BR", "label": "Portuguese"},
    {"code": "pa-IN", "label": "Punjabi"},
    {"code": "ro-RO", "label": "Romanian"},
    {"code": "ru-RU", "label": "Russian"},
    {"code": "sk-SK", "label": "Slovak"},
    {"code": "sl-SI", "label": "Slovenian"},
    {"code": "es-ES", "label": "Spanish"},
    {"code": "sw-KE", "label": "Swahili"},
    {"code": "sv-SE", "label": "Swedish"},
    {"code": "ta-IN", "label": "Tamil"},
    {"code": "te-IN", "label": "Telugu"},
    {"code": "th-TH", "label": "Thai"},
    {"code": "tr-TR", "label": "Turkish"},
    {"code": "uk-UA", "label": "Ukrainian"},
    {"code": "ur-PK", "label": "Urdu"},
    {"code": "vi-VN", "label": "Vietnamese"},
]

LANGUAGE_MAP = {item["code"]: item["label"] for item in LANGUAGE_OPTIONS}
ALLOWED_UPLOAD_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp", ".gif"}


def ensure_two_languages(languages: list[str]) -> list[str]:
    cleaned = []
    for language in languages:
        if language in LANGUAGE_MAP and language not in cleaned:
            cleaned.append(language)
    if len(cleaned) < 2:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Please select at least two default languages.",
        )
    return cleaned


def parse_languages(raw_languages: str | list[str] | None) -> list[str]:
    if raw_languages is None:
        return []
    if isinstance(raw_languages, list):
        return raw_languages
    try:
        data = json.loads(raw_languages)
        return data if isinstance(data, list) else []
    except json.JSONDecodeError:
        return []


def serialize_languages(languages: list[str]) -> str:
    return json.dumps(ensure_two_languages(languages))


def language_label(code: str | None) -> str:
    if not code:
        return "Auto"
    return LANGUAGE_MAP.get(code, code)


def build_conversation_title(message: str) -> str:
    words = re.findall(r"[A-Za-z0-9']+", message)
    if not words:
        return "New conversation"
    title = " ".join(words[:7]).strip()
    return title[:60] + ("..." if len(title) > 60 else "")


def public_profile_pic(path: str | None) -> str | None:
    if not path:
        return None
    return f"/uploads/{Path(path).name}"


def save_profile_photo(upload_dir: Path, file: UploadFile) -> str:
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in ALLOWED_UPLOAD_SUFFIXES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please upload a JPG, PNG, WEBP, or GIF image.",
        )
    filename = f"{secrets.token_hex(16)}{suffix}"
    destination = upload_dir / filename
    with destination.open("wb") as target:
        while chunk := file.file.read(1024 * 1024):
            target.write(chunk)
    return filename
