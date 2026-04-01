from __future__ import annotations

from typing import Any

from backend.config import settings
from backend.units.helper import language_label

try:
    from openai import OpenAI
except ImportError:  # pragma: no cover
    OpenAI = None


class AIService:
    def __init__(self) -> None:
        self.client = None
        if settings.openai_api_key and OpenAI is not None:
            self.client = OpenAI(api_key=settings.openai_api_key)

    def build_system_prompt(self, context: dict[str, list[str]], target_language: str | None) -> str:
        sections = [
            "You are a warm, multilingual AI assistant inside a personal chatbot app.",
            "Always answer helpfully and naturally.",
            "Use the user's profile, saved memories, and previous chat context when it makes the answer more relevant.",
            f"Respond in {language_label(target_language)} unless the user's latest message clearly requests another language.",
        ]
        if context["profile"]:
            sections.append("User profile:\n- " + "\n- ".join(context["profile"]))
        if context["memories"]:
            sections.append("Saved memories:\n- " + "\n- ".join(context["memories"]))
        if context["search_hits"]:
            sections.append("Relevant history:\n- " + "\n- ".join(context["search_hits"]))
        if context["recent_logs"]:
            sections.append("Recent chat summaries:\n- " + "\n- ".join(context["recent_logs"]))
        return "\n\n".join(sections)

    def fallback_response(
        self,
        *,
        message: str,
        target_language: str | None,
        context: dict[str, list[str]],
    ) -> str:
        intro = f"I am replying in {language_label(target_language)}. " if target_language else ""
        relevant_memory = context["memories"][:3]
        relevant_history = context["search_hits"][:2]

        lines = [
            intro + "I can already use your saved profile and previous chats to keep answers relevant.",
        ]
        if relevant_memory:
            lines.append("What I remember about you: " + "; ".join(relevant_memory) + ".")
        if relevant_history:
            lines.append("Related earlier context: " + " | ".join(relevant_history) + ".")
        lines.append(
            "Your latest message was: "
            f"\"{message.strip()}\". Add an `OPENAI_API_KEY` in your environment to get full AI-generated answers."
        )
        return "\n\n".join(lines)

    def generate_reply(
        self,
        *,
        message: str,
        target_language: str | None,
        context: dict[str, list[str]],
    ) -> str:
        system_prompt = self.build_system_prompt(context, target_language)
        if self.client is None:
            return self.fallback_response(message=message, target_language=target_language, context=context)

        try:
            response: Any = self.client.responses.create(
                model=settings.openai_model,
                input=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": message},
                ],
            )
            output_text = getattr(response, "output_text", "").strip()
            if output_text:
                return output_text
        except Exception:
            pass

        return self.fallback_response(message=message, target_language=target_language, context=context)


ai_service = AIService()
