require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'sigma123';

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

// Serve static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, 'admin')));
app.use('/admin', express.static(path.join(__dirname, 'admin')));
app.use(express.static(path.join(__dirname, 'frontend')));

// Ensure directories exist
const uploadsDir = path.join(__dirname, 'uploads');
const productsDir = path.join(uploadsDir, 'products');
const profilesDir = path.join(uploadsDir, 'profiles');
const adminDir = path.join(__dirname, 'admin');
const frontendDir = path.join(__dirname, 'frontend');

if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
if (!fs.existsSync(productsDir)) fs.mkdirSync(productsDir, { recursive: true });
if (!fs.existsSync(profilesDir)) fs.mkdirSync(profilesDir, { recursive: true });
if (!fs.existsSync(adminDir)) fs.mkdirSync(adminDir, { recursive: true });
if (!fs.existsSync(frontendDir)) fs.mkdirSync(frontendDir, { recursive: true });

console.log('Directories ready');

// ============================================
// DATABASE SETUP (SQLite)
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

// Create all tables and insert default data
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
        
        // Add profile_picture column if missing (for older databases)
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
            description TEXT,
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
        
        // Reviews table
        await executeQuery(`CREATE TABLE IF NOT EXISTS reviews (
            id TEXT PRIMARY KEY,
            product_id TEXT,
            user_id TEXT,
            user_name TEXT,
            rating INTEGER,
            comment TEXT,
            created_at TEXT
        )`);
        console.log('Reviews table ready');
        
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
        
        // Sellers table (multi-vendor)
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
        console.log('Sellers table ready');
        
        // Visitors table
        await executeQuery(`CREATE TABLE IF NOT EXISTS visitors (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT,
            user_name TEXT,
            user_email TEXT,
            ip_address TEXT,
            device TEXT,
            browser TEXT,
            page_visited TEXT,
            referrer TEXT,
            visited_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
        console.log('Visitors table ready');
        
        // Insert default products if table is empty
        const productCount = await executeGet('SELECT COUNT(*) as count FROM products');
        if (productCount.count === 0) {
            console.log('Adding default products...');
            const defaultProducts = [
                { id: 'p1', name: 'Wireless Headphones', price: 49.99, category: 'electronics', image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400', stock: 50, description: 'High-quality wireless headphones with noise cancellation.' },
                { id: 'p2', name: 'Smart Watch', price: 89.99, category: 'electronics', image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400', stock: 30, description: 'Fitness tracker with heart rate monitor and GPS.' },
                { id: 'p3', name: 'Premium Backpack', price: 79.99, category: 'accessories', image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400', stock: 25, description: 'Water-resistant laptop backpack with USB charging port.' },
                { id: 'p4', name: 'Coffee Maker', price: 129.99, category: 'home', image: 'https://images.unsplash.com/photo-1517668808822-9bba02b6f420?w=400', stock: 15, description: 'Programmable coffee maker with thermal carafe.' },
                { id: 'p5', name: 'Yoga Mat', price: 29.99, category: 'sports', image: 'https://images.unsplash.com/photo-1592432678016-e910b452f9a2?w=400', stock: 45, description: 'Non-slip eco-friendly yoga mat with carrying strap.' },
                { id: 'p6', name: 'Bluetooth Speaker', price: 59.99, category: 'electronics', image: 'https://images.unsplash.com/photo-1545454675-3531b543be5d?w=400', stock: 40, description: 'Portable waterproof speaker with 20-hour battery.' },
                { id: 'p7', name: 'Leather Wallet', price: 24.99, category: 'accessories', image: 'https://images.unsplash.com/photo-1627123424574-724758594e93?w=400', stock: 100, description: 'Genuine leather wallet with RFID blocking.' },
                { id: 'p8', name: 'Desk Lamp', price: 34.99, category: 'home', image: 'https://images.unsplash.com/photo-1507473885765-e6b057f7a2b2?w=400', stock: 60, description: 'LED desk lamp with wireless charging pad.' }
            ];
            for (const p of defaultProducts) {
                await executeQuery(
                    'INSERT INTO products (id, name, price, category, image, stock, description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                    [p.id, p.name, p.price, p.category, p.image, p.stock, p.description, new Date().toISOString()]
                );
            }
            console.log('Default products added');
        }
    } catch (error) {
        console.error('Database init error:', error.message);
    }
})();

// ============================================
// HELPER FUNCTIONS
// ============================================
function getUserIdFromToken(token) {
    if (!token) return null;
    const cleanToken = token.replace('Bearer ', '');
    return cleanToken;
}

async function getUserFromToken(token) {
    if (!token) return null;
    const cleanToken = token.replace('Bearer ', '');
    const session = await executeGet('SELECT user_id FROM sessions WHERE token = ? AND expires > ?', [cleanToken, Date.now()]);
    if (!session) return null;
    return session.user_id;
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
app.get('/admin.html', (req, res) => {
    const filePath = path.join(__dirname, 'admin', 'admin.html');
    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.status(404).send('Admin page not found');
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
    console.log('Signup request:', req.body.email);
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
        const userName = name || email.split('@')[0];
        const createdAt = new Date().toISOString();
        await executeQuery(
            'INSERT INTO users (id, email, name, password, created_at) VALUES (?, ?, ?, ?, ?)',
            [userId, email, userName, hashedPassword, createdAt]
        );
        const token = uuidv4();
        const expires = Date.now() + (10 * 365 * 24 * 60 * 60 * 1000); // 10 years
        await executeQuery('INSERT INTO sessions (token, user_id, expires) VALUES (?, ?, ?)', [token, userId, expires]);
        res.json({ success: true, token, user: { id: userId, email, name: userName } });
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
        await executeQuery('INSERT OR REPLACE INTO sessions (token, user_id, expires) VALUES (?, ?, ?)', [token, user.id, expires]);
        res.json({ success: true, token, user: { id: user.id, email: user.email, name: user.name, profile_picture: user.profile_picture } });
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
    const userId = await getUserFromToken(token);
    if (!userId) {
        return res.status(401).json({ error: 'Not logged in' });
    }
    const user = await executeGet('SELECT id, email, name, profile_picture FROM users WHERE id = ?', [userId]);
    if (!user) {
        return res.status(401).json({ error: 'User not found' });
    }
    res.json({ user });
});

// ============================================
// PROFILE ROUTES
// ============================================
app.get('/api/profile', async (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const userId = await getUserFromToken(token);
    if (!userId) {
        return res.status(401).json({ error: 'Not logged in' });
    }
    const user = await executeGet('SELECT id, email, name, profile_picture, created_at FROM users WHERE id = ?', [userId]);
    res.json({ success: true, user });
});

app.put('/api/profile', async (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const userId = await getUserFromToken(token);
    if (!userId) {
        return res.status(401).json({ error: 'Not logged in' });
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
        params.push(userId);
        await executeQuery(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
    }
    const user = await executeGet('SELECT id, email, name, profile_picture FROM users WHERE id = ?', [userId]);
    res.json({ success: true, user });
});

app.put('/api/change-password', async (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const userId = await getUserFromToken(token);
    if (!userId) {
        return res.status(401).json({ error: 'Not logged in' });
    }
    const { currentPassword, newPassword } = req.body;
    const user = await executeGet('SELECT password FROM users WHERE id = ?', [userId]);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const validPassword = await bcrypt.compare(currentPassword, user.password);
    if (!validPassword) {
        return res.status(401).json({ error: 'Current password is incorrect' });
    }
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await executeQuery('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, userId]);
    res.json({ success: true, message: 'Password changed successfully' });
});

// ============================================
// PROFILE PICTURE UPLOAD
// ============================================
const profileStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, profilesDir),
    filename: (req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'profile-' + unique + path.extname(file.originalname));
    }
});

const profileUpload = multer({
    storage: profileStorage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/jpg', 'image/gif', 'image/webp'];
        cb(null, allowed.includes(file.mimetype));
    }
});

app.post('/api/upload-profile-picture', profileUpload.single('profilePicture'), async (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const userId = await getUserFromToken(token);
    if (!userId) return res.status(401).json({ error: 'Not logged in' });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const url = '/uploads/profiles/' + req.file.filename;
    await executeQuery('UPDATE users SET profile_picture = ? WHERE id = ?', [url, userId]);
    res.json({ success: true, profilePicture: url });
});

app.get('/api/profile-picture', async (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const userId = await getUserFromToken(token);
    if (!userId) return res.status(401).json({ error: 'Not logged in' });
    const user = await executeGet('SELECT profile_picture FROM users WHERE id = ?', [userId]);
    res.json({ profilePicture: user?.profile_picture || null });
});

app.delete('/api/profile-picture', async (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const userId = await getUserFromToken(token);
    if (!userId) return res.status(401).json({ error: 'Not logged in' });
    await executeQuery('UPDATE users SET profile_picture = NULL WHERE id = ?', [userId]);
    res.json({ success: true });
});

// ============================================
// PRODUCT ROUTES (CRUD)
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

app.get('/api/products/:id', async (req, res) => {
    try {
        const product = await executeGet('SELECT * FROM products WHERE id = ?', [req.params.id]);
        if (!product) return res.status(404).json({ error: 'Product not found' });
        res.json(product);
    } catch (error) {
        console.error('Get product error:', error);
        res.status(500).json({ error: 'Failed to get product' });
    }
});

app.post('/api/products', async (req, res) => {
    try {
        const { name, price, category, image, stock, description } = req.body;
        if (!name || !price) {
            return res.status(400).json({ error: 'Name and price required' });
        }
        const id = uuidv4();
        const createdAt = new Date().toISOString();
        let productImage = image;
        if (!productImage) {
            productImage = `https://placehold.co/400x300/1a1a2e/white?text=${encodeURIComponent(name)}`;
        }
        await executeQuery(
            'INSERT INTO products (id, name, price, category, image, stock, description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [id, name, parseFloat(price), category || 'digital', productImage, stock || 999, description || '', createdAt]
        );
        console.log('Product saved to database:', name);
        res.status(201).json({ success: true, id });
    } catch (error) {
        console.error('Create product error:', error);
        res.status(500).json({ error: 'Failed to create product' });
    }
});

app.put('/api/products/:id', async (req, res) => {
    try {
        const { name, price, category, image, stock, description } = req.body;
        const updates = [];
        const params = [];
        if (name) { updates.push('name = ?'); params.push(name); }
        if (price) { updates.push('price = ?'); params.push(price); }
        if (category) { updates.push('category = ?'); params.push(category); }
        if (image) { updates.push('image = ?'); params.push(image); }
        if (stock !== undefined) { updates.push('stock = ?'); params.push(stock); }
        if (description) { updates.push('description = ?'); params.push(description); }
        if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
        params.push(req.params.id);
        await executeQuery(`UPDATE products SET ${updates.join(', ')} WHERE id = ?`, params);
        res.json({ success: true });
    } catch (error) {
        console.error('Update product error:', error);
        res.status(500).json({ error: 'Failed to update product' });
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
// ORDER ROUTES
// ============================================
app.post('/api/orders', async (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const userId = await getUserFromToken(token);
    if (!userId) return res.status(401).json({ error: 'Please login to place order' });
    const user = await executeGet('SELECT email FROM users WHERE id = ?', [userId]);
    const { items, subtotal, shipping, total, notes, paymentMethod, paymentId } = req.body;
    if (!items || items.length === 0) return res.status(400).json({ error: 'Cart is empty' });
    const orderId = uuidv4();
    const createdAt = new Date().toISOString();
    await executeQuery(
        `INSERT INTO orders (order_id, user_id, user_email, items, subtotal, shipping, total, notes, status, payment_method, payment_id, payment_status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [orderId, userId, user.email, JSON.stringify(items), subtotal || 0, shipping || 0, total || 0, notes || '', 'pending', paymentMethod || 'whatsapp', paymentId || null, paymentId ? 'paid' : 'pending', createdAt]
    );
    res.json({ success: true, orderId });
});

app.get('/api/orders/:orderId', async (req, res) => {
    const order = await executeGet('SELECT * FROM orders WHERE order_id = ?', [req.params.orderId]);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.items) order.items = JSON.parse(order.items);
    res.json({ order });
});

app.get('/api/my-orders', async (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const userId = await getUserFromToken(token);
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
// REVIEWS ROUTES
// ============================================
app.get('/api/products/:productId/reviews', async (req, res) => {
    const reviews = await executeAll('SELECT * FROM reviews WHERE product_id = ? ORDER BY created_at DESC', [req.params.productId]);
    res.json({ success: true, reviews });
});

app.post('/api/products/:productId/reviews', async (req, res) => {
    let token = req.headers.authorization?.replace('Bearer ', '');
    const userId = await getUserFromToken(token);
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
// SELLER ROUTES (Multi-Vendor)
// ============================================
app.post('/api/seller/apply', async (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const userId = await getUserFromToken(token);
    if (!userId) return res.status(401).json({ error: 'Not logged in' });
    const user = await executeGet('SELECT email FROM users WHERE id = ?', [userId]);
    const existing = await executeGet('SELECT id FROM sellers WHERE user_id = ?', [userId]);
    if (existing) return res.status(400).json({ error: 'Already applied' });
    const { storeName, storeDescription, category } = req.body;
    const sellerId = uuidv4();
    await executeQuery(
        'INSERT INTO sellers (id, user_id, user_email, store_name, store_description, category, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [sellerId, userId, user.email, storeName, storeDescription || '', category || 'general', 'pending', new Date().toISOString()]
    );
    res.json({ success: true });
});

app.get('/api/seller/dashboard', async (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const userId = await getUserFromToken(token);
    if (!userId) return res.status(401).json({ error: 'Not logged in' });
    const seller = await executeGet('SELECT * FROM sellers WHERE user_id = ?', [userId]);
    if (!seller) return res.status(404).json({ error: 'Not a seller' });
    const products = await executeAll('SELECT * FROM products WHERE seller_id = ?', [seller.id]);
    res.json({ seller, stats: { totalProducts: products.length, totalSales: seller.total_sales || 0, balance: seller.balance || 0 } });
});

// ============================================
// CHAT ROUTES (WebSocket + HTTP fallback)
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
        const messages = await executeAll('SELECT * FROM chat_messages WHERE user_id = ? ORDER BY created_at ASC LIMIT 50', [req.params.userId]);
        res.json({ messages });
    } catch (error) {
        console.error('History error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/admin/chats', async (req, res) => {
    try {
        const chats = await executeAll(
            `SELECT user_id, user_name, COUNT(*) as count, MAX(created_at) as last_message FROM chat_messages GROUP BY user_id ORDER BY last_message DESC`
        );
        res.json({ chats });
    } catch (error) {
        console.error('Admin chats error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// VISITOR TRACKING ROUTES
// ============================================
app.post('/api/visitor/track', async (req, res) => {
    try {
        const { user_id, user_name, user_email, page, referrer } = req.body;
        let ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
        ip = ip.replace('::ffff:', '');
        const userAgent = req.headers['user-agent'] || '';
        let browser = 'Unknown', device = 'Unknown';
        if (userAgent.includes('Chrome')) browser = 'Chrome';
        else if (userAgent.includes('Firefox')) browser = 'Firefox';
        else if (userAgent.includes('Safari')) browser = 'Safari';
        else if (userAgent.includes('Edge')) browser = 'Edge';
        if (userAgent.includes('Mobile')) device = 'Mobile';
        else if (userAgent.includes('Tablet')) device = 'Tablet';
        else device = 'Desktop';
        await executeQuery(
            `INSERT INTO visitors (user_id, user_name, user_email, ip_address, device, browser, page_visited, referrer, visited_at) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [user_id || null, user_name || 'Guest', user_email || null, ip, device, browser, page || '/', referrer || null, new Date().toISOString()]
        );
        res.json({ success: true });
    } catch (error) {
        console.error('Visitor track error:', error);
        res.json({ success: false });
    }
});

app.get('/api/admin/visitors', async (req, res) => {
    try {
        const visitors = await executeAll('SELECT * FROM visitors ORDER BY visited_at DESC LIMIT 100');
        res.json({ visitors });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/admin/visitors/stats', async (req, res) => {
    try {
        const total = await executeGet('SELECT COUNT(*) as count FROM visitors');
        const unique = await executeGet('SELECT COUNT(DISTINCT ip_address) as count FROM visitors');
        const today = await executeGet("SELECT COUNT(*) as count FROM visitors WHERE date(visited_at) = date('now')");
        const loggedIn = await executeGet("SELECT COUNT(DISTINCT user_id) as count FROM visitors WHERE user_id IS NOT NULL");
        res.json({ total: total?.count || 0, unique: unique?.count || 0, today: today?.count || 0, loggedIn: loggedIn?.count || 0 });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// NOTIFICATION FOR PRODUCT UPDATE
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
// SOCKET.IO (REAL-TIME CHAT)
// ============================================
const server = http.createServer(app);
const io = socketIo(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] }
});
const connectedUsers = {};

io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);
    socket.on('user-join', (userId) => {
        connectedUsers[userId] = socket.id;
        console.log('User joined:', userId);
    });
    socket.on('admin-join', () => {
        socket.isAdmin = true;
        console.log('Admin connected');
    });
    socket.on('customer-message', (data) => {
        console.log('Customer message from:', data.userId);
        io.emit('new-message', { ...data, isAdmin: false });
    });
    socket.on('admin-message', (data) => {
        const targetSocket = connectedUsers[data.userId];
        if (targetSocket) {
            io.to(targetSocket).emit('new-message', { message: data.message, isAdmin: true });
        }
    });
    socket.on('disconnect', () => {
        for (let uid in connectedUsers) {
            if (connectedUsers[uid] === socket.id) delete connectedUsers[uid];
        }
        console.log('Client disconnected:', socket.id);
    });
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
server.listen(PORT, () => {
    console.log('========================================');
    console.log('SIGMA STORE BACKEND RUNNING');
    console.log('========================================');
    console.log(`Port: ${PORT}`);
    console.log(`Test: http://localhost:${PORT}/api/test`);
    console.log(`Admin: http://localhost:${PORT}/admin.html`);
    console.log(`Admin Password: ${ADMIN_PASSWORD}`);
    console.log('========================================');
});
// ============================================
// COUPON ROUTES
// ============================================

app.post('/api/admin/coupons', async (req, res) => {
    const { code, type, value, minOrder, expiresAt, usageLimit } = req.body;
    const id = uuidv4();
    await executeQuery(
        'INSERT INTO coupons (id, code, type, value, min_order, expires_at, usage_limit, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [id, code.toUpperCase(), type, value, minOrder || 0, expiresAt || null, usageLimit || null, new Date().toISOString()]
    );
    res.json({ success: true });
});

app.get('/api/coupons/validate/:code', async (req, res) => {
    const code = req.params.code.toUpperCase();
    const coupon = await executeGet('SELECT * FROM coupons WHERE code = ?', [code]);
    if (!coupon) return res.json({ valid: false, error: 'Invalid coupon code' });
    if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) return res.json({ valid: false, error: 'Coupon expired' });
    if (coupon.usage_limit && coupon.used_count >= coupon.usage_limit) return res.json({ valid: false, error: 'Coupon usage limit reached' });
    res.json({ valid: true, coupon });
});

app.post('/api/coupons/apply', async (req, res) => {
    const { code, subtotal } = req.body;
    const coupon = await executeGet('SELECT * FROM coupons WHERE code = ?', [code.toUpperCase()]);
    if (!coupon) return res.status(400).json({ error: 'Invalid coupon' });
    if (coupon.min_order && subtotal -lt coupon.min_order) return res.status(400).json({ error: `Minimum order $${coupon.min_order} required` });
    let discount = 0;
    if (coupon.type === 'percentage') discount = (subtotal * coupon.value) / 100;
    else discount = coupon.value;
    if (discount -gt subtotal) discount = subtotal;
    res.json({ discount, finalTotal: subtotal - discount });
});


// ============================================
// COUPON ROUTES
// ============================================

app.post('/api/admin/coupons', async (req, res) => {
    const { code, type, value, minOrder, expiresAt, usageLimit } = req.body;
    const id = uuidv4();
    await executeQuery(
        'INSERT INTO coupons (id, code, type, value, min_order, expires_at, usage_limit, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [id, code.toUpperCase(), type, value, minOrder || 0, expiresAt || null, usageLimit || null, new Date().toISOString()]
    );
    res.json({ success: true });
});

app.get('/api/coupons/validate/:code', async (req, res) => {
    const code = req.params.code.toUpperCase();
    const coupon = await executeGet('SELECT * FROM coupons WHERE code = ?', [code]);
    if (!coupon) return res.json({ valid: false, error: 'Invalid coupon code' });
    if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) return res.json({ valid: false, error: 'Coupon expired' });
    if (coupon.usage_limit && coupon.used_count >= coupon.usage_limit) return res.json({ valid: false, error: 'Coupon usage limit reached' });
    res.json({ valid: true, coupon });
});

app.post('/api/coupons/apply', async (req, res) => {
    const { code, subtotal } = req.body;
    const coupon = await executeGet('SELECT * FROM coupons WHERE code = ?', [code.toUpperCase()]);
    if (!coupon) return res.status(400).json({ error: 'Invalid coupon' });
    if (coupon.min_order && subtotal < coupon.min_order) return res.status(400).json({ error: `Minimum order $${coupon.min_order} required` });
    let discount = 0;
    if (coupon.type === 'percentage') discount = (subtotal * coupon.value) / 100;
    else discount = coupon.value;
    if (discount > subtotal) discount = subtotal;
    res.json({ discount, finalTotal: subtotal - discount });
});

// ============================================ 
// COUPON ROUTES 
// ============================================ 
app.post('/api/admin/coupons', async (req, res) => { 
    const { code, type, value, minOrder, expiresAt, usageLimit } = req.body; 
    const id = uuidv4(); 
    await executeQuery( 
        'INSERT INTO coupons (id, code, type, value, min_order, expires_at, usage_limit, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', 
        [id, code.toUpperCase(), type, value, minOrder || 0, expiresAt || null, usageLimit || null, new Date().toISOString()] 
    ); 
    res.json({ success: true }); 
}); 
 
app.get('/api/coupons/validate/:code', async (req, res) => { 
    const code = req.params.code.toUpperCase(); 
    const coupon = await executeGet('SELECT * FROM coupons WHERE code = ?', [code]); 
    if (!coupon) return res.json({ valid: false, error: 'Invalid coupon code' }); 
    res.json({ valid: true, coupon }); 
}); 
 
app.post('/api/coupons/apply', async (req, res) => { 
    const { code, subtotal } = req.body; 
    const coupon = await executeGet('SELECT * FROM coupons WHERE code = ?', [code.toUpperCase()]); 
    if (!coupon) return res.status(400).json({ error: 'Invalid coupon' }); 
    let discount = 0; 
    if (coupon.type === 'percentage') discount = (subtotal * coupon.value) / 100; 
    else discount = coupon.value; 
    if (discount > subtotal) discount = subtotal; 
    res.json({ discount, finalTotal: subtotal - discount }); 
}); 
