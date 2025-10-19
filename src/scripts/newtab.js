const MAX_SLOTS = 20;
const DEFAULT_VISIBLE_SLOTS = 10;

const el = {
    shortcuts: document.getElementById("shortcuts"),
    openSettings: document.getElementById("open-settings"),
    toggleShortcuts: document.getElementById("toggle-shortcuts"),
    modal: document.getElementById("settings-modal"),
    slots: document.getElementById("slots"),
    save: document.getElementById("save"),
    cancel: document.getElementById("cancel"),
    reset: document.getElementById("reset"),
};

function getFavicon(url) {
    try {
        const host = new URL(url).hostname;
        return `https://www.google.com/s2/favicons?sz=64&domain=${host}`;
    } catch {
        return "icons/default32.png";
    }
}

function parseInput(value) {
    if (!value) return null;
    const [urlPart, titlePart] = value.split("|").map((v) => v.trim());
    try {
        const url = new URL(urlPart);
        if (!url.protocol.startsWith("http")) return null;
        return { url: urlPart, title: titlePart || "" };
    } catch {
        return null;
    }
}

function loadShortcuts() {
    return new Promise((resolve) => {
        chrome.storage.sync.get(
            {
                shortcuts: Array(MAX_SLOTS).fill(null),
                showAllShortcuts: false,
            },
            (res) => {
                resolve({
                    shortcuts: res.shortcuts,
                    showAllShortcuts: res.showAllShortcuts,
                });
            }
        );
    });
}

function saveShortcuts(shortcuts) {
    return new Promise((resolve) => {
        chrome.storage.sync.set({ shortcuts }, resolve);
    });
}

function saveShowAllShortcuts(showAllShortcuts) {
    return new Promise((resolve) => {
        chrome.storage.sync.set({ showAllShortcuts }, resolve);
    });
}

async function render() {
    const { shortcuts, showAllShortcuts } = await loadShortcuts();
    el.shortcuts.innerHTML = "";
    el.shortcuts.className = `grid ${showAllShortcuts ? "grid-20" : "grid-10"}`;
    el.toggleShortcuts.textContent = showAllShortcuts ? "Show Less" : "Show More";
    const visibleSlots = showAllShortcuts ? MAX_SLOTS : DEFAULT_VISIBLE_SLOTS;
    shortcuts.forEach((shortcut, idx) => {
        const tile = document.createElement("a");
        tile.className = "tile" + (shortcut ? "" : " empty");
        tile.href = shortcut ? shortcut.url : "#";
        tile.target = "_blank";
        tile.rel = "noopener";
        const img = document.createElement("img");
        img.src = shortcut ? getFavicon(shortcut.url) : "icons/plus.svg";
        img.alt = shortcut ? shortcut.title || shortcut.url : "add shortcut";
        const title = document.createElement("div");
        title.className = "title";
        title.textContent = shortcut ? shortcut.title || shortcut.url : "Add shortcut";
        tile.append(img, title);
        if (!shortcut) {
            tile.addEventListener("click", (e) => {
                e.preventDefault();
                openSettings();
                setTimeout(() => focusSlot(idx), 100);
            });
        }
        el.shortcuts.appendChild(tile);
    });
}

async function openSettings() {
    el.modal.classList.remove("hidden");
    const shortcuts = await loadShortcuts();
    el.slots.innerHTML = "";
    shortcuts.forEach((s, i) => {
        const slot = document.createElement("div");
        slot.className = "slot";
        const label = document.createElement("div");
        label.textContent = `#${i + 1}`;
        label.style.width = "36px";
        const input = document.createElement("input");
        input.type = "text";
        input.placeholder = "https://example.com | Optional Title";
        input.value = s ? `${s.url} | ${s.title || ""}` : "";
        input.dataset.idx = i;
        const remove = document.createElement("button");
        remove.textContent = "Remove";
        remove.addEventListener("click", () => (input.value = ""));
        slot.append(label, input, remove);
        el.slots.appendChild(slot);
    });
}

function focusSlot(index) {
    const input = el.slots.querySelector(`input[data-idx='${index}']`);
    if (input) input.focus();
}

function closeSettings() {
    el.modal.classList.add("hidden");
}

async function handleSave() {
    const inputs = [...el.slots.querySelectorAll("input")];
    const shortcuts = inputs.map((i) => parseInput(i.value));
    await saveShortcuts(shortcuts);
    await render();
    closeSettings();
}

async function handleReset() {
    if (confirm("Reset all shortcuts?")) {
        await saveShortcuts(Array(MAX_SLOTS).fill(null));
        await render();
        closeSettings();
    }
}

el.openSettings.addEventListener("click", openSettings);
el.save.addEventListener("click", handleSave);
el.cancel.addEventListener("click", closeSettings);
el.reset.addEventListener("click", handleReset);
el.modal.addEventListener("click", (e) => {
    if (e.target === el.modal) closeSettings();
});

window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !el.modal.classList.contains("hidden")) closeSettings();
});

render();
