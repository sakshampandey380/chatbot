const HOSTNAME = window.location.hostname || "127.0.0.1";
const CHAT_API_ROOT = window.location.port === "8000"
    ? window.location.origin
    : `${window.location.protocol}//${HOSTNAME}:8000`;

const state = {
    user: null,
    languages: [],
    conversations: [],
    activeConversationId: null,
    speechEnabled: false,
    recognition: null,
};

const chatTitle = document.getElementById("chatTitle");
const messagesPanel = document.getElementById("messagesPanel");
const emptyState = document.getElementById("emptyState");
const chatStatus = document.getElementById("chatStatus");
const conversationList = document.getElementById("conversationList");
const messageInput = document.getElementById("messageInput");
const composerForm = document.getElementById("composerForm");
const newChatButton = document.getElementById("newChatButton");
const conversationSearch = document.getElementById("conversationSearch");
const voiceButton = document.getElementById("voiceButton");
const speakerButton = document.getElementById("speakerButton");
const languageSelect = document.getElementById("languageSelect");
const headerAvatar = document.getElementById("headerAvatar");
const headerName = document.getElementById("headerName");
const profileMenuButton = document.getElementById("profileMenuButton");
const profileDropdown = document.getElementById("profileDropdown");
const logoutButton = document.getElementById("logoutButton");

const token = localStorage.getItem("polychat_token");

if (!token) {
    window.location.href = "./index.html";
}

const getApiUrl = (path) => `${CHAT_API_ROOT}${path}`;
const getAssetUrl = (path) => {
    if (!path) {
        return "./images/default-avatar.svg";
    }
    if (path.startsWith("http")) {
        return path;
    }
    return `${CHAT_API_ROOT}${path}`;
};

function showStatus(message, type = "error") {
    chatStatus.textContent = message;
    chatStatus.className = `status-banner ${type}`;
}

function clearStatus() {
    chatStatus.textContent = "";
    chatStatus.className = "status-banner hidden";
}

function clearAuth() {
    localStorage.removeItem("polychat_token");
    localStorage.removeItem("polychat_user");
    window.location.href = "./index.html";
}

async function api(path, options = {}) {
    const response = await fetch(getApiUrl(path), {
        ...options,
        headers: {
            Authorization: `Bearer ${token}`,
            ...(options.headers || {}),
        },
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) {
        clearAuth();
        return null;
    }
    if (!response.ok) {
        throw new Error(data.detail || "Request failed.");
    }
    return data;
}

function renderLanguageSelect() {
    const selected = state.user?.default_languages?.[0] || "en-US";
    languageSelect.innerHTML = state.languages.map((language) => `
        <option value="${language.code}" ${language.code === selected ? "selected" : ""}>${language.label}</option>
    `).join("");
}

function renderProfileHeader() {
    headerName.textContent = state.user?.full_name || state.user?.username || "Profile";
    headerAvatar.src = getAssetUrl(state.user?.profile_pic);
}

function escapeHtml(text) {
    return String(text)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

function renderMessages(messages) {
    messagesPanel.innerHTML = "";
    if (!messages.length) {
        messagesPanel.appendChild(emptyState);
        emptyState.classList.remove("hidden");
        return;
    }

    emptyState.classList.add("hidden");
    messages.forEach((message) => {
        const row = document.createElement("article");
        row.className = `message-row ${message.sender}`;
        row.innerHTML = `
            <div class="message-bubble">
                <h4>${message.sender === "assistant" ? "PolyChat" : "You"}</h4>
                <div>${escapeHtml(message.message).replace(/\n/g, "<br>")}</div>
            </div>
        `;
        messagesPanel.appendChild(row);
    });
    messagesPanel.scrollTop = messagesPanel.scrollHeight;
}

function renderConversations() {
    const query = conversationSearch.value.trim().toLowerCase();
    const filtered = state.conversations.filter((conversation) =>
        !query || conversation.title.toLowerCase().includes(query)
    );

    conversationList.innerHTML = filtered.map((conversation) => `
        <button class="conversation-item ${conversation.id === state.activeConversationId ? "active" : ""}" data-id="${conversation.id}">
            <h3>${escapeHtml(conversation.title)}</h3>
            <time>${new Date(conversation.last_message_at).toLocaleString()}</time>
        </button>
    `).join("");

    conversationList.querySelectorAll(".conversation-item").forEach((button) => {
        button.addEventListener("click", () => openConversation(Number(button.dataset.id)));
    });
}

async function loadConversations() {
    const data = await api("/api/chat/conversations");
    if (!data) {
        return;
    }
    state.conversations = data.conversations || [];
    renderConversations();
}

async function openConversation(conversationId) {
    clearStatus();
    const data = await api(`/api/chat/conversations/${conversationId}`);
    if (!data) {
        return;
    }
    state.activeConversationId = conversationId;
    chatTitle.textContent = data.conversation.title;
    renderMessages(data.messages || []);
    renderConversations();
}

async function createConversation() {
    const data = await api("/api/chat/conversations", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ title: null }),
    });
    if (!data) {
        return null;
    }
    state.activeConversationId = data.conversation.id;
    chatTitle.textContent = data.conversation.title;
    renderMessages([]);
    await loadConversations();
    return data.conversation.id;
}

function autoGrowTextarea() {
    messageInput.style.height = "auto";
    messageInput.style.height = `${Math.min(messageInput.scrollHeight, 220)}px`;
}

function speakReply(text) {
    if (!state.speechEnabled || !("speechSynthesis" in window)) {
        return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = languageSelect.value || state.user?.default_languages?.[0] || "en-US";
    window.speechSynthesis.speak(utterance);
}

function setupVoiceRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        voiceButton.disabled = true;
        voiceButton.textContent = "Voice unavailable";
        return;
    }

    state.recognition = new SpeechRecognition();
    state.recognition.continuous = false;
    state.recognition.interimResults = false;

    state.recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        messageInput.value = messageInput.value
            ? `${messageInput.value.trim()} ${transcript}`
            : transcript;
        autoGrowTextarea();
    };

    state.recognition.onstart = () => {
        voiceButton.textContent = "Listening...";
    };

    state.recognition.onend = () => {
        voiceButton.textContent = "Voice input";
    };
}

async function sendMessage(event) {
    event.preventDefault();
    clearStatus();
    const text = messageInput.value.trim();
    if (!text) {
        return;
    }

    let conversationId = state.activeConversationId;
    if (!conversationId) {
        conversationId = await createConversation();
    }
    if (!conversationId) {
        return;
    }

    messageInput.value = "";
    autoGrowTextarea();
    showStatus("Thinking and saving this chat...", "success");

    try {
        const data = await api(`/api/chat/conversations/${conversationId}/messages`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                message: text,
                language: languageSelect.value,
                input_mode: "text",
            }),
        });
        if (!data) {
            return;
        }
        state.activeConversationId = data.conversation.id;
        chatTitle.textContent = data.conversation.title;
        const current = await api(`/api/chat/conversations/${conversationId}`);
        renderMessages(current.messages || []);
        await loadConversations();
        clearStatus();
        const assistantMessage = (data.messages || []).find((message) => message.sender === "assistant");
        if (assistantMessage) {
            speakReply(assistantMessage.message);
        }
    } catch (error) {
        showStatus(error.message);
    }
}

async function hydrate() {
    try {
        const [profileData, languagesData] = await Promise.all([
            api("/api/auth/me"),
            fetch(getApiUrl("/api/profile/languages")).then((response) => response.json()),
        ]);
        if (!profileData) {
            return;
        }
        state.user = profileData.user;
        state.languages = languagesData.languages || [];
        localStorage.setItem("polychat_user", JSON.stringify(state.user));
        renderProfileHeader();
        renderLanguageSelect();
        await loadConversations();
        if (state.conversations.length) {
            await openConversation(state.conversations[0].id);
        } else {
            renderMessages([]);
        }
        setupVoiceRecognition();
    } catch (error) {
        showStatus(error.message || "Unable to load chat.");
    }
}

composerForm.addEventListener("submit", sendMessage);
newChatButton.addEventListener("click", async () => {
    clearStatus();
    await createConversation();
});
conversationSearch.addEventListener("input", renderConversations);
messageInput.addEventListener("input", autoGrowTextarea);
voiceButton.addEventListener("click", () => {
    if (!state.recognition) {
        showStatus("Voice input is not supported in this browser.");
        return;
    }
    state.recognition.lang = languageSelect.value || "en-US";
    state.recognition.start();
});
speakerButton.addEventListener("click", () => {
    state.speechEnabled = !state.speechEnabled;
    speakerButton.textContent = state.speechEnabled ? "Voice on" : "Voice off";
});
profileMenuButton.addEventListener("click", () => {
    profileDropdown.classList.toggle("hidden");
});
logoutButton.addEventListener("click", clearAuth);
document.addEventListener("click", (event) => {
    if (!profileMenuButton.contains(event.target) && !profileDropdown.contains(event.target)) {
        profileDropdown.classList.add("hidden");
    }
});

hydrate();
