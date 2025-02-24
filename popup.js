// Initialize event listeners
document.addEventListener('DOMContentLoaded', function() {
    loadSavedUrls();
    document.getElementById('saveButton').addEventListener('click', saveCurrentUrl);
    document.getElementById('exportButton').addEventListener('click', exportToCSV);
    document.getElementById('manageStorageButton').addEventListener('click', showStorageManagementDialog);
    updateStorageInfo();
});

// Storage Management Dialog
async function showStorageManagementDialog() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <h3 style="margin-top: 0; font-size: 18px; font-weight: bold;">Storage Management</h3>
            <div class="storage-meter mt-4">
                <div id="modalStorageMeter" class="storage-meter-fill"></div>
            </div>
            <div id="modalStorageText" class="mt-2 text-sm text-gray-600"></div>
            <div class="modal-buttons mt-4">
                <button id="exportAllBtn" class="primary-button">Export All URLs</button>
                <button id="clearAllBtn" class="secondary-button">Clear All URLs</button>
                <button id="deleteOldestBtn" class="secondary-button">Delete Oldest (10)</button>
                <button id="closeModalBtn" class="text-button">Close</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Update storage meter in modal
    await updateModalStorageInfo();

    // Add event listeners
    modal.querySelector('#exportAllBtn').onclick = async () => {
        await exportToCSV();
        updateModalStorageInfo();
    };

    modal.querySelector('#clearAllBtn').onclick = async () => {
        if (confirm('Are you sure you want to clear all URLs? This cannot be undone.')) {
            await clearAllUrls();
            modal.remove();
        }
    };

    modal.querySelector('#deleteOldestBtn').onclick = async () => {
        if (confirm('Delete the 10 oldest URLs?')) {
            await deleteOldestEntries(10);
            await updateModalStorageInfo();
        }
    };

    modal.querySelector('#closeModalBtn').onclick = () => {
        modal.remove();
    };
}

// Storage Info Updates
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
            showNotification('Storage nearly full! Consider managing your storage.', 'warning');
        }
    } catch (error) {
        console.error('Error updating storage info:', error);
    }
}

async function updateModalStorageInfo() {
    try {
        const bytes = await chrome.storage.local.getBytesInUse(null);
        const maxBytes = 5 * 1024 * 1024;
        const usagePercent = (bytes / maxBytes) * 100;

        const meter = document.getElementById('modalStorageMeter');
        if (meter) {
            meter.style.width = `${usagePercent}%`;
            meter.className = `storage-meter-fill ${
                usagePercent > 90 ? 'critical' : usagePercent > 70 ? 'warning' : ''
            }`;
        }

        const text = document.getElementById('modalStorageText');
        if (text) {
            text.textContent = `${(bytes / 1024 / 1024).toFixed(2)}MB of 5MB used (${usagePercent.toFixed(1)}%)`;
        }
    } catch (error) {
        console.error('Error updating modal storage info:', error);
    }
}

// Enhanced Notification System
function showNotification(message, type = 'info') {
    const existing = document.querySelector('.notification');
    if (existing) {
        existing.remove();
    }

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            ${type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️'}
            <span>${message}</span>
        </div>
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.classList.add('fade-out');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}
// URL Operations
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

// Storage Management Functions
async function deleteOldestEntries(count) {
    try {
        const result = await chrome.storage.local.get(['savedUrls']);
        let savedUrls = result.savedUrls || [];

        if (savedUrls.length <= count) {
            savedUrls = [];
            showNotification('Cleared all URLs as there were fewer than ' + count, 'info');
        } else {
            savedUrls = savedUrls.slice(0, -count);
            showNotification(`Deleted ${count} oldest URLs`, 'success');
        }

        await chrome.storage.local.set({ savedUrls });
        await loadSavedUrls();
        await updateStorageInfo();
    } catch (error) {
        showNotification('Error deleting entries: ' + error.message, 'error');
    }
}

async function clearAllUrls() {
    try {
        await chrome.storage.local.set({ savedUrls: [] });
        showNotification('All URLs cleared', 'success');
        loadSavedUrls();
        updateStorageInfo();
    } catch (error) {
        showNotification('Error clearing URLs: ' + error.message, 'error');
    }
}

// Load and Display URLs
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
                <button class="edit-btn" title="Edit Description">
                    <i class="fa-solid fa-pen-to-square"></i>
                </button>
                <button class="delete-btn" title="Delete">
                    <i class="fa-solid fa-trash"></i>
                </button>
            `;

            // Add edit button event listener
            const editBtn = div.querySelector('.edit-btn');
            editBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                startEditing(div, item, index);
            });

            // Add delete button event listener
            div.querySelector('.delete-btn').addEventListener('click', () => deleteUrl(index));

            container.appendChild(div);
        });
    } catch (error) {
        showNotification('Error loading URLs: ' + error.message, 'error');
    }
}

// Edit Functions
function startEditing(div, item, index) {
    // Remove any existing edit modes
    document.querySelectorAll('.edit-container').forEach(container => {
        const urlItem = container.closest('.url-item');
        const desc = urlItem.querySelector('.url-description');
        desc.style.display = 'block';
        container.remove();
    });

    const descriptionDiv = div.querySelector('.url-description');
    const editContainer = document.createElement('div');
    editContainer.className = 'edit-container';

    editContainer.innerHTML = `
        <textarea class="edit-textarea">${item.description}</textarea>
        <div class="edit-buttons">
            <button class="save-edit-btn">Save</button>
            <button class="cancel-edit-btn">Cancel</button>
        </div>
    `;

    descriptionDiv.style.display = 'none';
    descriptionDiv.parentNode.insertBefore(editContainer, descriptionDiv.nextSibling);

    const textarea = editContainer.querySelector('.edit-textarea');
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);

    editContainer.querySelector('.save-edit-btn').addEventListener('click', () => {
        saveEdit(index, textarea.value.trim(), div, descriptionDiv, editContainer);
    });

    editContainer.querySelector('.cancel-edit-btn').addEventListener('click', () => {
        cancelEdit(div, descriptionDiv, editContainer);
    });

    textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            saveEdit(index, textarea.value.trim(), div, descriptionDiv, editContainer);
        } else if (e.key === 'Escape') {
            cancelEdit(div, descriptionDiv, editContainer);
        }
    });
}

async function saveEdit(index, newDescription, div, descriptionDiv, editContainer) {
    if (!newDescription) {
        showNotification('Description cannot be empty', 'error');
        return;
    }

    try {
        const result = await chrome.storage.local.get(['savedUrls']);
        const savedUrls = result.savedUrls || [];

        if (index >= 0 && index < savedUrls.length) {
            savedUrls[index].description = newDescription;
            await chrome.storage.local.set({ savedUrls });
            descriptionDiv.textContent = newDescription;
            descriptionDiv.style.display = 'block';
            editContainer.remove();
            showNotification('Description updated successfully!', 'success');
            updateStorageInfo();
        }
    } catch (error) {
        showNotification('Error saving edit: ' + error.message, 'error');
    }
}

function cancelEdit(div, descriptionDiv, editContainer) {
    descriptionDiv.style.display = 'block';
    editContainer.remove();
}

// Delete URL
async function deleteUrl(index) {
    try {
        if (!confirm('Are you sure you want to delete this URL?')) {
            return;
        }

        const result = await chrome.storage.local.get(['savedUrls']);
        const savedUrls = result.savedUrls || [];
        savedUrls.splice(index, 1);

        await chrome.storage.local.set({ savedUrls });
        showNotification('URL deleted successfully', 'success');
        loadSavedUrls();
        updateStorageInfo();
    } catch (error) {
        showNotification('Error deleting URL: ' + error.message, 'error');
    }
}

// Export to CSV
function exportToCSV() {
    chrome.storage.local.get(['savedUrls'], function(result) {
        const savedUrls = result.savedUrls || [];

        if (savedUrls.length === 0) {
            showNotification('No URLs to export', 'info');
            return;
        }

        const csvContent = [
            ['Description', 'URL', 'Timestamp'],
            ...savedUrls.map(item => [
                `"${item.description.replace(/"/g, '""')}"`,
                item.url,
                item.timestamp
            ])
        ].map(row => row.join(',')).join('\n');

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