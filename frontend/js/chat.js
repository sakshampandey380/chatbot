const HOSTNAME = window.location.hostname || "127.0.0.1";
const CHAT_API_ROOT = window.location.port === "8000"
    ? window.location.origin
    : `${window.location.protocol}//${HOSTNAME}:8000`;

const state = {
    user: null,
    languages: [],
    conversations: [],
    memories: [],
    activeConversationId: null,
    messages: [],
    speechEnabled: false,
    recognition: null,
    isListening: false,
    isSending: false,
    typingTimer: null,
};

const chatSidebar = document.getElementById("chatSidebar");
const sidebarBackdrop = document.getElementById("sidebarBackdrop");
const mobileMenuBtn = document.getElementById("mobileMenuBtn");
const chatTitle = document.getElementById("chatTitle");
const messagesPanel = document.getElementById("messagesPanel");
const emptyState = document.getElementById("emptyState");
const chatStatus = document.getElementById("chatStatus");
const conversationList = document.getElementById("conversationList");
const memoryTags = document.getElementById("memoryTags");
const memoryCountBadge = document.getElementById("memoryCountBadge");
const messageInput = document.getElementById("messageInput");
const composerForm = document.getElementById("composerForm");
const sendButton = document.getElementById("sendButton");
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

function toggleMobileSidebar(forceOpen) {
    if (!chatSidebar || !sidebarBackdrop) return;
    const isOpen = typeof forceOpen === "boolean" ? forceOpen : !chatSidebar.classList.contains("is-open");
    chatSidebar.classList.toggle("is-open", isOpen);
    sidebarBackdrop.classList.toggle("is-open", isOpen);
}

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
    if (window.PolyChat3D && typeof window.PolyChat3D.navigate === "function") {
        window.PolyChat3D.navigate("./index.html");
    } else {
        window.location.href = "./index.html";
    }
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
        const msg = typeof data.detail === "string" ? data.detail : "Request failed.";
        throw new Error(msg);
    }
    return data;
}

function escapeHtml(text) {
    return String(text)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

function formatMessageHtml(text) {
    let html = escapeHtml(text);
    // Code blocks ```...```
    html = html.replace(/```([a-zA-Z]*)\n([\s\S]*?)```/g, (_, _lang, code) => {
        return `<pre style="background:rgba(15,23,42,0.07);padding:12px 14px;border-radius:12px;overflow-x:auto;font-family:monospace;font-size:0.88rem;margin:8px 0;"><code>${code.trim()}</code></pre>`;
    });
    // Inline `code`
    html = html.replace(/`([^`]+)`/g, `<code style="background:rgba(99,102,241,0.12);padding:2px 6px;border-radius:6px;font-size:0.88em;">$1</code>`);
    // Bold **text**
    html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    // Line breaks
    html = html.replace(/\n/g, "<br>");
    return html;
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

function renderMemories() {
    if (!memoryTags || !memoryCountBadge) return;
    memoryCountBadge.textContent = String(state.memories.length);
    if (!state.memories.length) {
        memoryTags.innerHTML = `<span class="muted-copy" style="font-size:0.78rem;">Tell me your name, city, or interests!</span>`;
        return;
    }
    memoryTags.innerHTML = state.memories.slice(0, 8).map((item) => `
        <span class="memory-tag" title="${escapeHtml(item.key)}: ${escapeHtml(item.value)}">
            <strong>${escapeHtml(item.key)}:</strong> ${escapeHtml(item.value)}
        </span>
    `).join("");
}

async function loadMemories() {
    try {
        const data = await api("/api/chat/memories");
        if (data && data.memories) {
            state.memories = data.memories;
            renderMemories();
        }
    } catch (_) {
        // Ignore non-critical memory fetch errors
    }
}

function createMessageElement(message, isStreaming = false) {
    const row = document.createElement("article");
    row.className = `message-row ${message.sender}`;
    const senderLabel = message.sender === "assistant" ? "✨ PolyChat AI" : "👤 You";

    row.innerHTML = `
        <div class="message-bubble">
            <div class="message-meta">
                <h4>${senderLabel}</h4>
                <div class="message-actions">
                    <button type="button" class="msg-action-btn copy-btn" title="Copy message">📋 Copy</button>
                    <button type="button" class="msg-action-btn speak-btn" title="Listen">🔊 Listen</button>
                </div>
            </div>
            <div class="message-content">${isStreaming ? "" : formatMessageHtml(message.message)}</div>
        </div>
    `;

    const copyBtn = row.querySelector(".copy-btn");
    const speakBtn = row.querySelector(".speak-btn");

    copyBtn.addEventListener("click", () => {
        navigator.clipboard.writeText(message.message).then(() => {
            copyBtn.textContent = "✅ Copied";
            setTimeout(() => {
                copyBtn.textContent = "📋 Copy";
            }, 1400);
        });
    });

    speakBtn.addEventListener("click", () => {
        speakReply(message.message, true);
    });

    return row;
}

function animateTypewriterReply(contentEl, fullText) {
    return new Promise((resolve) => {
        const words = fullText.split(/(\s+)/);
        let index = 0;
        let currentText = "";
        const step = Math.max(1, Math.ceil(words.length / 55));

        function tick() {
            if (index < words.length) {
                currentText += words.slice(index, index + step).join("");
                index += step;
                contentEl.innerHTML = formatMessageHtml(currentText) + `<span class="streaming-cursor"></span>`;
                messagesPanel.scrollTop = messagesPanel.scrollHeight;
                setTimeout(tick, 22);
            } else {
                contentEl.innerHTML = formatMessageHtml(fullText);
                messagesPanel.scrollTop = messagesPanel.scrollHeight;
                resolve();
            }
        }
        tick();
    });
}

function renderMessages(messages) {
    state.messages = messages;
    messagesPanel.innerHTML = "";
    if (!messages.length) {
        messagesPanel.appendChild(emptyState);
        emptyState.classList.remove("hidden");
        return;
    }

    emptyState.classList.add("hidden");
    messages.forEach((message) => {
        messagesPanel.appendChild(createMessageElement(message, false));
    });
    messagesPanel.scrollTop = messagesPanel.scrollHeight;
}

function showThinkingIndicator() {
    removeThinkingIndicator();
    const row = document.createElement("div");
    row.id = "aiThinkingRow";
    row.className = "message-row assistant";
    row.innerHTML = `
        <div class="thinking-bubble">
            <div class="thinking-dots">
                <span></span><span></span><span></span>
            </div>
            <span style="font-size:0.88rem;font-weight:600;color:var(--accent);">PolyChat AI is crafting a reply...</span>
        </div>
    `;
    messagesPanel.appendChild(row);
    messagesPanel.scrollTop = messagesPanel.scrollHeight;
}

function removeThinkingIndicator() {
    const existing = document.getElementById("aiThinkingRow");
    if (existing) existing.remove();
}

function renderConversations() {
    const query = conversationSearch.value.trim().toLowerCase();
    const filtered = state.conversations.filter((conversation) =>
        !query || conversation.title.toLowerCase().includes(query)
    );

    if (!filtered.length) {
        conversationList.innerHTML = `
            <div class="muted-copy" style="text-align:center;padding:18px 10px;font-size:0.88rem;">
                No conversations yet. Start chatting below!
            </div>
        `;
        return;
    }

    conversationList.innerHTML = filtered.map((conversation) => `
        <div class="conversation-item ${conversation.id === state.activeConversationId ? "active" : ""}" data-id="${conversation.id}">
            <div class="conversation-item-info">
                <h3>${escapeHtml(conversation.title)}</h3>
                <time>${new Date(conversation.last_message_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</time>
            </div>
            <button type="button" class="conv-delete-btn" data-delete-id="${conversation.id}" title="Delete conversation">🗑️</button>
        </div>
    `).join("");

    conversationList.querySelectorAll(".conversation-item").forEach((item) => {
        item.addEventListener("click", (e) => {
            if (e.target.closest(".conv-delete-btn")) return;
            openConversation(Number(item.dataset.id));
            toggleMobileSidebar(false);
        });
    });

    conversationList.querySelectorAll(".conv-delete-btn").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
            e.stopPropagation();
            const convId = Number(btn.dataset.deleteId);
            await deleteConversationById(convId);
        });
    });
}

async function deleteConversationById(conversationId) {
    try {
        await api(`/api/chat/conversations/${conversationId}`, { method: "DELETE" });
        state.conversations = state.conversations.filter((c) => c.id !== conversationId);
        if (state.activeConversationId === conversationId) {
            if (state.conversations.length) {
                await openConversation(state.conversations[0].id);
            } else {
                state.activeConversationId = null;
                chatTitle.textContent = "Start a new conversation";
                renderMessages([]);
            }
        }
        renderConversations();
    } catch (error) {
        showStatus(error.message);
    }
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
    // Reuse existing empty "New conversation" if already active
    const existingEmpty = state.conversations.find((c) => c.title === "New conversation" && c.id === state.activeConversationId && state.messages.length === 0);
    if (existingEmpty) {
        return existingEmpty.id;
    }

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
    messageInput.style.height = `${Math.min(messageInput.scrollHeight, 160)}px`;

    // Trigger live 3D typing wave animation
    const hasText = messageInput.value.trim().length > 0;
    if (hasText) {
        composerForm.classList.add("is-typing");
        clearTimeout(state.typingTimer);
        state.typingTimer = setTimeout(() => {
            composerForm.classList.remove("is-typing");
        }, 1400);
    } else {
        composerForm.classList.remove("is-typing");
    }
}

function speakReply(text, force = false) {
    if ((!state.speechEnabled && !force) || !("speechSynthesis" in window)) {
        return;
    }
    window.speechSynthesis.cancel();
    const cleanSpeech = String(text).replace(/[*_`#>-]/g, "");
    const utterance = new SpeechSynthesisUtterance(cleanSpeech);
    utterance.lang = languageSelect.value || state.user?.default_languages?.[0] || "en-US";
    window.speechSynthesis.speak(utterance);
}

function setupVoiceRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        voiceButton.disabled = true;
        voiceButton.textContent = "🎙️ Voice N/A";
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
        messageInput.focus();
    };

    state.recognition.onstart = () => {
        state.isListening = true;
        voiceButton.classList.add("is-listening");
        voiceButton.textContent = "🛑 Listening...";
    };

    state.recognition.onend = () => {
        state.isListening = false;
        voiceButton.classList.remove("is-listening");
        voiceButton.textContent = "🎙️ Voice Input";
    };

    state.recognition.onerror = () => {
        state.isListening = false;
        voiceButton.classList.remove("is-listening");
        voiceButton.textContent = "🎙️ Voice Input";
    };
}

async function sendMessage(event) {
    if (event) event.preventDefault();
    if (state.isSending) return;
    clearStatus();

    const text = messageInput.value.trim();
    if (!text) {
        return;
    }

    state.isSending = true;
    sendButton.disabled = true;
    composerForm.classList.remove("is-typing");

    try {
        let conversationId = state.activeConversationId;
        if (!conversationId) {
            conversationId = await createConversation();
        }
        if (!conversationId) {
            state.isSending = false;
            sendButton.disabled = false;
            return;
        }

        messageInput.value = "";
        autoGrowTextarea();

        // 1. Immediately show optimistic user message bubble with 3D pop-in
        emptyState.classList.add("hidden");
        const tempUserMsg = {
            id: Date.now(),
            sender: "user",
            message: text,
            created_at: new Date().toISOString(),
        };
        state.messages.push(tempUserMsg);
        messagesPanel.appendChild(createMessageElement(tempUserMsg, false));
        messagesPanel.scrollTop = messagesPanel.scrollHeight;

        // 2. Show 3D AI thinking indicator
        showThinkingIndicator();

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

        removeThinkingIndicator();
        if (!data) {
            state.isSending = false;
            sendButton.disabled = false;
            return;
        }

        state.activeConversationId = data.conversation.id;
        chatTitle.textContent = data.conversation.title;

        const assistantMessage = (data.messages || []).find((m) => m.sender === "assistant");
        if (assistantMessage) {
            state.messages.push(assistantMessage);
            const assistantRow = createMessageElement(assistantMessage, true);
            messagesPanel.appendChild(assistantRow);
            const contentEl = assistantRow.querySelector(".message-content");
            await animateTypewriterReply(contentEl, assistantMessage.message);
            speakReply(assistantMessage.message, false);
        }

        await Promise.all([loadConversations(), loadMemories()]);
    } catch (error) {
        removeThinkingIndicator();
        showStatus(error.message);
    } finally {
        state.isSending = false;
        sendButton.disabled = false;
        messageInput.focus();
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
        await Promise.all([loadConversations(), loadMemories()]);
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

messageInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        sendMessage(event);
    }
});

newChatButton.addEventListener("click", async () => {
    clearStatus();
    await createConversation();
    toggleMobileSidebar(false);
    messageInput.focus();
});

document.querySelectorAll(".quick-prompt-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
        messageInput.value = chip.dataset.prompt || "";
        autoGrowTextarea();
        sendMessage();
    });
});

if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener("click", () => toggleMobileSidebar());
}
if (sidebarBackdrop) {
    sidebarBackdrop.addEventListener("click", () => toggleMobileSidebar(false));
}

conversationSearch.addEventListener("input", renderConversations);
messageInput.addEventListener("input", autoGrowTextarea);

voiceButton.addEventListener("click", () => {
    if (!state.recognition) {
        showStatus("Voice input is not supported in this browser.");
        return;
    }
    if (state.isListening) {
        state.recognition.stop();
        return;
    }
    try {
        state.recognition.lang = languageSelect.value || "en-US";
        state.recognition.start();
    } catch (_) {
        state.recognition.stop();
    }
});

speakerButton.addEventListener("click", () => {
    state.speechEnabled = !state.speechEnabled;
    speakerButton.classList.toggle("is-active-voice", state.speechEnabled);
    speakerButton.textContent = state.speechEnabled ? "🔊 Voice On" : "🔈 Voice Off";
    if (!state.speechEnabled && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
    }
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
