from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import desc, select
from sqlalchemy.orm import Session, selectinload

from backend.database.db import get_db
from backend.database.models import ChatLog, Conversation, Message, User
from backend.services.ai_service import ai_service
from backend.services.memory_service import build_user_context, learn_from_message, search_past_context
from backend.services.user_service import serialize_user
from backend.units.helper import build_conversation_title, parse_languages
from backend.units.security import get_current_user


router = APIRouter(prefix="/api/chat", tags=["chat"])


class ConversationPayload(BaseModel):
    title: str | None = Field(default=None, max_length=180)


class MessagePayload(BaseModel):
    message: str = Field(min_length=1, max_length=8000)
    language: str | None = Field(default=None, max_length=20)
    input_mode: str | None = Field(default="text", max_length=20)


def serialize_message(message: Message) -> dict:
    return {
        "id": message.id,
        "sender": message.sender,
        "message": message.message,
        "language": message.language,
        "input_mode": message.input_mode,
        "created_at": message.created_at.isoformat(),
    }


def serialize_conversation(conversation: Conversation) -> dict:
    return {
        "id": conversation.id,
        "title": conversation.title,
        "started_at": conversation.started_at.isoformat(),
        "last_message_at": conversation.last_message_at.isoformat(),
    }


def get_conversation_or_404(db: Session, conversation_id: int, user_id: int) -> Conversation:
    conversation = db.scalar(
        select(Conversation)
        .where(Conversation.id == conversation_id, Conversation.user_id == user_id)
        .options(selectinload(Conversation.messages))
    )
    if conversation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found.")
    return conversation


@router.get("/bootstrap")
def bootstrap(current_user: User = Depends(get_current_user)):
    return {"user": serialize_user(current_user)}


@router.get("/conversations")
def list_conversations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conversations = db.scalars(
        select(Conversation)
        .where(Conversation.user_id == current_user.id)
        .order_by(desc(Conversation.last_message_at))
    ).all()
    return {"conversations": [serialize_conversation(item) for item in conversations]}


@router.post("/conversations")
def create_conversation(
    payload: ConversationPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conversation = Conversation(
        user_id=current_user.id,
        title=(payload.title or "New conversation").strip()[:180] or "New conversation",
    )
    db.add(conversation)
    db.commit()
    db.refresh(conversation)
    return {"conversation": serialize_conversation(conversation)}


@router.get("/conversations/{conversation_id}")
def get_conversation(
    conversation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conversation = get_conversation_or_404(db, conversation_id, current_user.id)
    return {
        "conversation": serialize_conversation(conversation),
        "messages": [serialize_message(message) for message in conversation.messages],
    }


@router.post("/conversations/{conversation_id}/messages")
def send_message(
    conversation_id: int,
    payload: MessagePayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conversation = get_conversation_or_404(db, conversation_id, current_user.id)
    target_language = payload.language or (parse_languages(current_user.default_languages)[:1] or [None])[0]

    user_message = Message(
        conversation_id=conversation.id,
        sender="user",
        message=payload.message.strip(),
        language=target_language,
        input_mode=payload.input_mode or "text",
    )
    db.add(user_message)
    db.flush()

    if conversation.title == "New conversation":
        conversation.title = build_conversation_title(payload.message)

    learn_from_message(db, current_user.id, payload.message)
    context = build_user_context(db, current_user, payload.message)
    reply_text = ai_service.generate_reply(
        message=payload.message.strip(),
        target_language=target_language,
        context=context,
    )

    assistant_message = Message(
        conversation_id=conversation.id,
        sender="assistant",
        message=reply_text,
        language=target_language,
        input_mode="text",
    )
    db.add(assistant_message)
    db.add(ChatLog(user_id=current_user.id, message=payload.message.strip(), response=reply_text))
    conversation.last_message_at = datetime.utcnow()
    db.commit()
    db.refresh(conversation)
    db.refresh(user_message)
    db.refresh(assistant_message)

    return {
        "conversation": serialize_conversation(conversation),
        "messages": [serialize_message(user_message), serialize_message(assistant_message)],
    }


@router.get("/search")
def search_history(
    q: str = Query("", max_length=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return {"results": search_past_context(db, current_user.id, q, limit=10)}
