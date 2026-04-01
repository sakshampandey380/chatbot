const HOSTNAME = window.location.hostname || "127.0.0.1";
const API_ROOT = window.location.port === "8000"
    ? window.location.origin
    : `${window.location.protocol}//${HOSTNAME}:8000`;

const token = localStorage.getItem("polychat_token");
if (!token) {
    window.location.href = "./index.html";
}

const profileForm = document.getElementById("profileForm");
const profileLanguages = document.getElementById("profileLanguages");
const profileLanguageCount = document.getElementById("profileLanguageCount");
const profileStatus = document.getElementById("profileStatus");
const profilePhotoInput = document.getElementById("profilePhotoInput");
const profilePreview = document.getElementById("profilePreview");
const profileHeaderAvatar = document.getElementById("profileHeaderAvatar");
const profileHeaderName = document.getElementById("profileHeaderName");
const profileNameCard = document.getElementById("profileNameCard");
const profileCreatedAt = document.getElementById("profileCreatedAt");
const createdAtInput = document.getElementById("createdAtInput");

let currentUser = null;
let languageOptions = [];

const getApiUrl = (path) => `${API_ROOT}${path}`;
const getAssetUrl = (path) => {
    if (!path) {
        return "./images/default-avatar.svg";
    }
    if (path.startsWith("http")) {
        return path;
    }
    return `${API_ROOT}${path}`;
};

function showStatus(message, type = "error") {
    profileStatus.textContent = message;
    profileStatus.className = `status-banner ${type}`;
}

function clearStatus() {
    profileStatus.textContent = "";
    profileStatus.className = "status-banner hidden";
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

function getSelectedLanguages() {
    return Array.from(profileLanguages.querySelectorAll("input:checked")).map((input) => input.value);
}

function updateLanguageCount() {
    profileLanguageCount.textContent = `${getSelectedLanguages().length} selected`;
}

function renderLanguageOptions(selectedValues = []) {
    profileLanguages.innerHTML = languageOptions.map((language) => `
        <label class="language-option">
            <input type="checkbox" value="${language.code}" ${selectedValues.includes(language.code) ? "checked" : ""}>
            <span>${language.label}</span>
        </label>
    `).join("");
    profileLanguages.onchange = updateLanguageCount;
    updateLanguageCount();
}

function fillProfile(user) {
    currentUser = user;
    profileForm.elements.full_name.value = user.full_name || "";
    profileForm.elements.username.value = user.username || "";
    profileForm.elements.email.value = user.email || "";
    profileForm.elements.bio.value = user.bio || "";
    createdAtInput.value = new Date(user.created_at).toLocaleString();
    profileHeaderName.textContent = user.full_name || user.username || "Profile settings";
    profileNameCard.textContent = user.full_name || user.username || "Your profile";
    profileCreatedAt.textContent = `Created ${new Date(user.created_at).toLocaleDateString()}`;
    profilePreview.src = getAssetUrl(user.profile_pic);
    profileHeaderAvatar.src = getAssetUrl(user.profile_pic);
    renderLanguageOptions(user.default_languages || []);
}

async function uploadPhotoIfNeeded() {
    const file = profilePhotoInput.files[0];
    if (!file) {
        return currentUser;
    }

    const formData = new FormData();
    formData.append("photo", file);

    const data = await api("/api/profile/photo", {
        method: "POST",
        body: formData,
    });
    currentUser = data.user;
    profilePreview.src = getAssetUrl(currentUser.profile_pic);
    profileHeaderAvatar.src = getAssetUrl(currentUser.profile_pic);
    return currentUser;
}

profilePhotoInput.addEventListener("change", () => {
    const file = profilePhotoInput.files[0];
    if (file) {
        profilePreview.src = URL.createObjectURL(file);
    }
});

profileForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearStatus();
    const selectedLanguages = getSelectedLanguages();
    if (selectedLanguages.length < 2) {
        showStatus("Please keep at least two default languages selected.");
        return;
    }

    try {
        await uploadPhotoIfNeeded();
        const data = await api("/api/profile/", {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                full_name: profileForm.elements.full_name.value,
                username: profileForm.elements.username.value,
                email: profileForm.elements.email.value,
                bio: profileForm.elements.bio.value,
                default_languages: selectedLanguages,
            }),
        });
        if (!data) {
            return;
        }
        fillProfile(data.user);
        localStorage.setItem("polychat_user", JSON.stringify(data.user));
        showStatus("Profile saved successfully.", "success");
        profilePhotoInput.value = "";
    } catch (error) {
        showStatus(error.message);
    }
});

async function hydrate() {
    try {
        const [languageData, profileData] = await Promise.all([
            fetch(getApiUrl("/api/profile/languages")).then((response) => response.json()),
            api("/api/profile/"),
        ]);
        if (!profileData) {
            return;
        }
        languageOptions = languageData.languages || [];
        fillProfile(profileData.user);
    } catch (error) {
        showStatus(error.message || "Unable to load profile.");
    }
}

hydrate();
