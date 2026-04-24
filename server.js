require('dotenv').config();
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
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'sigma123';  // read from env

// ============================================
// Middleware
// ============================================
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, 'admin')));
app.use('/admin', express.static(path.join(__dirname, 'admin')));
app.use(express.static(path.join(__dirname, 'frontend')));

// Ensure directories exist
const uploadsDir = path.join(__dirname, 'uploads');
const productsDir = path.join(uploadsDir, 'products');
const profilesDir = path.join(uploadsDir, 'profiles');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
if (!fs.existsSync(productsDir)) fs.mkdirSync(productsDir, { recursive: true });
if (!fs.existsSync(profilesDir)) fs.mkdirSync(profilesDir, { recursive: true });

// ============================================
// Database setup
// ============================================
const dbPath = path.join(__dirname, 'sigma_store.db');
const db = new sqlite3.Database(dbPath);

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

// Create tables and default data
(async function initDatabase() {
    try {
        await executeQuery(`CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            email TEXT UNIQUE,
            name TEXT,
            password TEXT,
            profile_picture TEXT,
            created_at TEXT
        )`);
        await executeQuery(`CREATE TABLE IF NOT EXISTS sessions (
            token TEXT PRIMARY KEY,
            user_id TEXT,
            expires INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
        await executeQuery(`CREATE TABLE IF NOT EXISTS products (
            id TEXT PRIMARY KEY,
            name TEXT,
            price REAL,
            category TEXT,
            image TEXT,
            stock INTEGER,
            created_at TEXT
        )`);
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
        await executeQuery(`CREATE TABLE IF NOT EXISTS reviews (
            id TEXT PRIMARY KEY,
            product_id TEXT,
            user_id TEXT,
            user_name TEXT,
            rating INTEGER,
            comment TEXT,
            created_at TEXT
        )`);
        await executeQuery(`CREATE TABLE IF NOT EXISTS chat_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT,
            user_name TEXT,
            message TEXT,
            is_admin INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
        // Also sellers table for multi-vendor
        await executeQuery(`CREATE TABLE IF NOT EXISTS sellers (
            id TEXT PRIMARY KEY,
            user_id TEXT,
            user_email TEXT,
            store_name TEXT,
            store_description TEXT,
            category TEXT,
            status TEXT,
            total_sales REAL,
            balance REAL,
            created_at TEXT
        )`);

        // Insert default products if empty
        const productCount = await executeGet('SELECT COUNT(*) as count FROM products');
        if (productCount.count === 0) {
            const defaultProducts = [
                { id: 'p1', name: 'Wireless Headphones', price: 49.99, category: 'electronics', image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400', stock: 50 },
                { id: 'p2', name: 'Smart Watch', price: 89.99, category: 'electronics', image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400', stock: 30 },
                { id: 'p3', name: 'Premium Backpack', price: 79.99, category: 'accessories', image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400', stock: 25 },
                { id: 'p4', name: 'Coffee Maker', price: 129.99, category: 'home', image: 'https://images.unsplash.com/photo-1517668808822-9bba02b6f420?w=400', stock: 15 },
                { id: 'p5', name: 'Yoga Mat', price: 29.99, category: 'sports', image: 'https://images.unsplash.com/photo-1592432678016-e910b452f9a2?w=400', stock: 45 }
            ];
            for (const p of defaultProducts) {
                await executeQuery(
                    'INSERT INTO products (id, name, price, category, image, stock, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [p.id, p.name, p.price, p.category, p.image, p.stock, new Date().toISOString()]
                );
            }
            console.log('Default products inserted');
        }
        console.log('Database tables ready');
    } catch (err) {
        console.error('DB init error:', err.message);
    }
})();

// Helper to get user id from token
async function getUserIdFromToken(token) {
    if (!token) return null;
    const clean = token.replace('Bearer ', '');
    const session = await executeGet('SELECT user_id FROM sessions WHERE token = ? AND expires > ?', [clean, Date.now()]);
    return session ? session.user_id : null;
}

// ============================================
// TEST & ADMIN ROUTES
// ============================================
app.get('/api/test', (req, res) => {
    res.json({ message: 'Backend is working!', status: 'online', time: new Date().toISOString() });
});
app.get('/admin.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin', 'admin.html'));
});
app.post('/api/admin/login', (req, res) => {
    const { password } = req.body;
    if (password === ADMIN_PASSWORD) res.json({ success: true });
    else res.status(401).json({ error: 'Wrong password' });
});

// ============================================
// AUTH ROUTES
// ============================================
app.post('/api/signup', async (req, res) => {
    try {
        const { email, name, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
        const existing = await executeGet('SELECT id FROM users WHERE email = ?', [email]);
        if (existing) return res.status(400).json({ error: 'Email already exists' });
        const hashed = await bcrypt.hash(password, 10);
        const userId = uuidv4();
        await executeQuery('INSERT INTO users (id, email, name, password, created_at) VALUES (?, ?, ?, ?, ?)',
            [userId, email, name || email.split('@')[0], hashed, new Date().toISOString()]);
        const token = uuidv4();
        const expires = Date.now() + (10 * 365 * 24 * 60 * 60 * 1000);
        await executeQuery('INSERT INTO sessions (token, user_id, expires) VALUES (?, ?, ?)', [token, userId, expires]);
        res.json({ success: true, token, user: { id: userId, email, name: name || email.split('@')[0] } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Signup failed' });
    }
});
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await executeGet('SELECT * FROM users WHERE email = ?', [email]);
        if (!user) return res.status(401).json({ error: 'Invalid credentials' });
        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
        const token = uuidv4();
        const expires = Date.now() + (10 * 365 * 24 * 60 * 60 * 1000);
        await executeQuery('INSERT OR REPLACE INTO sessions (token, user_id, expires) VALUES (?, ?, ?)', [token, user.id, expires]);
        res.json({ success: true, token, user: { id: user.id, email: user.email, name: user.name, profile_picture: user.profile_picture } });
    } catch (err) {
        res.status(500).json({ error: 'Login failed' });
    }
});
app.post('/api/logout', async (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token) await executeQuery('DELETE FROM sessions WHERE token = ?', [token]);
    res.json({ success: true });
});
app.get('/api/me', async (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const userId = await getUserIdFromToken(token);
    if (!userId) return res.status(401).json({ error: 'Not logged in' });
    const user = await executeGet('SELECT id, email, name, profile_picture FROM users WHERE id = ?', [userId]);
    res.json({ user });
});

// ============================================
// PROFILE PICTURE UPLOAD
// ============================================
const profileStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, profilesDir),
    filename: (req, file, cb) => cb(null, 'profile-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9) + path.extname(file.originalname))
});
const profileUpload = multer({ storage: profileStorage, limits: { fileSize: 5*1024*1024 }, fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg','image/png','image/jpg','image/gif','image/webp'];
    cb(null, allowed.includes(file.mimetype));
}});
app.post('/api/upload-profile-picture', profileUpload.single('profilePicture'), async (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const userId = await getUserIdFromToken(token);
    if (!userId) return res.status(401).json({ error: 'Not logged in' });
    if (!req.file) return res.status(400).json({ error: 'No file' });
    const url = `/uploads/profiles/${req.file.filename}`;
    await executeQuery('UPDATE users SET profile_picture = ? WHERE id = ?', [url, userId]);
    res.json({ success: true, profilePicture: url });
});
app.get('/api/profile-picture', async (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const userId = await getUserIdFromToken(token);
    if (!userId) return res.status(401).json({ error: 'Not logged in' });
    const user = await executeGet('SELECT profile_picture FROM users WHERE id = ?', [userId]);
    res.json({ profilePicture: user?.profile_picture || null });
});
app.delete('/api/profile-picture', async (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const userId = await getUserIdFromToken(token);
    if (!userId) return res.status(401).json({ error: 'Not logged in' });
    await executeQuery('UPDATE users SET profile_picture = NULL WHERE id = ?', [userId]);
    res.json({ success: true });
});

// ============================================
// PRODUCT IMAGE UPLOAD (for admin)
// ============================================
const productImageStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, productsDir),
    filename: (req, file, cb) => cb(null, 'prod-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9) + path.extname(file.originalname))
});
const productUpload = multer({ storage: productImageStorage, limits: { fileSize: 5*1024*1024 }, fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg','image/png','image/jpg','image/gif','image/webp'];
    cb(null, allowed.includes(file.mimetype));
}});
app.post('/api/upload-product-image', productUpload.single('productImage'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file' });
    const url = `/uploads/products/${req.file.filename}`;
    res.json({ imageUrl: url });
});

// ============================================
// PRODUCT CRUD
// ============================================
app.get('/api/products', async (req, res) => {
    try {
        const products = await executeAll('SELECT * FROM products ORDER BY created_at DESC');
        res.json(products);
    } catch (err) { res.status(500).json({ error: err.message }); }
});
app.post('/api/products', async (req, res) => {
    try {
        const { name, price, category, image, stock } = req.body;
        if (!name || !price) return res.status(400).json({ error: 'Name and price required' });
        const id = uuidv4();
        const productImage = image || `https://placehold.co/400x300/1a1a2e/white?text=${encodeURIComponent(name)}`;
        await executeQuery(
            'INSERT INTO products (id, name, price, category, image, stock, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [id, name, parseFloat(price), category || 'digital', productImage, stock || 999, new Date().toISOString()]
        );
        res.status(201).json({ success: true, id });
    } catch (err) { res.status(500).json({ error: err.message }); }
});
app.delete('/api/products/:id', async (req, res) => {
    try {
        await executeQuery('DELETE FROM products WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============================================
// ORDERS
// ============================================
app.post('/api/orders', async (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const userId = await getUserIdFromToken(token);
    if (!userId) return res.status(401).json({ error: 'Please login' });
    const user = await executeGet('SELECT email FROM users WHERE id = ?', [userId]);
    const { items, subtotal, shipping, total, notes, paymentMethod, paymentId } = req.body;
    const orderId = uuidv4();
    await executeQuery(
        `INSERT INTO orders (order_id, user_id, user_email, items, subtotal, shipping, total, notes, status, payment_method, payment_id, payment_status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [orderId, userId, user.email, JSON.stringify(items), subtotal, shipping, total, notes, 'pending', paymentMethod || 'whatsapp', paymentId || null, paymentId ? 'paid' : 'pending', new Date().toISOString()]
    );
    res.json({ success: true, orderId });
});
app.get('/api/orders/:orderId', async (req, res) => {
    const order = await executeGet('SELECT * FROM orders WHERE order_id = ?', [req.params.orderId]);
    if (order && order.items) order.items = JSON.parse(order.items);
    res.json({ order });
});
app.get('/api/my-orders', async (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const userId = await getUserIdFromToken(token);
    if (!userId) return res.status(401).json({ error: 'Not logged in' });
    let orders = await executeAll('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC', [userId]);
    orders = orders.map(o => ({ ...o, items: o.items ? JSON.parse(o.items) : [] }));
    res.json({ success: true, orders });
});
app.get('/api/orders', async (req, res) => {
    let orders = await executeAll('SELECT * FROM orders ORDER BY created_at DESC');
    orders = orders.map(o => ({ ...o, items: o.items ? JSON.parse(o.items) : [] }));
    res.json(orders);
});

// ============================================
// REVIEWS
// ============================================
app.get('/api/products/:productId/reviews', async (req, res) => {
    const reviews = await executeAll('SELECT * FROM reviews WHERE product_id = ? ORDER BY created_at DESC', [req.params.productId]);
    res.json({ success: true, reviews });
});
app.post('/api/products/:productId/reviews', async (req, res) => {
    let token = req.headers.authorization?.replace('Bearer ', '');
    const userId = await getUserIdFromToken(token);
    if (!userId) return res.status(401).json({ error: 'Please login' });
    const user = await executeGet('SELECT name, email FROM users WHERE id = ?', [userId]);
    const { rating, comment } = req.body;
    const reviewId = uuidv4();
    await executeQuery(
        'INSERT INTO reviews (id, product_id, user_id, user_name, rating, comment, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [reviewId, req.params.productId, userId, user.name || user.email.split('@')[0], rating, comment || '', new Date().toISOString()]
    );
    res.json({ success: true });
});
app.get('/api/products/:productId/rating', async (req, res) => {
    const result = await executeGet('SELECT AVG(rating) as avg, COUNT(*) as cnt FROM reviews WHERE product_id = ?', [req.params.productId]);
    res.json({ averageRating: result?.avg || 0, totalReviews: result?.cnt || 0 });
});

// ============================================
// CHAT & NOTIFICATIONS
// ============================================
app.post('/api/chat/save', async (req, res) => {
    const { userId, userName, message, isAdmin } = req.body;
    await executeQuery('INSERT INTO chat_messages (user_id, user_name, message, is_admin) VALUES (?, ?, ?, ?)', [userId, userName, message, isAdmin ? 1 : 0]);
    res.json({ success: true });
});
app.get('/api/chat/history/:userId', async (req, res) => {
    const messages = await executeAll('SELECT * FROM chat_messages WHERE user_id = ? ORDER BY created_at ASC LIMIT 50', [req.params.userId]);
    res.json({ messages });
});
app.get('/api/admin/chats', async (req, res) => {
    const chats = await executeAll(`SELECT user_id, user_name, COUNT(*) as count, MAX(created_at) as last_message FROM chat_messages GROUP BY user_id ORDER BY last_message DESC`);
    res.json({ chats });
});
let lastProductUpdate = Date.now();
app.post('/api/notify-shop-refresh', (req, res) => { lastProductUpdate = Date.now(); res.json({ success: true }); });
app.get('/api/last-product-update', (req, res) => { res.json({ lastUpdate: lastProductUpdate }); });

// ============================================
// START SERVER
// ============================================
const server = require('http').createServer(app);
const socketIo = require('socket.io');
const io = socketIo(server, { cors: { origin: '*', methods: ['GET','POST'] } });
const connectedUsers = {};
io.on('connection', (socket) => {
    socket.on('user-join', (userId) => { connectedUsers[userId] = socket.id; });
    socket.on('admin-join', () => { socket.isAdmin = true; });
    socket.on('customer-message', (data) => { io.emit('new-message', { ...data, isAdmin: false }); });
    socket.on('admin-message', (data) => {
        const target = connectedUsers[data.userId];
        if (target) io.to(target).emit('new-message', { message: data.message, isAdmin: true });
    });
    socket.on('disconnect', () => {
        for (let uid in connectedUsers) if (connectedUsers[uid] === socket.id) delete connectedUsers[uid];
    });
});
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));