const STORAGE_KEYS = {
    SETTINGS: "settings",
    SHORTCUTS: "shortcuts",
    VERSION: "version",
};
const CURRENT_VERSION = "1.0.0";
const MAX_SHORTCUTS = 20;
const DEFAULT_SETTINGS = {
    theme: "system",
    columns: 4,
    showClock: true,
    showSearch: true,
    showWeather: false,
};
const DEFAULT_SHORTCUTS = [
    {
        id: "youtube",
        title: "YouTube",
        url: "https://youtube.com",
    },
    {
        id: "github",
        title: "GitHub",
        url: "https://github.com",
    },
];

function getFaviconUrl(url) {
    try {
        const domain = new URL(url).hostname;
        return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
    } catch (e) {
        return null;
    }
}

function generateShortcutId() {
    return crypto.randomUUID();
}

function isValidUrl(url) {
    try {
        const parsed = new URL(url);
        return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch (e) {
        return false;
    }
}

function createModal(title, content) {
    const modalRoot = document.getElementById("modal-root");
    modalRoot.innerHTML = "";
    modalRoot.previousFocus = document.activeElement;
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    const container = document.createElement("div");
    container.className = "modal-container";
    container.setAttribute("role", "dialog");
    container.setAttribute("aria-modal", "true");
    container.setAttribute("aria-labelledby", "modal-title");
    const header = document.createElement("div");
    header.className = "modal-header";
    const titleEl = document.createElement("h2");
    titleEl.id = "modal-title";
    titleEl.textContent = title;
    const closeBtn = document.createElement("button");
    closeBtn.className = "modal-close";
    closeBtn.setAttribute("aria-label", "Close");
    closeBtn.textContent = "×";
    closeBtn.addEventListener("click", closeModal);
    header.appendChild(titleEl);
    header.appendChild(closeBtn);
    const body = document.createElement("div");
    body.className = "modal-body";
    body.innerHTML = content;
    container.appendChild(header);
    container.appendChild(body);
    overlay.appendChild(container);
    modalRoot.appendChild(overlay);
    const handleEscape = (e) => {
        if (e.key === "Escape") {
            closeModal();
        }
    };
    const handleOverlayClick = (e) => {
        if (e.target === overlay) {
            closeModal();
        }
    };
    overlay.addEventListener("click", handleOverlayClick);
    document.addEventListener("keydown", handleEscape);
    const handleTab = (e) => {
        if (e.key !== "Tab") return;
        const focusableElements = container.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstFocusable = focusableElements[0];
        const lastFocusable = focusableElements[focusableElements.length - 1];
        if (e.shiftKey) {
            if (document.activeElement === firstFocusable) {
                e.preventDefault();
                lastFocusable.focus();
            }
        } else {
            if (document.activeElement === lastFocusable) {
                e.preventDefault();
                firstFocusable.focus();
            }
        }
    };
    document.addEventListener("keydown", handleTab);
    const firstInput = container.querySelector("input, button:not(.modal-close)");
    if (firstInput) {
        firstInput.focus();
    }
    modalRoot.cleanup = () => {
        document.removeEventListener("keydown", handleEscape);
        document.removeEventListener("keydown", handleTab);
        overlay.removeEventListener("click", handleOverlayClick);
    };
    return container;
}

function closeModal() {
    const modalRoot = document.getElementById("modal-root");
    if (modalRoot.cleanup) {
        modalRoot.cleanup();
        delete modalRoot.cleanup;
    }
    if (modalRoot.previousFocus && document.contains(modalRoot.previousFocus)) {
        modalRoot.previousFocus.focus();
    }
    delete modalRoot.previousFocus;
    modalRoot.innerHTML = "";
}

function showErrorModal(message) {
    const errorModal = document.createElement("div");
    errorModal.className = "error-modal";
    const messageP = document.createElement("p");
    messageP.className = "error-message";
    messageP.textContent = message;
    errorModal.appendChild(messageP);
    const footer = document.createElement("div");
    footer.className = "modal-footer";
    const okBtn = document.createElement("button");
    okBtn.type = "button";
    okBtn.className = "btn btn-primary";
    okBtn.id = "ok-btn";
    okBtn.textContent = "OK";
    footer.appendChild(okBtn);
    errorModal.appendChild(footer);
    const modal = createModal("Error", errorModal.outerHTML);
    const modalOkBtn = modal.querySelector("#ok-btn");
    modalOkBtn.addEventListener("click", closeModal);
    modalOkBtn.focus();
}

async function initializeStorage() {
    const data = await chrome.storage.sync.get([STORAGE_KEYS.SETTINGS, STORAGE_KEYS.SHORTCUTS]);
    const updates = {};
    if (!data[STORAGE_KEYS.SETTINGS] || !data[STORAGE_KEYS.SHORTCUTS]) {
        const legacyData = localStorage.getItem("newtab_data");
        if (legacyData) {
            try {
                const parsed = JSON.parse(legacyData);
                if (!data[STORAGE_KEYS.SETTINGS] && parsed[STORAGE_KEYS.SETTINGS]) {
                    updates[STORAGE_KEYS.SETTINGS] = parsed[STORAGE_KEYS.SETTINGS];
                }
                if (!data[STORAGE_KEYS.SHORTCUTS] && parsed[STORAGE_KEYS.SHORTCUTS]) {
                    updates[STORAGE_KEYS.SHORTCUTS] = parsed[STORAGE_KEYS.SHORTCUTS];
                }
                localStorage.removeItem("newtab_data");
            } catch (e) {
                console.error("Failed to migrate legacy data:", e);
            }
        }
    }
    if (!data[STORAGE_KEYS.SETTINGS] && !updates[STORAGE_KEYS.SETTINGS]) {
        updates[STORAGE_KEYS.SETTINGS] = DEFAULT_SETTINGS;
    }
    if (!data[STORAGE_KEYS.SHORTCUTS] && !updates[STORAGE_KEYS.SHORTCUTS]) {
        updates[STORAGE_KEYS.SHORTCUTS] = DEFAULT_SHORTCUTS;
    }

    if (Object.keys(updates).length > 0) {
        await chrome.storage.sync.set(updates);
    }
}

function renderShortcuts(shortcuts) {
    const app = document.getElementById("app");
    app.innerHTML = "";
    const grid = document.createElement("div");
    grid.className = "shortcuts-grid";
    shortcuts.forEach((shortcut) => {
        const shortcutWrapper = document.createElement("div");
        shortcutWrapper.className = "shortcut";
        const card = document.createElement("a");
        card.className = "shortcut-card";
        card.setAttribute("data-id", shortcut.id);
        card.href = shortcut.url;
        card.setAttribute("role", "button");
        card.setAttribute("aria-label", `Open ${shortcut.title}`);
        const iconContainer = document.createElement("div");
        iconContainer.className = "shortcut-icon";
        const img = document.createElement("img");
        img.alt = `${shortcut.title} favicon`;
        const faviconUrl = getFaviconUrl(shortcut.url);
        if (faviconUrl) {
            img.src = faviconUrl;
            img.addEventListener("error", () => {
                const char = (shortcut.title?.trim()[0] || "?").toUpperCase();
                img.src = `data:image/svg+xml,${encodeURIComponent(
                    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90" text-anchor="middle" x="50">${char}</text></svg>`
                )}`;
            });
        } else {
            const char = (shortcut.title?.trim()[0] || "?").toUpperCase();
            img.src = `data:image/svg+xml,${encodeURIComponent(
                `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90" text-anchor="middle" x="50">${char}</text></svg>`
            )}`;
        }
        iconContainer.appendChild(img);
        card.appendChild(iconContainer);
        const title = document.createElement("div");
        title.className = "shortcut-title";
        title.textContent = shortcut.title;
        const deleteBtn = document.createElement("button");
        deleteBtn.className = "shortcut-delete";
        deleteBtn.setAttribute("aria-label", `Delete ${shortcut.title}`);
        deleteBtn.textContent = "×";
        deleteBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            handleDeleteShortcut(shortcut.id);
        });
        const editBtn = document.createElement("button");
        editBtn.className = "shortcut-edit";
        editBtn.setAttribute("aria-label", `Edit ${shortcut.title}`);
        editBtn.textContent = "✎";
        editBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            openEditModal(shortcut.id);
        });
        card.addEventListener("click", () => {
            window.location.href = shortcut.url;
        });
        shortcutWrapper.appendChild(card);
        shortcutWrapper.appendChild(title);
        shortcutWrapper.appendChild(deleteBtn);
        shortcutWrapper.appendChild(editBtn);
        grid.appendChild(shortcutWrapper);
    });
    if (shortcuts.length < MAX_SHORTCUTS) {
        const addButton = document.createElement("button");
        addButton.className = "shortcut-add-button";
        addButton.setAttribute("aria-label", "Add new shortcut");
        addButton.addEventListener("click", openAddModal);
        grid.appendChild(addButton);
    }
    app.appendChild(grid);
}

function openAddModal() {
    const formHtml = `
        <form id="shortcut-form">
            <div class="form-group">
                <label class="form-label" for="shortcut-title">Title</label>
                <input type="text" id="shortcut-title" class="form-input" required maxlength="50">
                <div class="form-error"></div>
            </div>
            <div class="form-group">
                <label class="form-label" for="shortcut-url">URL</label>
                <input type="url" id="shortcut-url" class="form-input" required 
                    placeholder="example.com (https:// will be added if omitted)">
                <div class="form-error"></div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary">Cancel</button>
                <button type="submit" class="btn btn-primary">Add Shortcut</button>
            </div>
        </form>
    `;
    const modal = createModal("Add Shortcut", formHtml);
    const cancelBtn = modal.querySelector(".btn-secondary");
    if (cancelBtn) {
        cancelBtn.addEventListener("click", closeModal);
    }
    const form = modal.querySelector("#shortcut-form");
    form.addEventListener("submit", handleFormSubmit);
}

async function openEditModal(shortcutId) {
    const shortcuts = (await getData(STORAGE_KEYS.SHORTCUTS)) || [];
    const shortcut = shortcuts.find((s) => s.id === shortcutId);
    if (!shortcut) return;
    const form = document.createElement("form");
    form.id = "shortcut-form";
    form.dataset.shortcutId = shortcutId;
    const titleGroup = document.createElement("div");
    titleGroup.className = "form-group";
    const titleLabel = document.createElement("label");
    titleLabel.className = "form-label";
    titleLabel.htmlFor = "shortcut-title";
    titleLabel.textContent = "Title";
    const titleInput = document.createElement("input");
    titleInput.type = "text";
    titleInput.id = "shortcut-title";
    titleInput.className = "form-input";
    titleInput.required = true;
    titleInput.maxLength = 50;
    titleInput.value = shortcut.title;
    const titleError = document.createElement("div");
    titleError.className = "form-error";
    titleGroup.append(titleLabel, titleInput, titleError);
    const urlGroup = document.createElement("div");
    urlGroup.className = "form-group";
    const urlLabel = document.createElement("label");
    urlLabel.className = "form-label";
    urlLabel.htmlFor = "shortcut-url";
    urlLabel.textContent = "URL";
    const urlInput = document.createElement("input");
    urlInput.type = "url";
    urlInput.id = "shortcut-url";
    urlInput.className = "form-input";
    urlInput.required = true;
    urlInput.value = shortcut.url;
    const urlError = document.createElement("div");
    urlError.className = "form-error";
    urlGroup.append(urlLabel, urlInput, urlError);
    const footer = document.createElement("div");
    footer.className = "modal-footer";
    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "btn btn-secondary";
    cancelBtn.textContent = "Cancel";
    const submitBtn = document.createElement("button");
    submitBtn.type = "submit";
    submitBtn.className = "btn btn-primary";
    submitBtn.textContent = "Save Changes";
    footer.append(cancelBtn, submitBtn);
    form.append(titleGroup, urlGroup, footer);
    const modal = createModal("Edit Shortcut", form.outerHTML);
    const modalCancelBtn = modal.querySelector(".btn-secondary");
    if (modalCancelBtn) {
        modalCancelBtn.addEventListener("click", closeModal);
    }
    const modalForm = modal.querySelector("#shortcut-form");
    modalForm.addEventListener("submit", handleFormSubmit);
}

async function handleFormSubmit(event) {
    event.preventDefault();
    const form = event.target;
    const title = form.querySelector("#shortcut-title").value.trim();
    let url = form.querySelector("#shortcut-url").value.trim();
    const shortcutId = form.dataset.shortcutId;
    let isValid = true;
    if (url && !url.match(/^https?:\/\//i)) {
        url = "https://" + url;
        form.querySelector("#shortcut-url").value = url;
    }
    if (!title) {
        showError(form, "shortcut-title", "Title is required");
        isValid = false;
    }
    if (!url || !isValidUrl(url)) {
        showError(form, "shortcut-url", "Please enter a valid URL (https:// will be added if omitted)");
        isValid = false;
    }
    if (!isValid) return;
    if (shortcutId) {
        await handleEditShortcut(shortcutId, title, url);
    } else {
        await handleAddShortcut(title, url);
    }
}

async function handleAddShortcut(title, url) {
    const shortcuts = (await getData(STORAGE_KEYS.SHORTCUTS)) || [];
    if (shortcuts.length >= MAX_SHORTCUTS) {
        showErrorModal(`Maximum of ${MAX_SHORTCUTS} shortcuts allowed`);
        return;
    }
    const newShortcut = {
        id: generateShortcutId(),
        title,
        url,
    };
    shortcuts.push(newShortcut);
    await chrome.storage.sync.set({ [STORAGE_KEYS.SHORTCUTS]: shortcuts });
    const updatedShortcuts = (await getData(STORAGE_KEYS.SHORTCUTS)) || [];
    renderShortcuts(updatedShortcuts);
    closeModal();
}

async function handleEditShortcut(id, title, url) {
    const shortcuts = (await getData(STORAGE_KEYS.SHORTCUTS)) || [];
    const index = shortcuts.findIndex((s) => s.id === id);
    if (index === -1) return;
    shortcuts[index] = {
        ...shortcuts[index],
        title,
        url,
    };
    await chrome.storage.sync.set({ [STORAGE_KEYS.SHORTCUTS]: shortcuts });
    const updatedShortcuts = (await getData(STORAGE_KEYS.SHORTCUTS)) || [];
    renderShortcuts(updatedShortcuts);
    closeModal();
}

async function getData(key) {
    try {
        const result = await chrome.storage.sync.get(key);
        return result[key];
    } catch {
        return null;
    }
}

async function handleDeleteShortcut(id) {
    const shortcuts = (await getData(STORAGE_KEYS.SHORTCUTS)) || [];
    const shortcut = shortcuts.find((s) => s.id === id);
    if (!shortcut) return;

    if (confirm(`Are you sure you want to delete "${shortcut.title}"?`)) {
        const filtered = shortcuts.filter((s) => s.id !== id);
        await chrome.storage.sync.set({ [STORAGE_KEYS.SHORTCUTS]: filtered });
        const updatedShortcuts = (await getData(STORAGE_KEYS.SHORTCUTS)) || [];
        renderShortcuts(updatedShortcuts);
    }
}

function showError(form, inputId, message) {
    const inputs = form.querySelectorAll(".form-input");
    inputs.forEach((input) => {
        input.classList.remove("error");
        if (input.nextElementSibling) {
            input.nextElementSibling.textContent = "";
        }
    });
    const input = form.querySelector(`#${inputId}`);
    const error = input.nextElementSibling;
    error.textContent = message;
    input.classList.add("error");
}

async function initialize() {
    try {
        if (typeof chrome === "undefined" || !chrome.storage) {
            throw new Error("Not running in extension context");
        }
        await initializeStorage();
        const settings = (await getData(STORAGE_KEYS.SETTINGS)) || DEFAULT_SETTINGS;
        const shortcuts = (await getData(STORAGE_KEYS.SHORTCUTS)) || DEFAULT_SHORTCUTS;
        document.documentElement.style.setProperty("--grid-columns", settings.columns);
        renderShortcuts(shortcuts);
    } catch (error) {
        console.error("Initialization failed:", error);
        document.getElementById("app").innerHTML = `
            <div style="text-align: center; padding: 2rem;">
                <p>Failed to initialize NewTab++. Please try reloading.</p>
                ${
                    error.message === "Not running in extension context"
                        ? "<p>This page must be loaded as a Chrome extension.</p>"
                        : ""
                }
            </div>
        `;
    }
}

document.addEventListener("DOMContentLoaded", initialize);
