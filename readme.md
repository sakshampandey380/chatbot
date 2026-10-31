# PolyChat

FastAPI + MySQL chatbot app with:

- register then login before chat access
- required selection of at least two default languages
- profile page with image upload and editing
- saved conversations and messages like ChatGPT
- browser voice input and voice playback
- memory-aware replies using profile data and previous chats

## Setup

1. Import [database/chatbot.sql](/c:/xampp/htdocs/chatbot_db/database/chatbot.sql) into MySQL or phpMyAdmin if the database is empty.
2. Install backend packages:

```powershell
pip install -r backend\requirements.txt
```

3 Set environment variables if needed:

```powershell
$env:DB_HOST="127.0.0.1"
$env:DB_PORT="3306"
$env:DB_USER="root"
$env:DB_PASSWORD=""
$env:DB_NAME="chatbot_db"
$env:OPENAI_API_KEY="your-key-here"
```

4 Start the app:

```powershell
python run.py
```

5 Open `http://127.0.0.1:8000/`

## Notes

- If `OPENAI_API_KEY` is missing, the app still saves chats and memory, but replies use the built-in fallback responder.
- Voice input/output depends on browser Web Speech API support.
