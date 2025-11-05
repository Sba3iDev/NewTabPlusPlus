const MAX_SHORTCUTS = 20;

async function addShortcutToStorage(url, title) {
    if (!url || (!url.startsWith("http://") && !url.startsWith("https://"))) {
        return { success: false, message: "Invalid URL. Must start with http:// or https://." };
    }
    try {
        const { shortcuts = [] } = await chrome.storage.sync.get("shortcuts");
        if (shortcuts.length >= MAX_SHORTCUTS) {
            return { success: false, message: `Maximum of ${MAX_SHORTCUTS} shortcuts reached.` };
        }
        if (shortcuts.some((s) => s.url === url)) {
            return { success: false, message: "Shortcut for this URL already exists." };
        }
        const newShortcut = {
            id: crypto.randomUUID(),
            title: title || url,
            url: url,
        };
        const updatedShortcuts = [...shortcuts, newShortcut];
        await chrome.storage.sync.set({ shortcuts: updatedShortcuts });
        return { success: true, message: "Shortcut added successfully." };
    } catch (error) {
        console.error("Error adding shortcut:", error);
        return { success: false, message: "Failed to add shortcut due to a storage error." };
    }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "fetchSuggestions") {
        const query = request.query;
        const url = `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(query)}`;
        fetch(url)
            .then((response) => response.json())
            .then((data) => {
                sendResponse({ success: true, suggestions: data[1] || [] });
            })
            .catch((error) => {
                console.error("Error fetching suggestions:", error);
                sendResponse({ success: false, suggestions: [] });
            });
        return true;
    } else if (request.action === "addCurrentTab") {
        (async () => {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab) {
                const result = await addShortcutToStorage(tab.url, tab.title);
                sendResponse(result);
            } else {
                sendResponse({ success: false, message: "Could not find active tab." });
            }
        })();
        return true;
    }
});

chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "addToShortcuts",
        title: "Add to NewTab++ Shortcuts",
        contexts: ["page", "link"],
    });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === "addToShortcuts") {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (activeTab) {
            const url = info.linkUrl || activeTab.url;
            const title = activeTab.title;
            const result = await addShortcutToStorage(url, title);
            if (!result.success) {
                console.warn(`Failed to add shortcut: ${result.message}`);
            }
        }
    }
});
