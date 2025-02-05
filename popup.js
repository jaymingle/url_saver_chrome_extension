// Initialize event listeners
document.addEventListener('DOMContentLoaded', function() {
    loadSavedUrls();
    document.getElementById('saveButton').addEventListener('click', saveCurrentUrl);
    document.getElementById('exportButton').addEventListener('click', exportToCSV);
    updateStorageInfo();
});


// Function to create edit mode UI
function createEditMode(div, item, index) {
    const descriptionDiv = div.querySelector('.url-description');
    const originalDescription = item.description;

    // Create edit container
    const editContainer = document.createElement('div');
    editContainer.className = 'edit-container';
    editContainer.innerHTML = `
    <textarea class="edit-textarea">${originalDescription}</textarea>
    <div class="edit-buttons">
      <button class="save-edit-btn">Save</button>
      <button class="cancel-edit-btn">Cancel</button>
    </div>
  `;

    // Insert edit container after description
    descriptionDiv.parentNode.insertBefore(editContainer, descriptionDiv.nextSibling);

    // Hide description
    descriptionDiv.style.display = 'none';

    // Focus textarea
    const textarea = editContainer.querySelector('.edit-textarea');
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);

    // Save button handler
    editContainer.querySelector('.save-edit-btn').addEventListener('click', async () => {
        const newDescription = textarea.value.trim();
        if (!newDescription) {
            showNotification('Description cannot be empty', 'error');
            return;
        }
        await saveEdit(index, newDescription);
        exitEditMode(div, descriptionDiv, editContainer, newDescription);
    });

    // Cancel button handler
    editContainer.querySelector('.cancel-edit-btn').addEventListener('click', () => {
        exitEditMode(div, descriptionDiv, editContainer, originalDescription);
    });

    // Handle Escape key to cancel and Enter+Ctrl to save
    textarea.addEventListener('keydown', async (e) => {
        if (e.key === 'Escape') {
            exitEditMode(div, descriptionDiv, editContainer, originalDescription);
        } else if (e.key === 'Enter' && e.ctrlKey) {
            const newDescription = textarea.value.trim();
            if (!newDescription) {
                showNotification('Description cannot be empty', 'error');
                return;
            }
            await saveEdit(index, newDescription);
            exitEditMode(div, descriptionDiv, editContainer, newDescription);
        }
    });
}

// Function to exit edit mode
function exitEditMode(div, descriptionDiv, editContainer, description) {
    descriptionDiv.textContent = description;
    descriptionDiv.style.display = 'block';
    editContainer.remove();
}

// Function to save edited description
async function saveEdit(index, newDescription) {
    try {
        const result = await chrome.storage.local.get(['savedUrls']);
        const savedUrls = result.savedUrls || [];

        if (index >= 0 && index < savedUrls.length) {
            savedUrls[index].description = newDescription;
            await chrome.storage.local.set({ savedUrls });
            showNotification('Description updated successfully!', 'success');
            await loadSavedUrls();
            updateStorageInfo();
        }
    } catch (error) {
        showNotification('Error saving edit: ' + error.message, 'error');
    }
}

// Modify the loadSavedUrls function to include edit button
async function loadSavedUrls() {
    try {
        const container = document.getElementById('savedUrls');
        const result = await chrome.storage.local.get(['savedUrls']);
        const savedUrls = result.savedUrls || [];

        if (savedUrls.length === 0) {
            container.innerHTML = '<div class="no-urls">No saved URLs yet</div>';
            return;
        }

        container.innerHTML = '';
        savedUrls.forEach((item, index) => {
            const div = document.createElement('div');
            div.className = 'url-item';
            div.innerHTML = `
        <div class="url-description">${escapeHtml(item.description)}</div>
        <a href="${item.url}" class="url-link" target="_blank">${item.url}</a>
        <div class="url-timestamp">Saved: ${item.timestamp}</div>
        <button class="edit-btn" title="Edit Description">✎</button>
        <button class="delete-btn" title="Delete">×</button>
      `;

            // Add event listeners
            div.querySelector('.delete-btn').addEventListener('click', () => deleteUrl(index));
            div.querySelector('.edit-btn').addEventListener('click', () => {
                // Remove any existing edit modes first
                document.querySelectorAll('.edit-container').forEach(container => {
                    const urlItem = container.closest('.url-item');
                    const desc = urlItem.querySelector('.url-description');
                    desc.style.display = 'block';
                    container.remove();
                });
                // Enter edit mode for this item
                createEditMode(div, item, index);
            });

            container.appendChild(div);
        });
    } catch (error) {
        showNotification('Error loading URLs: ' + error.message, 'error');
    }
}

// Storage Full Dialog
async function showStorageFullDialog() {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
      <div class="modal-content">
        <h3 style="margin-top: 0;">Storage Almost Full!</h3>
        <p>Your storage is getting full. Would you like to:</p>
        <div class="modal-buttons">
          <button id="exportAndClear" class="primary-button">Export & Clear All</button>
          <button id="deleteOldest" class="secondary-button">Delete Oldest Entries</button>
          <button id="cancelAction" class="text-button">Cancel</button>
        </div>
      </div>
    `;

        document.body.appendChild(modal);

        // Handle Export & Clear All
        modal.querySelector('#exportAndClear').onclick = async () => {
            await exportToCSV();
            await clearAllUrls();
            modal.remove();
            resolve(true);
        };

        // Handle Delete Oldest
        modal.querySelector('#deleteOldest').onclick = async () => {
            await deleteOldestEntries(10); // Delete oldest 10 entries
            modal.remove();
            resolve(true);
        };

        // Handle Cancel
        modal.querySelector('#cancelAction').onclick = () => {
            modal.remove();
            resolve(false);
        };
    });
}

// Storage Management Functions
async function deleteOldestEntries(count) {
    try {
        const result = await chrome.storage.local.get(['savedUrls']);
        let savedUrls = result.savedUrls || [];

        if (savedUrls.length <= count) {
            savedUrls = [];
        } else {
            savedUrls = savedUrls.slice(0, -count);
        }

        await chrome.storage.local.set({ savedUrls });
        showNotification(`Deleted ${count} oldest entries`, 'info');
        loadSavedUrls();
        updateStorageInfo();
    } catch (error) {
        showNotification('Error deleting entries: ' + error.message, 'error');
    }
}

async function clearAllUrls() {
    try {
        await chrome.storage.local.set({ savedUrls: [] });
        showNotification('All URLs cleared', 'info');
        loadSavedUrls();
        updateStorageInfo();
    } catch (error) {
        showNotification('Error clearing URLs: ' + error.message, 'error');
    }
}

// Storage Info Update
async function updateStorageInfo() {
    try {
        const bytes = await chrome.storage.local.getBytesInUse(null);
        const maxBytes = 5 * 1024 * 1024; // 5MB
        const usagePercent = (bytes / maxBytes) * 100;

        const meter = document.getElementById('storageMeter');
        meter.style.width = `${usagePercent}%`;

        if (usagePercent > 90) {
            meter.className = 'storage-meter-fill critical';
        } else if (usagePercent > 70) {
            meter.className = 'storage-meter-fill warning';
        } else {
            meter.className = 'storage-meter-fill';
        }

        document.getElementById('storageText').textContent =
            `${(bytes / 1024 / 1024).toFixed(2)}MB of 5MB used (${usagePercent.toFixed(1)}%)`;

        if (usagePercent > 90) {
            showNotification('Storage nearly full! Consider exporting and clearing some data.', 'warning');
        }
    } catch (error) {
        console.error('Error updating storage info:', error);
    }
}

// Notification System
function showNotification(message, type = 'info') {
    const existing = document.querySelector('.notification');
    if (existing) {
        existing.remove();
    }

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.classList.add('fade-out');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Main URL Operations
async function saveCurrentUrl() {
    try {
        const tabs = await chrome.tabs.query({active: true, currentWindow: true});
        const currentUrl = tabs[0].url;
        const description = document.getElementById('description').value.trim();

        if (!description) {
            showNotification('Please enter a description', 'error');
            return;
        }

        const newEntry = {
            url: currentUrl,
            description: description,
            timestamp: new Date().toLocaleString()
        };

        // Check storage usage before saving
        const bytes = await chrome.storage.local.getBytesInUse(null);
        const maxBytes = 5 * 1024 * 1024; // 5MB
        const usagePercent = (bytes / maxBytes) * 100;

        // If storage is over 90% full, show storage management dialog
        if (usagePercent > 90) {
            const shouldContinue = await showStorageFullDialog();
            if (!shouldContinue) return;
        }

        const result = await chrome.storage.local.get(['savedUrls']);
        const savedUrls = result.savedUrls || [];
        savedUrls.unshift(newEntry);

        await chrome.storage.local.set({ savedUrls });
        document.getElementById('description').value = '';
        showNotification('URL saved successfully!', 'success');
        loadSavedUrls();
        updateStorageInfo();
    } catch (error) {
        showNotification('Error saving URL: ' + error.message, 'error');
    }
}

// URL Loading and Display
async function loadSavedUrls() {
    try {
        const container = document.getElementById('savedUrls');
        const result = await chrome.storage.local.get(['savedUrls']);
        const savedUrls = result.savedUrls || [];

        if (savedUrls.length === 0) {
            container.innerHTML = '<div class="no-urls">No saved URLs yet</div>';
            return;
        }

        container.innerHTML = '';
        savedUrls.forEach((item, index) => {
            const div = document.createElement('div');
            div.className = 'url-item';
            div.innerHTML = `
        <div class="url-description">${escapeHtml(item.description)}</div>
        <a href="${item.url}" class="url-link" target="_blank">${item.url}</a>
        <div class="url-timestamp">Saved: ${item.timestamp}</div>
        <button class="delete-btn" title="Delete">×</button>
      `;

            div.querySelector('.delete-btn').addEventListener('click', () => deleteUrl(index));
            container.appendChild(div);
        });
    } catch (error) {
        showNotification('Error loading URLs: ' + error.message, 'error');
    }
}

// URL Deletion
async function deleteUrl(index) {
    try {
        if (!confirm('Are you sure you want to delete this URL?')) {
            return;
        }

        const result = await chrome.storage.local.get(['savedUrls']);
        const savedUrls = result.savedUrls || [];
        savedUrls.splice(index, 1);

        await chrome.storage.local.set({ savedUrls });
        showNotification('URL deleted', 'info');
        loadSavedUrls();
        updateStorageInfo();
    } catch (error) {
        showNotification('Error deleting URL: ' + error.message, 'error');
    }
}

// CSV Export
function exportToCSV() {
    chrome.storage.local.get(['savedUrls'], function(result) {
        const savedUrls = result.savedUrls || [];

        if (savedUrls.length === 0) {
            showNotification('No URLs to export', 'info');
            return;
        }

        // Create CSV content
        const csvContent = [
            ['Description', 'URL', 'Timestamp'],
            ...savedUrls.map(item => [
                `"${item.description.replace(/"/g, '""')}"`, // Escape quotes in description
                item.url,
                item.timestamp
            ])
        ].map(row => row.join(',')).join('\n');

        // Create and trigger download
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `saved_urls_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        showNotification('URLs exported successfully!', 'success');
    });
}

// Utility Functions
function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}