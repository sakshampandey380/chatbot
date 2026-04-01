import re

from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from backend.database.models import ChatLog, Conversation, Memory, Message, User
from backend.units.helper import language_label, parse_languages


MEMORY_PATTERNS = {
    "name": re.compile(r"\bmy name is ([^.,!?]{2,60})", re.IGNORECASE),
    "location": re.compile(r"\bi live in ([^.,!?]{2,80})", re.IGNORECASE),
    "work": re.compile(r"\bi work (?:as|at) ([^.,!?]{2,80})", re.IGNORECASE),
    "study": re.compile(r"\bi study ([^.,!?]{2,80})", re.IGNORECASE),
    "likes": re.compile(r"\bi (?:like|love|enjoy) ([^.,!?]{2,100})", re.IGNORECASE),
    "goal": re.compile(r"\bmy goal is to ([^.,!?]{2,100})", re.IGNORECASE),
}


def upsert_memory(db: Session, user_id: int, memory_key: str, memory_value: str) -> None:
    existing = db.scalar(
        select(Memory).where(Memory.user_id == user_id, Memory.memory_key == memory_key)
    )
    if existing:
        existing.memory_value = memory_value.strip()
    else:
        db.add(Memory(user_id=user_id, memory_key=memory_key, memory_value=memory_value.strip()))
    db.flush()


def learn_from_message(db: Session, user_id: int, message: str) -> None:
    text = message.strip()
    if not text:
        return
    for memory_key, pattern in MEMORY_PATTERNS.items():
        match = pattern.search(text)
        if match:
            upsert_memory(db, user_id, memory_key, match.group(1).strip())


def search_past_context(db: Session, user_id: int, query: str, limit: int = 5) -> list[str]:
    terms = [term for term in re.findall(r"[a-zA-Z0-9']+", query.lower()) if len(term) > 3]
    snippets: list[str] = []

    memories = db.scalars(
        select(Memory).where(Memory.user_id == user_id).order_by(desc(Memory.updated_at)).limit(limit)
    ).all()
    for item in memories:
        snippets.append(f"Memory - {item.memory_key}: {item.memory_value}")
        if len(snippets) >= limit:
            return snippets

    recent_messages = db.scalars(
        select(Message)
        .join(Conversation, Conversation.id == Message.conversation_id)
        .where(Conversation.user_id == user_id)
        .order_by(desc(Message.created_at))
        .limit(40)
    ).all()

    for message in recent_messages:
        text = message.message.strip()
        lowered = text.lower()
        if not terms or any(term in lowered for term in terms):
            snippets.append(f"{message.sender.title()}: {text}")
        if len(snippets) >= limit:
            break
    return snippets


def build_user_context(db: Session, user: User, current_message: str) -> dict[str, list[str]]:
    profile_lines: list[str] = []
    if user.full_name:
        profile_lines.append(f"Full name: {user.full_name}")
    if user.bio:
        profile_lines.append(f"Bio: {user.bio}")

    languages = [language_label(code) for code in parse_languages(user.default_languages)]
    if languages:
        profile_lines.append(f"Default languages: {', '.join(languages)}")

    memories = db.scalars(
        select(Memory).where(Memory.user_id == user.id).order_by(desc(Memory.updated_at)).limit(6)
    ).all()
    memory_lines = [f"{item.memory_key}: {item.memory_value}" for item in memories]

    search_hits = search_past_context(db, user.id, current_message, limit=6)
    recent_logs = db.scalars(
        select(ChatLog).where(ChatLog.user_id == user.id).order_by(desc(ChatLog.created_at)).limit(3)
    ).all()
    log_lines = [f"Past Q: {log.message}\nPast A: {log.response}" for log in recent_logs]

    return {
        "profile": profile_lines,
        "memories": memory_lines,
        "search_hits": search_hits,
        "recent_logs": log_lines,
    }
