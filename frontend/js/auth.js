const HOSTNAME = window.location.hostname || "127.0.0.1";
const API_ROOT = window.location.port === "8000"
    ? window.location.origin
    : `${window.location.protocol}//${HOSTNAME}:8000`;

const authStatus = document.getElementById("authStatus");
const toggleButtons = document.querySelectorAll(".toggle-button");
const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const registerLanguages = document.getElementById("registerLanguages");
const languageCount = document.getElementById("languageCount");
const loginSubmitBtn = document.getElementById("loginSubmitBtn");
const registerSubmitBtn = document.getElementById("registerSubmitBtn");

const FALLBACK_LANGUAGES = [
    { code: "en-US", label: "English" },
    { code: "hi-IN", label: "Hindi" },
    { code: "bn-BD", label: "Bengali" },
    { code: "gu-IN", label: "Gujarati" },
    { code: "mr-IN", label: "Marathi" },
    { code: "pa-IN", label: "Punjabi" },
    { code: "ta-IN", label: "Tamil" },
    { code: "te-IN", label: "Telugu" },
    { code: "ur-PK", label: "Urdu" },
    { code: "es-ES", label: "Spanish" },
    { code: "fr-FR", label: "French" },
    { code: "de-DE", label: "German" },
    { code: "ja-JP", label: "Japanese" },
    { code: "ar-SA", label: "Arabic" },
];

const getApiUrl = (path) => `${API_ROOT}${path}`;
const goToChat = () => {
    if (window.PolyChat3D && typeof window.PolyChat3D.navigate === "function") {
        window.PolyChat3D.navigate("./chat.html");
    } else {
        window.location.href = "./chat.html";
    }
};

function showStatus(message, type = "error") {
    authStatus.textContent = message;
    authStatus.className = `status-banner ${type}`;
}

function clearStatus() {
    authStatus.textContent = "";
    authStatus.className = "status-banner hidden";
}

function storeAuth(data) {
    localStorage.setItem("polychat_token", data.token);
    localStorage.setItem("polychat_user", JSON.stringify(data.user));
}

function getSelectedLanguages(container) {
    return Array.from(container.querySelectorAll("input:checked")).map((input) => input.value);
}

function updateLanguageCount() {
    const count = getSelectedLanguages(registerLanguages).length;
    languageCount.textContent = `${count} selected`;
}

function renderLanguageOptions(languages) {
    const defaultPreselected = ["en-US", "hi-IN"];
    registerLanguages.innerHTML = languages.map((language) => `
        <label class="language-option">
            <input type="checkbox" value="${language.code}" ${defaultPreselected.includes(language.code) ? "checked" : ""}>
            <span>${language.label}</span>
        </label>
    `).join("");
    registerLanguages.onchange = updateLanguageCount;
    updateLanguageCount();
}

function formatApiError(data) {
    if (!data) return "Request failed.";
    if (typeof data.detail === "string") return data.detail;
    if (Array.isArray(data.detail) && data.detail.length) {
        return data.detail.map((err) => err.msg || JSON.stringify(err)).join(", ");
    }
    return "Unable to complete request. Please check your details.";
}

async function request(path, payload) {
    const response = await fetch(getApiUrl(path), {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(formatApiError(data));
    }
    return data;
}

async function loadLanguages() {
    try {
        const response = await fetch(getApiUrl("/api/profile/languages"));
        const data = await response.json();
        renderLanguageOptions(data.languages && data.languages.length ? data.languages : FALLBACK_LANGUAGES);
    } catch (error) {
        renderLanguageOptions(FALLBACK_LANGUAGES);
    }
}

function switchForm(target) {
    toggleButtons.forEach((button) => {
        button.classList.toggle("is-active", button.dataset.target === target);
    });
    loginForm.classList.toggle("is-active", target === "login");
    registerForm.classList.toggle("is-active", target === "register");
    clearStatus();
}

toggleButtons.forEach((button) => {
    button.addEventListener("click", () => switchForm(button.dataset.target));
});

loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearStatus();
    const formData = new FormData(loginForm);
    const originalText = loginSubmitBtn.textContent;
    loginSubmitBtn.disabled = true;
    loginSubmitBtn.textContent = "⏳ Signing in...";

    try {
        const result = await request("/api/auth/login", {
            identifier: String(formData.get("identifier") || "").trim(),
            password: String(formData.get("password") || ""),
        });
        storeAuth(result);
        showStatus("Welcome back! Launching 3D workspace...", "success");
        setTimeout(goToChat, 250);
    } catch (error) {
        showStatus(error.message);
        loginSubmitBtn.disabled = false;
        loginSubmitBtn.textContent = originalText;
    }
});

registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearStatus();
    const formData = new FormData(registerForm);
    const selectedLanguages = getSelectedLanguages(registerLanguages);

    if (selectedLanguages.length < 2) {
        showStatus("Please select at least 2 default languages before registering.");
        return;
    }

    const originalText = registerSubmitBtn.textContent;
    registerSubmitBtn.disabled = true;
    registerSubmitBtn.textContent = "⏳ Creating your account...";

    try {
        const result = await request("/api/auth/register", {
            full_name: String(formData.get("full_name") || "").trim() || null,
            username: String(formData.get("username") || "").trim(),
            email: String(formData.get("email") || "").trim(),
            password: String(formData.get("password") || ""),
            bio: String(formData.get("bio") || "").trim() || null,
            default_languages: selectedLanguages,
        });
        storeAuth(result);
        showStatus("Account created! Entering 3D workspace...", "success");
        setTimeout(goToChat, 250);
    } catch (error) {
        showStatus(error.message);
        registerSubmitBtn.disabled = false;
        registerSubmitBtn.textContent = originalText;
    }
});

document.addEventListener("DOMContentLoaded", async () => {
    await loadLanguages();
    const existingToken = localStorage.getItem("polychat_token");
    if (existingToken) {
        try {
            const res = await fetch(getApiUrl("/api/auth/me"), {
                headers: { Authorization: `Bearer ${existingToken}` },
            });
            if (res.ok) {
                goToChat();
                return;
            }
            localStorage.removeItem("polychat_token");
            localStorage.removeItem("polychat_user");
        } catch (_) {
            // Stay on login page if server is unreachable
        }
    }
});
