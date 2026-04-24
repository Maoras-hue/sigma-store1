const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// MIDDLEWARE
// ============================================
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files - IMPORTANT: Order matters
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, 'admin')));
app.use('/admin', express.static(path.join(__dirname, 'admin')));
app.use(express.static(path.join(__dirname, 'frontend')));

// Ensure directories exist
const uploadsDir = path.join(__dirname, 'uploads');
const adminDir = path.join(__dirname, 'admin');
const frontendDir = path.join(__dirname, 'frontend');

if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
if (!fs.existsSync(adminDir)) fs.mkdirSync(adminDir, { recursive: true });
if (!fs.existsSync(frontendDir)) fs.mkdirSync(frontendDir, { recursive: true });

console.log('Directories ready');

// ============================================
// DATABASE SETUP
// ============================================
const dbPath = path.join(__dirname, 'sigma_store.db');
const db = new sqlite3.Database(dbPath);

// Promisify database functions
function executeQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
}

function executeGet(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function executeAll(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

// Create all tables
(async function initDatabase() {
    try {
        // Users table
        await executeQuery(`CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            email TEXT UNIQUE,
            name TEXT,
            password TEXT,
            profile_picture TEXT,
            created_at TEXT
        )`);
        console.log('Users table ready');
        
        // Add profile_picture column if missing
        try {
            await executeQuery(`ALTER TABLE users ADD COLUMN profile_picture TEXT`);
            console.log('Added profile_picture column');
        } catch(e) {}
        
        // Sessions table
        await executeQuery(`CREATE TABLE IF NOT EXISTS sessions (
            token TEXT PRIMARY KEY,
            user_id TEXT,
            expires INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
        console.log('Sessions table ready');
        
        // Products table
        await executeQuery(`CREATE TABLE IF NOT EXISTS products (
            id TEXT PRIMARY KEY,
            name TEXT,
            price REAL,
            category TEXT,
            image TEXT,
            stock INTEGER,
            created_at TEXT
        )`);
        console.log('Products table ready');
        
        // Orders table
        await executeQuery(`CREATE TABLE IF NOT EXISTS orders (
            order_id TEXT PRIMARY KEY,
            user_id TEXT,
            user_email TEXT,
            items TEXT,
            subtotal REAL,
            shipping REAL,
            total REAL,
            notes TEXT,
            status TEXT,
            payment_method TEXT,
            payment_id TEXT,
            payment_status TEXT,
            created_at TEXT
        )`);
        console.log('Orders table ready');
        
        // Chat messages table
        await executeQuery(`CREATE TABLE IF NOT EXISTS chat_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT,
            user_name TEXT,
            message TEXT,
            is_admin INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
        console.log('Chat table ready');
        
    } catch (error) {
        console.error('Database init error:', error.message);
    }
})();

// ============================================
// HELPER FUNCTIONS
// ============================================

function getUserIdFromToken(token) {
    if (!token) return null;
    // Remove 'Bearer ' if present
    const cleanToken = token.replace('Bearer ', '');
    return cleanToken;
}

// ============================================
// TEST ROUTES
// ============================================

app.get('/api/test', (req, res) => {
    res.json({ message: 'Backend is working!', status: 'online', time: new Date().toISOString() });
});

app.get('/test', (req, res) => {
    res.json({ message: 'Server is running' });
});

// ============================================
// ADMIN ROUTES
// ============================================

// Serve admin.html directly
app.get('/admin.html', (req, res) => {
    const filePath = path.join(__dirname, 'admin', 'admin.html');
    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.status(404).send('Admin page not found. Make sure admin/admin.html exists.');
    }
});

app.get('/admin', (req, res) => {
    const filePath = path.join(__dirname, 'admin', 'admin.html');
    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.status(404).send('Admin page not found');
    }
});

app.post('/api/admin/login', (req, res) => {
    const { password } = req.body;
    const ADMIN_PASSWORD = 'sigma123';
    if (password === ADMIN_PASSWORD) {
        res.json({ success: true });
    } else {
        res.status(401).json({ error: 'Wrong password' });
    }
});

// ============================================
// USER AUTH ROUTES
// ============================================

app.post('/api/signup', async (req, res) => {
    console.log('Signup request:', req.body);
    
    try {
        const { email, name, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password required' });
        }
        
        const existingUser = await executeGet('SELECT id FROM users WHERE email = ?', [email]);
        if (existingUser) {
            return res.status(400).json({ error: 'Email already exists' });
        }
        
        const hashedPassword = await bcrypt.hash(password, 10);
        const userId = uuidv4();
        const createdAt = new Date().toISOString();
        
        await executeQuery(
            'INSERT INTO users (id, email, name, password, created_at) VALUES (?, ?, ?, ?, ?)',
            [userId, email, name || email.split('@')[0], hashedPassword, createdAt]
        );
        
        const token = uuidv4();
        const expires = Date.now() + (10 * 365 * 24 * 60 * 60 * 1000);
        await executeQuery(
            'INSERT INTO sessions (token, user_id, expires) VALUES (?, ?, ?)',
            [token, userId, expires]
        );
        
        res.json({
            success: true,
            token: token,
            user: { id: userId, email: email, name: name || email.split('@')[0] }
        });
    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ error: 'Signup failed' });
    }
});

app.post('/api/login', async (req, res) => {
    console.log('Login request:', req.body.email);
    
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password required' });
        }
        
        const user = await executeGet('SELECT * FROM users WHERE email = ?', [email]);
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const token = uuidv4();
        const expires = Date.now() + (10 * 365 * 24 * 60 * 60 * 1000);
        
        await executeQuery(
            'INSERT OR REPLACE INTO sessions (token, user_id, expires) VALUES (?, ?, ?)',
            [token, user.id, expires]
        );
        
        res.json({
            success: true,
            token: token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                profile_picture: user.profile_picture
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

app.post('/api/logout', async (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token) {
        await executeQuery('DELETE FROM sessions WHERE token = ?', [token]);
    }
    res.json({ success: true });
});

app.get('/api/me', async (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
        return res.status(401).json({ error: 'Not logged in' });
    }
    
    const session = await executeGet('SELECT user_id FROM sessions WHERE token = ? AND expires > ?', [token, Date.now()]);
    if (!session) {
        return res.status(401).json({ error: 'Invalid session' });
    }
    
    const user = await executeGet('SELECT id, email, name, profile_picture FROM users WHERE id = ?', [session.user_id]);
    if (!user) {
        return res.status(401).json({ error: 'User not found' });
    }
    
    res.json({ user: user });
});

// ============================================
// PROFILE ROUTES
// ============================================

app.get('/api/profile', async (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
        return res.status(401).json({ error: 'Not logged in' });
    }
    
    const session = await executeGet('SELECT user_id FROM sessions WHERE token = ? AND expires > ?', [token, Date.now()]);
    if (!session) {
        return res.status(401).json({ error: 'Invalid session' });
    }
    
    const user = await executeGet('SELECT id, email, name, profile_picture, created_at FROM users WHERE id = ?', [session.user_id]);
    res.json({ success: true, user: user });
});

app.put('/api/profile', async (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
        return res.status(401).json({ error: 'Not logged in' });
    }
    
    const session = await executeGet('SELECT user_id FROM sessions WHERE token = ? AND expires > ?', [token, Date.now()]);
    if (!session) {
        return res.status(401).json({ error: 'Invalid session' });
    }
    
    const { name, email } = req.body;
    const updates = [];
    const params = [];
    
    if (name) {
        updates.push('name = ?');
        params.push(name);
    }
    if (email) {
        updates.push('email = ?');
        params.push(email);
    }
    
    if (updates.length > 0) {
        params.push(session.user_id);
        await executeQuery(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
    }
    
    const user = await executeGet('SELECT id, email, name, profile_picture FROM users WHERE id = ?', [session.user_id]);
    res.json({ success: true, user: user });
});

app.put('/api/change-password', async (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
        return res.status(401).json({ error: 'Not logged in' });
    }
    
    const session = await executeGet('SELECT user_id FROM sessions WHERE token = ? AND expires > ?', [token, Date.now()]);
    if (!session) {
        return res.status(401).json({ error: 'Invalid session' });
    }
    
    const { currentPassword, newPassword } = req.body;
    
    const user = await executeGet('SELECT password FROM users WHERE id = ?', [session.user_id]);
    const validPassword = await bcrypt.compare(currentPassword, user.password);
    if (!validPassword) {
        return res.status(401).json({ error: 'Current password is incorrect' });
    }
    
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await executeQuery('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, session.user_id]);
    
    res.json({ success: true, message: 'Password changed successfully' });
});

// ============================================
// PROFILE PICTURE ROUTES
// ============================================

const profileStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, 'uploads'));
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'profile-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const profileUpload = multer({
    storage: profileStorage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/gif', 'image/webp'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Only images allowed'));
        }
    }
});

app.post('/api/upload-profile-picture', profileUpload.single('profilePicture'), async (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
        return res.status(401).json({ error: 'Not logged in' });
    }
    
    const session = await executeGet('SELECT user_id FROM sessions WHERE token = ? AND expires > ?', [token, Date.now()]);
    if (!session) {
        return res.status(401).json({ error: 'Invalid session' });
    }
    
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const profilePictureUrl = '/uploads/' + req.file.filename;
    await executeQuery('UPDATE users SET profile_picture = ? WHERE id = ?', [profilePictureUrl, session.user_id]);
    
    res.json({ success: true, profilePicture: profilePictureUrl });
});

app.get('/api/profile-picture', async (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
        return res.status(401).json({ error: 'Not logged in' });
    }
    
    const session = await executeGet('SELECT user_id FROM sessions WHERE token = ? AND expires > ?', [token, Date.now()]);
    if (!session) {
        return res.status(401).json({ error: 'Invalid session' });
    }
    
    const user = await executeGet('SELECT profile_picture FROM users WHERE id = ?', [session.user_id]);
    res.json({ profilePicture: user?.profile_picture || null });
});

app.delete('/api/profile-picture', async (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
        return res.status(401).json({ error: 'Not logged in' });
    }
    
    const session = await executeGet('SELECT user_id FROM sessions WHERE token = ? AND expires > ?', [token, Date.now()]);
    if (!session) {
        return res.status(401).json({ error: 'Invalid session' });
    }
    
    await executeQuery('UPDATE users SET profile_picture = NULL WHERE id = ?', [session.user_id]);
    res.json({ success: true });
});

// ============================================
// ORDER ROUTES
// ============================================

app.get('/api/my-orders', async (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
        return res.status(401).json({ error: 'Not logged in' });
    }
    
    const session = await executeGet('SELECT user_id FROM sessions WHERE token = ? AND expires > ?', [token, Date.now()]);
    if (!session) {
        return res.status(401).json({ error: 'Invalid session' });
    }
    
    const orders = await executeAll('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC', [session.user_id]);
    orders.forEach(order => {
        if (order.items) {
            try {
                order.items = JSON.parse(order.items);
            } catch(e) {}
        }
    });
    
    res.json({ success: true, orders: orders });
});

app.post('/api/orders', async (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
        return res.status(401).json({ error: 'Not logged in' });
    }
    
    const session = await executeGet('SELECT user_id FROM sessions WHERE token = ? AND expires > ?', [token, Date.now()]);
    if (!session) {
        return res.status(401).json({ error: 'Invalid session' });
    }
    
    const user = await executeGet('SELECT email FROM users WHERE id = ?', [session.user_id]);
    const { items, subtotal, shipping, total, notes } = req.body;
    const orderId = uuidv4();
    const createdAt = new Date().toISOString();
    
    await executeQuery(
        `INSERT INTO orders (order_id, user_id, user_email, items, subtotal, shipping, total, notes, status, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [orderId, session.user_id, user.email, JSON.stringify(items), subtotal, shipping, total, notes, 'pending', createdAt]
    );
    
    res.json({ success: true, orderId: orderId });
});

app.get('/api/orders', async (req, res) => {
    const orders = await executeAll('SELECT * FROM orders ORDER BY created_at DESC');
    orders.forEach(order => {
        if (order.items) {
            try {
                order.items = JSON.parse(order.items);
            } catch(e) {}
        }
    });
    res.json(orders);
});

// ============================================
// PRODUCT ROUTES
// ============================================

app.get('/api/products', async (req, res) => {
    try {
        const products = await executeAll('SELECT * FROM products ORDER BY created_at DESC');
        res.json(products);
    } catch (error) {
        console.error('Get products error:', error);
        res.status(500).json({ error: 'Failed to get products' });
    }
});

app.post('/api/products', async (req, res) => {
    try {
        const { name, price, category, image, stock } = req.body;
        const id = uuidv4();
        const createdAt = new Date().toISOString();
        
        let productImage = image;
        if (!productImage) {
            productImage = `https://placehold.co/400x300/1a1a2e/white?text=${encodeURIComponent(name)}`;
        }
        
        await executeQuery(
            'INSERT INTO products (id, name, price, category, image, stock, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [id, name, parseFloat(price), category || 'digital', productImage, stock || 999, createdAt]
        );
        
        res.status(201).json({ success: true, id: id });
    } catch (error) {
        console.error('Create product error:', error);
        res.status(500).json({ error: 'Failed to create product' });
    }
});

app.delete('/api/products/:id', async (req, res) => {
    try {
        await executeQuery('DELETE FROM products WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (error) {
        console.error('Delete product error:', error);
        res.status(500).json({ error: 'Failed to delete product' });
    }
});

// ============================================
// CHAT ROUTES
// ============================================

app.post('/api/chat/save', async (req, res) => {
    try {
        const { userId, userName, message, isAdmin } = req.body;
        await executeQuery(
            'INSERT INTO chat_messages (user_id, user_name, message, is_admin) VALUES (?, ?, ?, ?)',
            [userId, userName, message, isAdmin ? 1 : 0]
        );
        res.json({ success: true });
    } catch (error) {
        console.error('Save chat error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/chat/history/:userId', async (req, res) => {
    try {
        const messages = await executeAll(
            'SELECT * FROM chat_messages WHERE user_id = ? ORDER BY created_at ASC LIMIT 50',
            [req.params.userId]
        );
        res.json({ messages: messages || [] });
    } catch (error) {
        console.error('History error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/admin/chats', async (req, res) => {
    try {
        const chats = await executeAll(
            `SELECT user_id, user_name, COUNT(*) as count, MAX(created_at) as last_message 
             FROM chat_messages 
             GROUP BY user_id 
             ORDER BY last_message DESC`
        );
        res.json({ chats: chats || [] });
    } catch (error) {
        console.error('Admin chats error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// NOTIFICATION ROUTES
// ============================================

let lastProductUpdate = Date.now();

app.post('/api/notify-shop-refresh', (req, res) => {
    lastProductUpdate = Date.now();
    res.json({ success: true });
});

app.get('/api/last-product-update', (req, res) => {
    res.json({ lastUpdate: lastProductUpdate });
});

// ============================================
// FALLBACK ROUTE
// ============================================

app.get('*', (req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
    console.log('========================================');
    console.log('SIGMA STORE BACKEND RUNNING');
    console.log('========================================');
    console.log(`Port: ${PORT}`);
    console.log(`Test: https://sigma-store-api.onrender.com/api/test`);
    console.log(`Admin: https://sigma-store-api.onrender.com/admin.html`);
    console.log(`Admin Password: sigma123`);
    console.log('========================================');
});
