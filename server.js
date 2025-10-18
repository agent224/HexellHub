const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const multer = require('multer');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');

const app = express();
const PORT = 3000;

// Base directory to manage
const BASE_DIR = 'C:\\Users\\levis\\OneDrive\\Desktop\\wafflynutria.com';

// Login credentials (change these!)
const CREDENTIALS = {
    username: 'admin',
    password: 'password123'
};

// Active sessions
const sessions = new Map();

// Middleware
app.use(cors({
    origin: 'http://localhost:3000',
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());
app.use(express.static('public'));

// Authentication middleware
function requireAuth(req, res, next) {
    const sessionId = req.cookies.sessionId;
    
    if (!sessionId || !sessions.has(sessionId)) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    next();
}

// Login endpoint
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    
    if (username === CREDENTIALS.username && password === CREDENTIALS.password) {
        const sessionId = crypto.randomBytes(32).toString('hex');
        sessions.set(sessionId, { username, loginTime: Date.now() });
        
        // Cookie that never expires (100 years)
        res.cookie('sessionId', sessionId, {
            maxAge: 100 * 365 * 24 * 60 * 60 * 1000,
            httpOnly: true,
            sameSite: 'lax'
        });
        
        res.json({ success: true });
    } else {
        res.status(401).json({ error: 'Invalid credentials' });
    }
});

// Logout endpoint
app.post('/api/logout', (req, res) => {
    const sessionId = req.cookies.sessionId;
    if (sessionId) {
        sessions.delete(sessionId);
    }
    res.clearCookie('sessionId');
    res.json({ success: true });
});

// Check auth status
app.get('/api/check-auth', (req, res) => {
    const sessionId = req.cookies.sessionId;
    
    if (sessionId && sessions.has(sessionId)) {
        res.json({ authenticated: true });
    } else {
        res.json({ authenticated: false });
    }
});

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = req.body.path || '';
        const fullPath = path.join(BASE_DIR, uploadPath);
        cb(null, fullPath);
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    }
});
const upload = multer({ storage });

// Get directory contents (protected)
app.get('/api/files', requireAuth, async (req, res) => {
    try {
        const relativePath = req.query.path || '';
        const fullPath = path.join(BASE_DIR, relativePath);
        
        // Security check - ensure path is within BASE_DIR
        if (!fullPath.startsWith(BASE_DIR)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const items = await fs.readdir(fullPath, { withFileTypes: true });
        
        const files = await Promise.all(items.map(async (item) => {
            const itemPath = path.join(fullPath, item.name);
            const stats = await fs.stat(itemPath);
            
            return {
                name: item.name,
                type: item.isDirectory() ? 'folder' : 'file',
                size: item.isFile() ? stats.size : null,
                modified: stats.mtime,
                created: stats.birthtime,
                uploadedBy: 'admin' // Since we only have one user
            };
        }));

        res.json({ files, currentPath: relativePath });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create folder (protected)
app.post('/api/folder', requireAuth, async (req, res) => {
    try {
        const { path: relativePath, name } = req.body;
        const fullPath = path.join(BASE_DIR, relativePath, name);
        
        if (!fullPath.startsWith(BASE_DIR)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        await fs.mkdir(fullPath, { recursive: true });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Upload file (protected)
app.post('/api/upload', requireAuth, upload.single('file'), (req, res) => {
    res.json({ success: true, filename: req.file.filename });
});

// Rename file/folder (protected)
app.put('/api/rename', requireAuth, async (req, res) => {
    try {
        const { path: relativePath, oldName, newName } = req.body;
        const oldPath = path.join(BASE_DIR, relativePath, oldName);
        const newPath = path.join(BASE_DIR, relativePath, newName);
        
        if (!oldPath.startsWith(BASE_DIR) || !newPath.startsWith(BASE_DIR)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        await fs.rename(oldPath, newPath);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete file/folder (protected)
app.delete('/api/delete', requireAuth, async (req, res) => {
    try {
        const { path: relativePath, name } = req.body;
        const fullPath = path.join(BASE_DIR, relativePath, name);
        
        if (!fullPath.startsWith(BASE_DIR)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const stats = await fs.stat(fullPath);
        if (stats.isDirectory()) {
            await fs.rm(fullPath, { recursive: true });
        } else {
            await fs.unlink(fullPath);
        }
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Download file (protected)
app.get('/api/download', requireAuth, async (req, res) => {
    try {
        const relativePath = req.query.path || '';
        const name = req.query.name;
        const fullPath = path.join(BASE_DIR, relativePath, name);
        
        if (!fullPath.startsWith(BASE_DIR)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        res.download(fullPath);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Stream video (protected)
app.get('/api/stream', requireAuth, async (req, res) => {
    try {
        const relativePath = req.query.path || '';
        const name = req.query.name;
        const fullPath = path.join(BASE_DIR, relativePath, name);
        
        if (!fullPath.startsWith(BASE_DIR)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const stat = await fs.stat(fullPath);
        const fileSize = stat.size;
        const range = req.headers.range;

        if (range) {
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
            const chunksize = (end - start) + 1;
            
            const readStream = require('fs').createReadStream(fullPath, { start, end });
            const head = {
                'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunksize,
                'Content-Type': 'video/mp4',
            };
            
            res.writeHead(206, head);
            readStream.pipe(res);
        } else {
            const head = {
                'Content-Length': fileSize,
                'Content-Type': 'video/mp4',
            };
            res.writeHead(200, head);
            require('fs').createReadStream(fullPath).pipe(res);
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 File Manager Server running at http://localhost:${PORT}`);
    console.log(`📁 Managing directory: ${BASE_DIR}`);
});