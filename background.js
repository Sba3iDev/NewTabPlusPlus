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
    }
});
