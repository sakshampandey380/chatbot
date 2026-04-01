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

const getApiUrl = (path) => `${API_ROOT}${path}`;
const goToChat = () => {
    window.location.href = "./chat.html";
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
    registerLanguages.innerHTML = languages.map((language) => `
        <label class="language-option">
            <input type="checkbox" value="${language.code}">
            <span>${language.label}</span>
        </label>
    `).join("");
    registerLanguages.onchange = updateLanguageCount;
    updateLanguageCount();
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
        throw new Error(data.detail || "Request failed.");
    }
    return data;
}

async function loadLanguages() {
    try {
        const response = await fetch(getApiUrl("/api/profile/languages"));
        const data = await response.json();
        renderLanguageOptions(data.languages || []);
    } catch (error) {
        showStatus("Unable to load language choices right now.");
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

    try {
        const result = await request("/api/auth/login", {
            identifier: formData.get("identifier"),
            password: formData.get("password"),
        });
        storeAuth(result);
        goToChat();
    } catch (error) {
        showStatus(error.message);
    }
});

registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearStatus();
    const formData = new FormData(registerForm);
    const selectedLanguages = getSelectedLanguages(registerLanguages);

    if (selectedLanguages.length < 2) {
        showStatus("Please choose at least two languages before registering.");
        return;
    }

    try {
        const result = await request("/api/auth/register", {
            full_name: formData.get("full_name"),
            username: formData.get("username"),
            email: formData.get("email"),
            password: formData.get("password"),
            bio: formData.get("bio"),
            default_languages: selectedLanguages,
        });
        storeAuth(result);
        goToChat();
    } catch (error) {
        showStatus(error.message);
    }
});

document.addEventListener("DOMContentLoaded", () => {
    if (localStorage.getItem("polychat_token")) {
        goToChat();
        return;
    }
    loadLanguages();
});
