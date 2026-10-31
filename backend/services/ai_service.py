from __future__ import annotations

import ast
import datetime
import operator
import os
import re
from typing import Any

import httpx

from backend.config import settings
from backend.units.helper import language_label

try:
    from openai import OpenAI
except ImportError:  # pragma: no cover
    OpenAI = None


_SAFE_OPS = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.FloorDiv: operator.floordiv,
    ast.Mod: operator.mod,
    ast.Pow: operator.pow,
    ast.USub: operator.neg,
    ast.UAdd: operator.pos,
}


def _eval_math_node(node: ast.AST) -> float | int:
    if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)):
        return node.value
    if isinstance(node, ast.BinOp) and type(node.op) in _SAFE_OPS:
        left = _eval_math_node(node.left)
        right = _eval_math_node(node.right)
        return _SAFE_OPS[type(node.op)](left, right)
    if isinstance(node, ast.UnaryOp) and type(node.op) in _SAFE_OPS:
        return _SAFE_OPS[type(node.op)](_eval_math_node(node.operand))
    raise ValueError("Unsupported expression")


def _try_solve_math(text: str) -> str | None:
    candidate = text.strip().replace("×", "*").replace("÷", "/").replace("^", "**")
    match = re.search(r"([0-9]+(?:\.[0-9]+)?(?:\s*[\+\-\*\/\%]\s*[0-9]+(?:\.[0-9]+)?)+)", candidate)
    if not match:
        return None
    expr = match.group(1).strip()
    try:
        tree = ast.parse(expr, mode="eval")
        result = _eval_math_node(tree.body)
        if isinstance(result, float) and result.is_integer():
            result = int(result)
        elif isinstance(result, float):
            result = round(result, 4)
        return f"{expr} = **{result}**"
    except Exception:
        return None


class AIService:
    def __init__(self) -> None:
        self.client = None
        if settings.openai_api_key and OpenAI is not None:
            self.client = OpenAI(api_key=settings.openai_api_key)

    def build_system_prompt(self, context: dict[str, list[str]], target_language: str | None) -> str:
        sections = [
            "You are PolyChat 3D, a warm, intelligent, multilingual AI assistant inside a personal 3D chatbot workspace.",
            "Always answer helpfully, clearly, and naturally.",
            "Use the user's profile, saved memories, and previous chat context when it makes the answer more relevant.",
            f"Respond in {language_label(target_language)} unless the user's latest message clearly requests another language.",
        ]
        if context.get("profile"):
            sections.append("User profile:\n- " + "\n- ".join(context["profile"]))
        if context.get("memories"):
            sections.append("Saved memories:\n- " + "\n- ".join(context["memories"]))
        if context.get("search_hits"):
            sections.append("Relevant history:\n- " + "\n- ".join(context["search_hits"]))
        if context.get("recent_logs"):
            sections.append("Recent chat summaries:\n- " + "\n- ".join(context["recent_logs"]))
        return "\n\n".join(sections)

    def _extract_user_name(self, context: dict[str, list[str]]) -> str:
        for mem in context.get("memories", []):
            if mem.lower().startswith("name:"):
                return mem.split(":", 1)[1].strip()
        for prof in context.get("profile", []):
            if prof.lower().startswith("full name:"):
                return prof.split(":", 1)[1].strip()
        return ""

    def _is_hindi_preferred(self, message: str, target_language: str | None) -> bool:
        if target_language and target_language.startswith("hi"):
            return True
        if re.search(r"[\u0900-\u097F]", message):
            return True
        hinglish_markers = {"kya", "kaise", "mera", "mujhe", "batao", "karo", "hai", "hain", "namaste", "aur", "acha"}
        words = set(re.findall(r"[a-zA-Z]+", message.lower()))
        return len(words.intersection(hinglish_markers)) >= 2

    def fallback_response(
        self,
        *,
        message: str,
        target_language: str | None,
        context: dict[str, list[str]],
    ) -> str:
        clean_msg = message.strip()
        lower_msg = clean_msg.lower()
        user_name = self._extract_user_name(context)
        use_hindi = self._is_hindi_preferred(clean_msg, target_language)
        lang_name = language_label(target_language)
        memories = context.get("memories", [])
        profile_items = context.get("profile", [])

        # 1. Check math expressions
        math_ans = _try_solve_math(clean_msg)
        if math_ans:
            if use_hindi:
                return f"यहाँ आपकी गणना (Calculation) का उत्तर है:\n\n✨ {math_ans}\n\nक्या आप कोई और सवाल या कैलकुलेशन पूछना चाहेंगे?"
            return f"Here is the result of your calculation:\n\n✨ {math_ans}\n\nLet me know if you'd like to calculate or explore anything else!"

        # 2. Check greetings
        greeting_patterns = r"^(hi|hello|hey|namaste|namaskar|hola|bonjour|good morning|good evening|good afternoon|नमस्ते|नमस्कार|हेलो|हाय|कैसे हो|kaise ho|kya haal)[\s!.,?]*$"
        if re.search(greeting_patterns, lower_msg):
            name_part_hi = f" {user_name} जी" if user_name else ""
            name_part_en = f", {user_name}" if user_name else ""
            if use_hindi:
                mem_note = f"\n\nमुझे आपके बारे में यह याद है: {', '.join(memories[:3])}." if memories else ""
                return (
                    f"नमस्ते{name_part_hi}! 🌟 मैं **PolyChat 3D** हूँ — आपका पर्सनल मल्टी-लिंगुअल AI असिस्टेंट।"
                    f"{mem_note}\n\nआज मैं आपकी क्या मदद कर सकता हूँ? आप मुझसे किसी भी भाषा में टेक्स्ट या वॉइस के ज़रिए बात कर सकते हैं!"
                )
            mem_note = f"\n\nI remember from your profile & chats: {', '.join(memories[:3])}." if memories else ""
            return (
                f"Hello{name_part_en}! 🌟 I'm **PolyChat 3D**, your personal memory-aware multilingual assistant "
                f"(replying in {lang_name}).{mem_note}\n\nHow can I help you today? Feel free to ask questions, brainstorm ideas, write code, or chat by voice!"
            )

        # 3. Check memory / identity questions ("who am I", "what do you know about me", "मेरा नाम क्या है")
        memory_triggers = [
            "who am i", "what is my name", "what's my name", "what do you know about me", "what do you remember",
            "मेरा नाम क्या", "मेरे बारे में", "मैं कौन", "mera naam kya", "mere baare",
        ]
        if any(trigger in lower_msg for trigger in memory_triggers):
            all_facts = profile_items + memories
            if all_facts:
                bullets = "\n".join(f"• {fact}" for fact in all_facts)
                if use_hindi:
                    return f"आपकी प्रोफ़ाइल और हमारी पिछली बातचीत के आधार पर मुझे आपके बारे में यह जानकारी याद है:\n\n{bullets}\n\nआप जब चाहें मुझे अपनी पसंद, लक्ष्य या नई जानकारी बता सकते हैं और मैं उसे याद रखूँगा!"
                return f"Based on your profile and our saved conversation memory, here is what I know about you:\n\n{bullets}\n\nYou can share new preferences or goals anytime and I'll automatically remember them!"
            if use_hindi:
                return "अभी मेरी मेमोरी में आपके बारे में ज़्यादा जानकारी सेव नहीं है। आप मुझे अपना नाम, शहर, काम या पसंद बता सकते हैं (जैसे: 'मेरा नाम राहुल है' या 'मुझे कोडिंग पसंद है') और मैं उसे हमेशा याद रखूँगा!"
            return "I don't have many saved facts about you yet! Tell me things like 'My name is ...', 'I live in ...', or 'I like ...' (or update your Profile page), and I will remember them across all your chats."

        # 4. Check when user shares personal info (just learned memory)
        just_shared_triggers = [
            "my name is", "i live in", "i work", "i study", "i like", "i love", "my goal is",
            "मेरा नाम", "मैं रहता", "मुझे पसंद", "mera naam", "mujhe",
        ]
        if any(trigger in lower_msg for trigger in just_shared_triggers) and memories:
            latest_facts = "; ".join(memories[:4])
            if use_hindi:
                return f"धन्यवाद{(' ' + user_name) if user_name else ''}! ✨ मैंने यह जानकारी आपकी पर्सनल मेमोरी में सेव कर ली है:\n\n• {latest_facts}\n\nअब भविष्य की सभी चैट्स में मैं इसे ध्यान में रखकर जवाब दूँगा। और बताइए, आज हम किस विषय पर बात करें?"
            return f"Got it{(' ' + user_name) if user_name else ''}! ✨ I've saved that to your personal memory:\n\n• {latest_facts}\n\nI'll keep this in mind for all our future conversations. What would you like to explore next?"

        # 5. Check date / time queries
        if any(w in lower_msg for w in ["time", "date", "today", "day today", "समय", "तारीख", "आज कौन सा दिन"]):
            now_str = datetime.datetime.now().strftime("%A, %d %B %Y • %I:%M %p")
            if use_hindi:
                return f"📅 अभी का समय और तारीख है:\n**{now_str}**"
            return f"📅 Current local date and time:\n**{now_str}**"

        # 6. Check coding / technical queries
        coding_keywords = ["python", "javascript", "html", "css", "sql", "code", "program", "function", "api", "fastapi", "react", "website", "कोड", "प्रोग्रामिंग"]
        if any(kw in lower_msg for kw in coding_keywords):
            if use_hindi:
                return (
                    f"**{clean_msg}** के लिए यहाँ एक उपयोगी गाइड और उदाहरण दिया गया है:\n\n"
                    "1. **मुख्य कॉन्सेप्ट (Core Concept):** किसी भी प्रोजेक्ट को मॉड्यूलर और साफ़ (Clean Architecture) रखें।\n"
                    "2. **उदाहरण कोड (Sample Snippet):**\n"
                    "```python\n"
                    "def greet_user(name: str = 'Developer') -> str:\n"
                    "    return f'Welcome to PolyChat 3D, {name}!'\n\n"
                    "print(greet_user())\n"
                    "```\n"
                    "3. **टिप:** अगर आप किसी खास एरर या फ़ीचर का पूरा कोड चाहते हैं, तो उसका नाम लिखें!"
                )
            return (
                f"Here is a structured guide for **{clean_msg}**:\n\n"
                "1. **Key Principle:** Keep your logic modular, well-typed, and easy to test.\n"
                "2. **Quick Example:**\n"
                "```python\n"
                "def solve_task(topic: str) -> dict:\n"
                "    return {'topic': topic, 'status': 'ready', 'mode': '3D Interactive'}\n\n"
                "print(solve_task('PolyChat AI'))\n"
                "```\n"
                "3. **Next Step:** Tell me the exact function, bug, or component you're building and I'll tailor it for you!"
            )

        # 7. Intelligent contextual response for any general question
        context_hint_hi = f" (आपकी प्रोफ़ाइल के अनुसार: {', '.join(memories[:2])})" if memories else ""
        context_hint_en = f" (keeping in mind your profile: {', '.join(memories[:2])})" if memories else ""

        if use_hindi:
            return (
                f"आपने बहुत अच्छा विषय उठाया है{(' ' + user_name + ' जी') if user_name else ''}{context_hint_hi}!\n\n"
                f"**\"{clean_msg}\"** के बारे में मुख्य बातें:\n"
                f"• **विश्लेषण (Overview):** यह विषय समझने और व्यवहार में लाने के लिए काफी महत्वपूर्ण है। इसे छोटे-छोटे स्टेप्स में बाँटकर करना सबसे प्रभावी तरीका है।\n"
                f"• **सुझाव (Actionable Tip):** सबसे पहले इसके बेसिक्स को स्पष्ट करें और फिर प्रैक्टिकल उदाहरणों के साथ आगे बढ़ें।\n\n"
                f"💡 *यदि आप इसके किसी विशेष पहलू (जैसे स्टेप-बाय-स्टेप प्लान, उदाहरण, या गहराई से जानकारी) के बारे में जानना चाहते हैं, तो मुझे बताइए!*"
            )

        return (
            f"Great question{(' ' + user_name) if user_name else ''}{context_hint_en}! (Replying in **{lang_name}**)\n\n"
            f"Here is a helpful breakdown regarding **\"{clean_msg}\"**:\n"
            f"• **Core Insight:** Breaking this down into clear, actionable steps makes it much easier to master and apply effectively.\n"
            f"• **Recommended Approach:** Start with the foundational goal, focus on practical execution, and iterate based on feedback.\n\n"
            f"💡 *Would you like me to dive deeper into a specific part, create a step-by-step action plan, or give examples?*"
        )

    def generate_reply(
        self,
        *,
        message: str,
        target_language: str | None,
        context: dict[str, list[str]],
        history: list[dict[str, str]] | None = None,
    ) -> str:
        system_prompt = self.build_system_prompt(context, target_language)
        openai_key = os.getenv("OPENAI_API_KEY") or settings.openai_api_key
        gemini_key = os.getenv("GEMINI_API_KEY") or settings.gemini_api_key

        # 1. Try OpenAI API if configured
        if openai_key and openai_key != "your-key-here":
            try:
                chat_messages = [{"role": "system", "content": system_prompt}]
                if history:
                    for item in history[-8:]:
                        role = "assistant" if item.get("sender") == "assistant" else "user"
                        chat_messages.append({"role": role, "content": item.get("message", "")})
                chat_messages.append({"role": "user", "content": message})

                with httpx.Client(timeout=20.0) as http_client:
                    resp = http_client.post(
                        "https://api.openai.com/v1/chat/completions",
                        headers={
                            "Authorization": f"Bearer {openai_key}",
                            "Content-Type": "application/json",
                        },
                        json={
                            "model": settings.openai_model,
                            "messages": chat_messages,
                            "temperature": 0.7,
                        },
                    )
                    if resp.status_code == 200:
                        data = resp.json()
                        text = data["choices"][0]["message"]["content"].strip()
                        if text:
                            return text
            except Exception:
                pass

        # 2. Try Google Gemini API if configured
        if gemini_key and gemini_key != "your-key-here":
            try:
                contents = []
                if history:
                    for item in history[-8:]:
                        role = "model" if item.get("sender") == "assistant" else "user"
                        contents.append({"role": role, "parts": [{"text": item.get("message", "")}]})
                contents.append({"role": "user", "parts": [{"text": message}]})

                with httpx.Client(timeout=20.0) as http_client:
                    resp = http_client.post(
                        f"https://generativelanguage.googleapis.com/v1beta/models/{settings.gemini_model}:generateContent?key={gemini_key}",
                        json={
                            "systemInstruction": {"parts": [{"text": system_prompt}]},
                            "contents": contents,
                        },
                    )
                    if resp.status_code == 200:
                        data = resp.json()
                        candidates = data.get("candidates", [])
                        if candidates:
                            parts = candidates[0].get("content", {}).get("parts", [])
                            text = "".join(p.get("text", "") for p in parts).strip()
                            if text:
                                return text
            except Exception:
                pass

        # 3. Smart built-in local AI responder
        return self.fallback_response(message=message, target_language=target_language, context=context)


ai_service = AIService()

