const API_URL = 'http://localhost:3000/api';
let currentPath = '';
let selectedItem = null;
let isAuthenticated = false;

// Check authentication on load
async function checkAuth() {
    try {
        const response = await fetch(`${API_URL}/check-auth`, {
            credentials: 'include'
        });
        const data = await response.json();
        
        if (data.authenticated) {
            showMainApp();
        } else {
            showLoginScreen();
        }
    } catch (error) {
        showLoginScreen();
    }
}

// Show login screen
function showLoginScreen() {
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('mainApp').style.display = 'none';
    isAuthenticated = false;
}

// Show main app
function showMainApp() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('mainApp').style.display = 'block';
    isAuthenticated = true;
    loadFiles();
}

// Login
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorDiv = document.getElementById('loginError');
    
    try {
        const response = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showMainApp();
        } else {
            errorDiv.textContent = 'Invalid username or password';
        }
    } catch (error) {
        errorDiv.textContent = 'Connection error. Make sure the server is running.';
    }
});

// Logout
document.getElementById('logoutBtn').addEventListener('click', async () => {
    try {
        await fetch(`${API_URL}/logout`, {
            method: 'POST',
            credentials: 'include'
        });
        showLoginScreen();
    } catch (error) {
        console.error('Logout error:', error);
    }
});

// Load files from server
async function loadFiles() {
    try {
        const response = await fetch(`${API_URL}/files?path=${encodeURIComponent(currentPath)}`);
        const data = await response.json();
        
        if (data.error) {
            alert('Error: ' + data.error);
            return;
        }
        
        renderFiles(data.files);
        updateBreadcrumb();
    } catch (error) {
        console.error('Error loading files:', error);
        document.getElementById('fileGrid').innerHTML = 
            '<div class="error">❌ Could not connect to server. Make sure the server is running!</div>';
    }
}

// Render files
function renderFiles(files) {
    const fileGrid = document.getElementById('fileGrid');
    fileGrid.innerHTML = '';
    
    // Add back button if not in root
    if (currentPath !== '') {
        const backBtn = createFileElement({
            name: '..',
            type: 'back',
            icon: '⬆️'
        });
        fileGrid.appendChild(backBtn);
    }
    
    if (files.length === 0 && currentPath === '') {
        fileGrid.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📂</div>
                <div class="empty-state-text">Folder is empty</div>
            </div>
        `;
        return;
    }
    
    // Sort: folders first, then files
    files.sort((a, b) => {
        if (a.type === b.type) return a.name.localeCompare(b.name);
        return a.type === 'folder' ? -1 : 1;
    });
    
    files.forEach(file => {
        const element = createFileElement(file);
        fileGrid.appendChild(element);
    });
}

// Create file element
function createFileElement(item) {
    const div = document.createElement('div');
    div.className = `file-item ${item.type === 'folder' ? 'folder' : ''}`;
    
    const icon = item.icon || (item.type === 'folder' ? '📁' : getFileIcon(item.name));
    
    div.innerHTML = `
        <div class="file-icon">${icon}</div>
        <div class="file-name">${item.name}</div>
        ${item.size !== null && item.size !== undefined ? `<div class="file-size">${formatFileSize(item.size)}</div>` : ''}
    `;
    
    if (item.type === 'back') {
        div.onclick = navigateBack;
    } else if (item.type === 'folder') {
        div.onclick = () => navigateToFolder(item.name);
    }
    
    // Right-click context menu
    if (item.type !== 'back') {
        div.oncontextmenu = (e) => {
            e.preventDefault();
            showContextMenu(e, item);
        };
    }
    
    return div;
}

// Get file icon
function getFileIcon(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const iconMap = {
        'jpg': '🖼️', 'jpeg': '🖼️', 'png': '🖼️', 'gif': '🖼️', 'svg': '🖼️',
        'pdf': '📄', 'doc': '📄', 'docx': '📄',
        'txt': '📝', 'md': '📝',
        'zip': '📦', 'rar': '📦',
        'mp3': '🎵', 'wav': '🎵',
        'mp4': '🎬', 'avi': '🎬',
        'js': '💻', 'html': '💻', 'css': '💻', 'py': '💻',
        'json': '⚙️', 'xml': '⚙️'
    };
    return iconMap[ext] || '📄';
}

// Format file size
function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
}

// Update breadcrumb
function updateBreadcrumb() {
    const breadcrumb = document.getElementById('breadcrumbPath');
    if (currentPath === '') {
        breadcrumb.textContent = '/ wafflynutria.com';
    } else {
        breadcrumb.textContent = '/ wafflynutria.com / ' + currentPath.split('\\').join(' / ');
    }
}

// Navigate to folder
function navigateToFolder(folderName) {
    currentPath = currentPath ? `${currentPath}\\${folderName}` : folderName;
    loadFiles();
}

// Navigate back
function navigateBack() {
    const parts = currentPath.split('\\');
    parts.pop();
    currentPath = parts.join('\\');
    loadFiles();
}

// Show context menu
function showContextMenu(e, item) {
    const menu = document.getElementById('contextMenu');
    menu.style.left = e.pageX + 'px';
    menu.style.top = e.pageY + 'px';
    menu.classList.add('show');
    
    selectedItem = item;
    
    // Hide download for folders
    document.getElementById('downloadItem').style.display = 
        item.type === 'folder' ? 'none' : 'block';
}

// Hide context menu
function hideContextMenu() {
    document.getElementById('contextMenu').classList.remove('show');
}

// Create folder
async function createFolder() {
    const name = prompt('Enter folder name:');
    if (!name) return;
    
    try {
        const response = await fetch(`${API_URL}/folder`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: currentPath, name })
        });
        
        const data = await response.json();
        if (data.success) {
            loadFiles();
        } else {
            alert('Error: ' + data.error);
        }
    } catch (error) {
        alert('Error creating folder: ' + error.message);
    }
}

// Upload files
async function uploadFiles(files) {
    for (let file of files) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('path', currentPath);
        
        try {
            await fetch(`${API_URL}/upload`, {
                method: 'POST',
                body: formData
            });
        } catch (error) {
            alert('Error uploading file: ' + error.message);
        }
    }
    loadFiles();
}

// Rename item
async function renameItem() {
    if (!selectedItem) return;
    
    const newName = prompt('Enter new name:', selectedItem.name);
    if (!newName || newName === selectedItem.name) {
        hideContextMenu();
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/rename`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                path: currentPath,
                oldName: selectedItem.name,
                newName
            })
        });
        
        const data = await response.json();
        if (data.success) {
            loadFiles();
        } else {
            alert('Error: ' + data.error);
        }
    } catch (error) {
        alert('Error renaming: ' + error.message);
    }
    
    hideContextMenu();
}

// Delete item
async function deleteItem() {
    if (!selectedItem) return;
    
    if (!confirm(`Delete "${selectedItem.name}"? This cannot be undone!`)) {
        hideContextMenu();
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/delete`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                path: currentPath,
                name: selectedItem.name
            })
        });
        
        const data = await response.json();
        if (data.success) {
            loadFiles();
        } else {
            alert('Error: ' + data.error);
        }
    } catch (error) {
        alert('Error deleting: ' + error.message);
    }
    
    hideContextMenu();
}

// Download file
function downloadFile() {
    if (!selectedItem || selectedItem.type === 'folder') return;
    
    const url = `${API_URL}/download?path=${encodeURIComponent(currentPath)}&name=${encodeURIComponent(selectedItem.name)}`;
    window.open(url, '_blank');
    
    hideContextMenu();
}

// Event listeners
document.getElementById('createFolderBtn').addEventListener('click', createFolder);
document.getElementById('uploadBtn').addEventListener('click', () => {
    document.getElementById('fileInput').click();
});
document.getElementById('fileInput').addEventListener('change', (e) => {
    uploadFiles(e.target.files);
    e.target.value = '';
});

document.getElementById('renameItem').addEventListener('click', renameItem);
document.getElementById('deleteItem').addEventListener('click', deleteItem);
document.getElementById('downloadItem').addEventListener('click', downloadFile);

document.addEventListener('click', hideContextMenu);

// Initialize
loadFiles();