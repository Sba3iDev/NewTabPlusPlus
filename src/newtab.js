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
        id: generateShortcutId(),
        title: "Google",
        url: "https://google.com",
    },
    {
        id: generateShortcutId(),
        title: "YouTube",
        url: "https://youtube.com",
    },
];
const STORAGE_LIMITS = {
    QUOTA_BYTES: 102400,
    QUOTA_BYTES_PER_ITEM: 8192,
    LOCAL_STORAGE_KEY: "newtab_data",
};
let draggedElement = null;

function getStorageSize(data) {
    return new TextEncoder().encode(JSON.stringify(data)).length;
}

async function safeSyncStorage(key, value) {
    const payload = { [key]: value };
    const size = getStorageSize(payload);
    if (size > STORAGE_LIMITS.QUOTA_BYTES_PER_ITEM) {
        showErrorModal("Data size exceeds Chrome Sync storage limits. Falling back to local storage.");
        localStorage.setItem(STORAGE_LIMITS.LOCAL_STORAGE_KEY, JSON.stringify(payload));
        return;
    }
    try {
        await chrome.storage.sync.set(payload);
    } catch (error) {
        if (error.message?.includes("QUOTA")) {
            showErrorModal("Chrome Sync storage quota exceeded. Falling back to local storage.");
            localStorage.setItem(STORAGE_LIMITS.LOCAL_STORAGE_KEY, JSON.stringify(payload));
        } else {
            throw error;
        }
    }
}

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

function getInitialCharacter(text) {
    if (typeof text !== "string" || !text.trim()) {
        return "?";
    }
    return text.trim()[0].toUpperCase();
}

function createFallbackIconSvg(char) {
    return `data:image/svg+xml,${encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90" text-anchor="middle" x="50">${char}</text></svg>`
    )}`;
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
    const firstInput = container.querySelector("input, button:not(.modal-close)");
    if (firstInput) {
        firstInput.focus();
    }
    modalRoot.cleanup = () => {
        document.removeEventListener("keydown", handleEscape);
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
    modalRoot.innerHTML = "";
}

function showErrorModal(message) {
    const modalContent = `
        <div class="error-modal">
            <p class="error-message">${message}</p>
            <div class="modal-footer">
                <button type="button" class="btn btn-primary" id="ok-btn">OK</button>
            </div>
        </div>
    `;
    const modal = createModal("Error", modalContent);
    const okBtn = modal.querySelector("#ok-btn");
    okBtn.addEventListener("click", closeModal);
    okBtn.focus();
}

async function migrateStorage(currentVersion) {
    const { version } = (await chrome.storage.sync.get("version")) || { version: "0.0.0" };
    if (version !== currentVersion) {
        await chrome.storage.sync.set({ version: currentVersion });
    }
}

async function initializeStorage() {
    let data;
    try {
        data = await chrome.storage.sync.get([STORAGE_KEYS.SETTINGS, STORAGE_KEYS.SHORTCUTS]);
    } catch (error) {
        const localData = localStorage.getItem(STORAGE_LIMITS.LOCAL_STORAGE_KEY);
        data = localData ? JSON.parse(localData) : {};
    }
    const updates = {};
    if (!data[STORAGE_KEYS.SETTINGS]) {
        updates[STORAGE_KEYS.SETTINGS] = DEFAULT_SETTINGS;
    }
    if (!data[STORAGE_KEYS.SHORTCUTS]) {
        updates[STORAGE_KEYS.SHORTCUTS] = DEFAULT_SHORTCUTS;
    }
    if (Object.keys(updates).length > 0) {
        const size = getStorageSize(updates);
        if (size > STORAGE_LIMITS.QUOTA_BYTES) {
            showErrorModal("Initial data exceeds Chrome Sync storage limits. Using local storage.");
            localStorage.setItem(STORAGE_LIMITS.LOCAL_STORAGE_KEY, JSON.stringify(updates));
            return;
        }
        try {
            await chrome.storage.sync.set(updates);
        } catch (error) {
            if (error.message?.includes("QUOTA")) {
                showErrorModal("Chrome Sync storage quota exceeded. Using local storage.");
                localStorage.setItem(STORAGE_LIMITS.LOCAL_STORAGE_KEY, JSON.stringify(updates));
            } else {
                throw error;
            }
        }
    }
}

function renderHeader() {
    const header = document.querySelector("header");
    header.innerHTML = `
        <h1 class="visually-hidden">NewTab++</h1>
        <div class="header-controls"></div>
    `;
}

function renderShortcuts(shortcuts) {
    const app = document.getElementById("app");
    app.innerHTML = "";
    const grid = document.createElement("div");
    grid.className = "shortcuts-grid";
    shortcuts.forEach((shortcut) => {
        const shortcutWrapper = document.createElement("a");
        shortcutWrapper.className = "shortcut";
        shortcutWrapper.href = shortcut.url;
        shortcutWrapper.target = "_blank";
        shortcutWrapper.rel = "noopener noreferrer";
        shortcutWrapper.draggable = true;
        shortcutWrapper.setAttribute("data-shortcut-id", shortcut.id);
        shortcutWrapper.addEventListener("dragstart", (e) => {
            draggedElement = e.currentTarget;
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/plain", shortcut.id);
            e.currentTarget.classList.add("dragging");
        });
        shortcutWrapper.addEventListener("dragend", (e) => {
            draggedElement = null;
            e.currentTarget.classList.remove("dragging");
        });
        shortcutWrapper.addEventListener("dragover", (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            if (draggedElement && e.currentTarget !== draggedElement) {
                e.currentTarget.classList.add("drag-over");
            }
        });
        shortcutWrapper.addEventListener("dragleave", (e) => {
            e.currentTarget.classList.remove("drag-over");
        });
        shortcutWrapper.addEventListener("drop", async (e) => {
            e.preventDefault();
            e.currentTarget.classList.remove("drag-over");
            const draggedId = e.dataTransfer.getData("text/plain");
            const targetId = e.currentTarget.getAttribute("data-shortcut-id");
            if (draggedId && targetId && draggedId !== targetId) {
                await handleShortcutReorder(draggedId, targetId);
            }
        });
        const card = document.createElement("div");
        card.className = "shortcut-card";
        card.setAttribute("data-id", shortcut.id);
        const iconContainer = document.createElement("div");
        iconContainer.className = "shortcut-icon";
        const img = document.createElement("img");
        img.alt = `${shortcut.title} favicon`;
        img.src = getFaviconUrl(shortcut.url);
        img.addEventListener("error", () => {
            const initialChar = getInitialCharacter(shortcut.title);
            img.src = createFallbackIconSvg(initialChar);
        });
        iconContainer.appendChild(img);
        card.appendChild(iconContainer);
        const title = document.createElement("div");
        title.className = "shortcut-title";
        title.textContent = shortcut.title;
        const dotsMenuIcon = document.createElement("img");
        dotsMenuIcon.className = "shortcut-dots-menu-icon";
        dotsMenuIcon.src = "icons/threeDotsIconLight.svg";
        chrome.storage.sync.get(STORAGE_KEYS.SETTINGS, (result) => {
            if (chrome.runtime.lastError) {
                showErrorModal("Failed to fetch settings for theme:");
                const useDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
                dotsMenuIcon.src = useDark ? "icons/threeDotsIconDark.svg" : "icons/threeDotsIconLight.svg";
                return;
            }
            const settings = (result && result[STORAGE_KEYS.SETTINGS]) || DEFAULT_SETTINGS;
            const theme = settings.theme || DEFAULT_SETTINGS.theme;
            let useDark;
            if (theme === "dark") {
                useDark = true;
            } else if (theme === "light") {
                useDark = false;
            } else {
                useDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
                if (window.matchMedia) {
                    const mq = window.matchMedia("(prefers-color-scheme: dark)");
                    const onChange = (e) => {
                        dotsMenuIcon.src = e.matches ? "icons/threeDotsIconDark.svg" : "icons/threeDotsIconLight.svg";
                    };
                    mq.addEventListener("change", onChange);
                }
            }
            dotsMenuIcon.src = useDark ? "icons/threeDotsIconDark.svg" : "icons/threeDotsIconLight.svg";
        });
        dotsMenuIcon.addEventListener("click", (e) => {
            e.stopPropagation();
            e.preventDefault();
            dotsMenuOverlay.classList.add("show");
            dotsMenu.classList.add("show");
        });
        const dotsMenuOverlay = document.createElement("div");
        dotsMenuOverlay.className = "shortcut-dots-menu-overlay";
        const dotsMenu = document.createElement("div");
        dotsMenu.className = "shortcut-dots-menu";
        dotsMenuOverlay.addEventListener("click", (e) => {
            if (e.target === dotsMenuOverlay) {
                e.stopPropagation();
                e.preventDefault();
                dotsMenuOverlay.classList.remove("show");
                dotsMenu.classList.remove("show");
            }
        });
        const editBtn = document.createElement("button");
        editBtn.className = "shortcut-edit";
        editBtn.setAttribute("aria-label", `Edit ${shortcut.title}`);
        editBtn.textContent = "Edit shortcut";
        editBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            e.preventDefault();
            dotsMenuOverlay.classList.remove("show");
            dotsMenu.classList.remove("show");
            openEditModal(shortcut.id);
        });
        const deleteBtn = document.createElement("button");
        deleteBtn.className = "shortcut-delete";
        deleteBtn.setAttribute("aria-label", `Delete ${shortcut.title}`);
        deleteBtn.textContent = "Remove";
        deleteBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            e.preventDefault();
            dotsMenuOverlay.classList.remove("show");
            dotsMenu.classList.remove("show");
            handleDeleteShortcut(shortcut.id);
        });
        dotsMenu.appendChild(editBtn);
        dotsMenu.appendChild(deleteBtn);
        shortcutWrapper.appendChild(card);
        shortcutWrapper.appendChild(title);
        shortcutWrapper.appendChild(dotsMenuIcon);
        shortcutWrapper.appendChild(dotsMenu);
        shortcutWrapper.appendChild(dotsMenuOverlay);
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

function renderFooter() {
    const footer = document.querySelector("footer");
    footer.innerHTML = `
        <p>&copy; ${new Date().getFullYear()} NewTab++</p>
    `;
}

function openAddModal() {
    const modalContent = `
        <form id="shortcut-form">
            <div class="form-group">
                <label class="form-label" for="shortcut-title">Title</label>
                <input type="text" id="shortcut-title" class="form-input" required maxlength="50">
                <div class="form-error"></div>
            </div>
            <div class="form-group">
                <label class="form-label" for="shortcut-url">URL</label>
                <input type="url" id="shortcut-url" class="form-input" required placeholder="https://">
                <div class="form-error"></div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary">Cancel</button>
                <button type="submit" class="btn btn-primary">Add Shortcut</button>
            </div>
        </form>
    `;
    const modal = createModal("Add Shortcut", modalContent);
    const cancelBtn = modal.querySelector(".btn-secondary");
    if (cancelBtn) {
        cancelBtn.addEventListener("click", closeModal);
    }
    const form = modal.querySelector("#shortcut-form");
    form.addEventListener("submit", handleFormSubmit);
    form.querySelectorAll(".form-input").forEach((input) => {
        input.addEventListener("input", () => {
            input.classList.remove("error");
            if (input.nextElementSibling) {
                input.nextElementSibling.textContent = "";
            }
        });
    });
}

function openEditModal(shortcutId) {
    chrome.storage.sync.get(STORAGE_KEYS.SHORTCUTS, ({ shortcuts }) => {
        const shortcut = shortcuts.find((s) => s.id === shortcutId);
        if (!shortcut) return;
        const modalContent = `
            <form id="shortcut-form" data-shortcut-id="${shortcutId}">
                <div class="form-group">
                    <label class="form-label" for="shortcut-title">Title</label>
                    <input type="text" id="shortcut-title" class="form-input" required maxlength="50" value="${shortcut.title}">
                    <div class="form-error"></div>
                </div>
                <div class="form-group">
                    <label class="form-label" for="shortcut-url">URL</label>
                    <input type="url" id="shortcut-url" class="form-input" required value="${shortcut.url}">
                    <div class="form-error"></div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary">Cancel</button>
                    <button type="submit" class="btn btn-primary">Save Changes</button>
                </div>
            </form>
        `;
        const modal = createModal("Edit Shortcut", modalContent);
        const cancelBtn = modal.querySelector(".btn-secondary");
        if (cancelBtn) {
            cancelBtn.addEventListener("click", closeModal);
        }
        const form = modal.querySelector("#shortcut-form");
        form.addEventListener("submit", handleFormSubmit);
    });
}

async function handleFormSubmit(event) {
    event.preventDefault();
    const form = event.target;
    const title = form.querySelector("#shortcut-title").value.trim();
    const url = form.querySelector("#shortcut-url").value.trim();
    const shortcutId = form.dataset.shortcutId;
    let isValid = true;
    if (!title) {
        showError(form, "shortcut-title", "Title is required");
        isValid = false;
    }
    if (!url || !isValidUrl(url)) {
        showError(form, "shortcut-url", "Please enter a valid URL starting with http:// or https://");
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
    let shortcuts = [];
    try {
        const result = await chrome.storage.sync.get(STORAGE_KEYS.SHORTCUTS);
        shortcuts = result[STORAGE_KEYS.SHORTCUTS] || [];
    } catch (error) {
        const localData = localStorage.getItem(STORAGE_LIMITS.LOCAL_STORAGE_KEY);
        if (localData) {
            const parsed = JSON.parse(localData);
            shortcuts = parsed[STORAGE_KEYS.SHORTCUTS] || [];
        }
    }
    if (shortcuts.length >= MAX_SHORTCUTS) {
        showErrorModal(`Maximum of ${MAX_SHORTCUTS} shortcuts allowed`);
        return;
    }
    shortcuts.push({
        id: generateShortcutId(),
        title,
        url,
    });
    await safeSyncStorage(STORAGE_KEYS.SHORTCUTS, shortcuts);
    await refreshShortcuts();
    closeModal();
}

async function handleEditShortcut(id, title, url) {
    let shortcuts = [];
    try {
        const result = await chrome.storage.sync.get(STORAGE_KEYS.SHORTCUTS);
        shortcuts = result[STORAGE_KEYS.SHORTCUTS] || [];
    } catch (error) {
        const localData = localStorage.getItem(STORAGE_LIMITS.LOCAL_STORAGE_KEY);
        if (localData) {
            const parsed = JSON.parse(localData);
            shortcuts = parsed[STORAGE_KEYS.SHORTCUTS] || [];
        }
    }
    const index = shortcuts.findIndex((s) => s.id === id);
    if (index === -1) return;
    shortcuts[index] = {
        ...shortcuts[index],
        title,
        url,
    };
    await safeSyncStorage(STORAGE_KEYS.SHORTCUTS, shortcuts);
    await refreshShortcuts();
    closeModal();
}

function showConfirmModal(message, onConfirm) {
    const modalContent = `
        <div class="confirm-modal">
            <p class="confirm-message">${message}</p>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" id="cancel-btn">Cancel</button>
                <button type="button" class="btn btn-danger" id="delete-btn">Delete</button>
            </div>
        </div>
    `;
    const modal = createModal("Confirm Action", modalContent);
    const cancelBtn = modal.querySelector("#cancel-btn");
    const deleteBtn = modal.querySelector("#delete-btn");
    cancelBtn.addEventListener("click", closeModal);
    deleteBtn.addEventListener("click", async () => {
        await onConfirm();
        closeModal();
    });
    cancelBtn.focus();
    const handleKeyboard = (e) => {
        if (e.key === "Enter" && document.activeElement === deleteBtn) {
            e.preventDefault();
            deleteBtn.click();
        }
    };
    modal.addEventListener("keydown", handleKeyboard);
}

async function handleDeleteShortcut(id) {
    const { shortcuts = [] } = await chrome.storage.sync.get(STORAGE_KEYS.SHORTCUTS);
    const shortcut = shortcuts.find((s) => s.id === id);
    if (!shortcut) return;
    showConfirmModal(`Are you sure you want to delete "${shortcut.title}"?`, async () => {
        const { shortcuts = [] } = await chrome.storage.sync.get(STORAGE_KEYS.SHORTCUTS);
        const filtered = shortcuts.filter((s) => s.id !== id);
        await chrome.storage.sync.set({ [STORAGE_KEYS.SHORTCUTS]: filtered });
        await refreshShortcuts();
    });
}

async function handleShortcutReorder(draggedId, targetId) {
    try {
        if (draggedId === targetId) return;
        const { shortcuts = [] } = await chrome.storage.sync.get(STORAGE_KEYS.SHORTCUTS);
        const draggedIndex = shortcuts.findIndex((s) => s.id === draggedId);
        const targetIndex = shortcuts.findIndex((s) => s.id === targetId);
        if (draggedIndex === -1 || targetIndex === -1) return;
        const [draggedShortcut] = shortcuts.splice(draggedIndex, 1);
        shortcuts.splice(targetIndex, 0, draggedShortcut);
        await safeSyncStorage(STORAGE_KEYS.SHORTCUTS, shortcuts);
        await refreshShortcuts();
    } catch (error) {
        showErrorModal("Failed to reorder shortcuts. Please try again.");
    }
}

function clearFormErrors(form) {
    const inputs = form.querySelectorAll(".form-input");
    inputs.forEach((input) => {
        input.classList.remove("error");
        if (input.nextElementSibling) {
            input.nextElementSibling.textContent = "";
        }
    });
}

function showError(form, inputId, message) {
    clearFormErrors(form);
    const input = form.querySelector(`#${inputId}`);
    const error = input.nextElementSibling;
    error.textContent = message;
    input.classList.add("error");
}

async function refreshShortcuts() {
    const { shortcuts = [] } = await chrome.storage.sync.get(STORAGE_KEYS.SHORTCUTS);
    renderShortcuts(shortcuts);
}

async function initialize() {
    try {
        if (typeof chrome === "undefined" || !chrome.storage) {
            throw new Error("Not running in extension context");
        }
        await migrateStorage(CURRENT_VERSION);
        await initializeStorage();
        const data = await chrome.storage.sync.get([STORAGE_KEYS.SETTINGS, STORAGE_KEYS.SHORTCUTS]);
        document.documentElement.style.setProperty("--grid-columns", data[STORAGE_KEYS.SETTINGS].columns);
        renderHeader();
        renderShortcuts(data[STORAGE_KEYS.SHORTCUTS]);
        renderFooter();
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
