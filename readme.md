# 🤖 PolyChat

A full-stack AI-powered chatbot application built with **FastAPI** and **MySQL**, featuring authentication, memory-aware conversations, multilingual support, and voice interaction.

---

## ✨ Features

* 🔐 **User Authentication**

  * Register & login system
  * Secure access before chatting

* 🌐 **Multi-Language Support**

  * Users must select at least two default languages
  * Personalized conversational experience

* 🧠 **Memory-Aware Chat**

  * Uses previous chats and profile data
  * Context-aware responses like modern AI assistants

* 💬 **Chat System**

  * Persistent chat history
  * Saved conversations similar to ChatGPT

* 🎤 **Voice Interaction**

  * Browser-based voice input
  * Voice playback for responses

* 👤 **User Profile**

  * Profile editing
  * Image upload support

* ⚡ **Fallback AI System**

  * Works even without OpenAI API
  * Uses built-in response logic

---

## 🛠️ Tech Stack

### Backend

* FastAPI (Python)
* MySQL

### Frontend

* HTML, CSS, JavaScript

### AI Integration

* OpenAI API (optional)

### Additional Features

* Web Speech API (Voice input/output)

---

## 📁 Project Structure

```bash
PolyChat/
├── backend/
├── database/
│   └── chatbot.sql
├── static/
├── templates/
├── run.py
├── requirements.txt
```

---

## ⚙️ Setup Instructions

### 1. Import Database

Import the SQL file into MySQL / phpMyAdmin:

```bash
database/chatbot.sql
```

---

### 2. Install Dependencies

```bash
pip install -r backend/requirements.txt
```

---

### 3. Set Environment Variables

```bash
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=chatbot_db
OPENAI_API_KEY=your-key-here
```

---

### 4. Run the Application

```bash
python run.py
```

---

### 5. Open in Browser

```
http://127.0.0.1:8000/
```

---

## 📝 Notes

* If `OPENAI_API_KEY` is not provided:

  * Chat will still work
  * Uses fallback response system

* Voice features depend on:

  * Browser support for Web Speech API

---

## 🚀 Future Improvements

* Advanced AI personalization
* Multi-user chat collaboration
* Mobile responsiveness
* Enhanced UI animations

---

## 👨‍💻 Author

**Saksham Pandey**

---

## ⭐ Support

If you like this project, consider giving it a ⭐ on GitHub!
