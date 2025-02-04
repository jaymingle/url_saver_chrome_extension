// popup.js
document.addEventListener('DOMContentLoaded', function() {
    // Load saved URLs when popup opens
    loadSavedUrls();

    // Add click handler for save button
    document.getElementById('saveButton').addEventListener('click', saveCurrentUrl);
});

function saveCurrentUrl() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        const currentUrl = tabs[0].url;
        const description = document.getElementById('description').value;
        const timestamp = new Date().toLocaleString();

        // Get existing URLs from storage
        chrome.storage.local.get(['savedUrls'], function(result) {
            const savedUrls = result.savedUrls || [];

            // Add new URL to the beginning of the array
            savedUrls.unshift({
                url: currentUrl,
                description: description,
                timestamp: timestamp
            });

            // Save updated URLs to storage
            chrome.storage.local.set({
                savedUrls: savedUrls
            }, function() {
                // Clear description field
                document.getElementById('description').value = '';

                // Reload the saved URLs list
                loadSavedUrls();
            });
        });
    });
}

function loadSavedUrls() {
    const container = document.getElementById('savedUrls');
    container.innerHTML = '';

    chrome.storage.local.get(['savedUrls'], function(result) {
        const savedUrls = result.savedUrls || [];

        savedUrls.forEach(function(item, index) {
            const div = document.createElement('div');
            div.className = 'url-item';
            div.innerHTML = `
        <strong>${item.description}</strong>
        <br>
        <a href="${item.url}" target="_blank">${item.url}</a>
        <br>
        <small>Saved: ${item.timestamp}</small>
        <span class="delete-btn" data-index="${index}">🗑️</span>
      `;
            container.appendChild(div);
        });

        // Add delete handlers
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const index = parseInt(this.dataset.index);
                deleteUrl(index);
            });
        });
    });
}

function deleteUrl(index) {
    chrome.storage.local.get(['savedUrls'], function(result) {
        const savedUrls = result.savedUrls || [];
        savedUrls.splice(index, 1);

        chrome.storage.local.set({
            savedUrls: savedUrls
        }, function() {
            loadSavedUrls();
        });
    });
}