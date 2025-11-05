document.addEventListener("DOMContentLoaded", () => {
    const addButton = document.getElementById("add-shortcut-btn");
    const statusMessage = document.getElementById("status-message");
    if (!addButton || !statusMessage) {
        console.error("Required popup elements not found");
        return;
    }
    addButton.addEventListener("click", () => {
        addButton.disabled = true;
        addButton.textContent = "Adding...";
        chrome.runtime.sendMessage({ action: "addCurrentTab" }, (response) => {
            if (chrome.runtime.lastError) {
                console.error(chrome.runtime.lastError);
                showStatus("An unexpected error occurred.", "error");
                resetButton();
                return;
            }
            if (!response) {
                showStatus("No response from background script.", "error");
                resetButton();
                return;
            }
            if (response.success) {
                showStatus("Shortcut added!", "success");
                setTimeout(() => {
                    window.close();
                }, 1500);
            } else {
                showStatus(response.message || "Failed to add shortcut.", "error");
                resetButton();
            }
        });
    });
    function showStatus(message, type) {
        statusMessage.textContent = message;
        statusMessage.className = type;
        statusMessage.style.display = "block";
    }
    function resetButton() {
        addButton.disabled = false;
        addButton.textContent = "+ Add Shortcut";
    }
});
