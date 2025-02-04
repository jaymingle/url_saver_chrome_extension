document.addEventListener('DOMContentLoaded', function() {
    loadSavedUrls();
    document.getElementById('saveButton').addEventListener('click', saveCurrentUrl);
    updateStorageInfo();
});

function saveCurrentUrl() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        const currentUrl = tabs[0].url;
        const description = document.getElementById('description').value.trim();

        if (!description) {
            alert('Please enter a description');
            return;
        }

        const timestamp = new Date().toLocaleString();

        chrome.storage.local.get(['savedUrls'], function(result) {
            const savedUrls = result.savedUrls || [];

            savedUrls.unshift({
                url: currentUrl,
                description: description,
                timestamp: timestamp
            });

            chrome.storage.local.set({
                savedUrls: savedUrls
            }, function() {
                document.getElementById('description').value = '';
                loadSavedUrls();
                updateStorageInfo();
            });
        });
    });
}

function loadSavedUrls() {
    const container = document.getElementById('savedUrls');
    container.innerHTML = '';

    chrome.storage.local.get(['savedUrls'], function(result) {
        const savedUrls = result.savedUrls || [];

        if (savedUrls.length === 0) {
            container.innerHTML = '<div style="text-align: center; color: #666;">No saved URLs yet</div>';
            return;
        }

        savedUrls.forEach(function(item, index) {
            const div = document.createElement('div');
            div.className = 'url-item';
            div.innerHTML = `
        <div class="url-description">${escapeHtml(item.description)}</div>
        <a href="${item.url}" target="_blank">${item.url}</a>
        <div class="url-timestamp">Saved: ${item.timestamp}</div>
        <button class="delete-btn" title="Delete">×</button>
      `;

            div.querySelector('.delete-btn').addEventListener('click', () => deleteUrl(index));
            container.appendChild(div);
        });
    });
}

function deleteUrl(index) {
    if (confirm('Are you sure you want to delete this URL?')) {
        chrome.storage.local.get(['savedUrls'], function(result) {
            const savedUrls = result.savedUrls || [];
            savedUrls.splice(index, 1);

            chrome.storage.local.set({
                savedUrls: savedUrls
            }, function() {
                loadSavedUrls();
                updateStorageInfo();
            });
        });
    }
}

function updateStorageInfo() {
    chrome.storage.local.getBytesInUse(null, function(bytes) {
        const usage = (bytes / 1024 / 1024).toFixed(2);
        document.getElementById('storageUsage').textContent =
            `Storage used: ${usage}MB of 5MB`;
    });
}

function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}