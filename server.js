const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// Ensure uploads directory exists
const uploadDir = './uploads';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer for profile picture uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'profile-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|gif/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'));
        }
    }
});

// Database setup
const db = new sqlite3.Database('./ecommerce.db');

// Promisify db.run and db.get
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
        // Users table with profile_picture column
        await executeQuery(`CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            email TEXT UNIQUE,
            name TEXT,
            password TEXT,
            profile_picture TEXT,
            created_at TEXT
        )`);
        console.log('Users table ready');
        
        // Add profile_picture column if missing (for existing databases)
        try {
            await executeQuery(`ALTER TABLE users ADD COLUMN profile_picture TEXT`);
            console.log('Added profile_picture column');
        } catch(e) {
            // Column already exists - ignore
            console.log('Profile picture column already exists');
        }
        
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

// ============= USER ROUTES =============

// Register user
app.post('/api/register', async (req, res) => {
    try {
        const { email, name, password } = req.body;
        
        // Check if user exists
        const existingUser = await executeGet('SELECT id FROM users WHERE email = ?', [email]);
        if (existingUser) {
            return res.status(400).json({ error: 'User already exists' });
        }
        
        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        const userId = uuidv4();
        const createdAt = new Date().toISOString();
        
        await executeQuery(
            'INSERT INTO users (id, email, name, password, created_at) VALUES (?, ?, ?, ?, ?)',
            [userId, email, name, hashedPassword, createdAt]
        );
        
        res.status(201).json({ message: 'User registered successfully', userId });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Login user
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        const user = await executeGet('SELECT * FROM users WHERE email = ?', [email]);
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        // Create session token
        const token = uuidv4();
        const expires = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days
        
        await executeQuery(
            'INSERT INTO sessions (token, user_id, expires) VALUES (?, ?, ?)',
            [token, user.id, expires]
        );
        
        res.json({
            token,
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

// Get user profile
app.get('/api/user/profile', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }
        
        const session = await executeGet('SELECT user_id FROM sessions WHERE token = ? AND expires > ?', [token, Date.now()]);
        if (!session) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }
        
        const user = await executeGet('SELECT id, email, name, profile_picture, created_at FROM users WHERE id = ?', [session.user_id]);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        res.json(user);
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ error: 'Failed to get profile' });
    }
});

// Update user profile
app.put('/api/user/profile', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }
        
        const session = await executeGet('SELECT user_id FROM sessions WHERE token = ? AND expires > ?', [token, Date.now()]);
        if (!session) {
            return res.status(401).json({ error: 'Invalid or expired token' });
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
        
        const updatedUser = await executeGet('SELECT id, email, name, profile_picture FROM users WHERE id = ?', [session.user_id]);
        res.json(updatedUser);
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

// Upload profile picture
app.post('/api/user/profile-picture', upload.single('profile_picture'), async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }
        
        const session = await executeGet('SELECT user_id FROM sessions WHERE token = ? AND expires > ?', [token, Date.now()]);
        if (!session) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }
        
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        
        const profilePicturePath = `/uploads/${req.file.filename}`;
        await executeQuery('UPDATE users SET profile_picture = ? WHERE id = ?', [profilePicturePath, session.user_id]);
        
        res.json({ 
            message: 'Profile picture uploaded successfully',
            profile_picture: profilePicturePath
        });
    } catch (error) {
        console.error('Upload profile picture error:', error);
        res.status(500).json({ error: 'Failed to upload profile picture' });
    }
});

// Logout
app.post('/api/logout', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (token) {
            await executeQuery('DELETE FROM sessions WHERE token = ?', [token]);
        }
        res.json({ message: 'Logged out successfully' });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ error: 'Logout failed' });
    }
});

// ============= PRODUCT ROUTES =============

// Get all products
app.get('/api/products', async (req, res) => {
    try {
        const products = await executeAll('SELECT * FROM products ORDER BY created_at DESC');
        res.json(products);
    } catch (error) {
        console.error('Get products error:', error);
        res.status(500).json({ error: 'Failed to get products' });
    }
});

// Get single product
app.get('/api/products/:id', async (req, res) => {
    try {
        const product = await executeGet('SELECT * FROM products WHERE id = ?', [req.params.id]);
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }
        res.json(product);
    } catch (error) {
        console.error('Get product error:', error);
        res.status(500).json({ error: 'Failed to get product' });
    }
});

// Create product (admin only - simplified for demo)
app.post('/api/products', async (req, res) => {
    try {
        const { name, price, category, image, stock } = req.body;
        const id = uuidv4();
        const createdAt = new Date().toISOString();
        
        await executeQuery(
            'INSERT INTO products (id, name, price, category, image, stock, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [id, name, price, category, image, stock, createdAt]
        );
        
        res.status(201).json({ message: 'Product created successfully', id });
    } catch (error) {
        console.error('Create product error:', error);
        res.status(500).json({ error: 'Failed to create product' });
    }
});

// Update product
app.put('/api/products/:id', async (req, res) => {
    try {
        const { name, price, category, image, stock } = req.body;
        const updates = [];
        const params = [];
        
        if (name) {
            updates.push('name = ?');
            params.push(name);
        }
        if (price) {
            updates.push('price = ?');
            params.push(price);
        }
        if (category) {
            updates.push('category = ?');
            params.push(category);
        }
        if (image) {
            updates.push('image = ?');
            params.push(image);
        }
        if (stock !== undefined) {
            updates.push('stock = ?');
            params.push(stock);
        }
        
        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }
        
        params.push(req.params.id);
        await executeQuery(`UPDATE products SET ${updates.join(', ')} WHERE id = ?`, params);
        
        res.json({ message: 'Product updated successfully' });
    } catch (error) {
        console.error('Update product error:', error);
        res.status(500).json({ error: 'Failed to update product' });
    }
});

// Delete product
app.delete('/api/products/:id', async (req, res) => {
    try {
        await executeQuery('DELETE FROM products WHERE id = ?', [req.params.id]);
        res.json({ message: 'Product deleted successfully' });
    } catch (error) {
        console.error('Delete product error:', error);
        res.status(500).json({ error: 'Failed to delete product' });
    }
});

// ============= ORDER ROUTES =============

// Create order
app.post('/api/orders', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }
        
        const session = await executeGet('SELECT user_id FROM sessions WHERE token = ? AND expires > ?', [token, Date.now()]);
        if (!session) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }
        
        const user = await executeGet('SELECT email, name FROM users WHERE id = ?', [session.user_id]);
        
        const { items, subtotal, shipping, total, notes, payment_method, payment_id } = req.body;
        const orderId = uuidv4();
        const createdAt = new Date().toISOString();
        
        await executeQuery(
            `INSERT INTO orders (order_id, user_id, user_email, items, subtotal, shipping, total, notes, status, payment_method, payment_id, payment_status, created_at) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [orderId, session.user_id, user.email, JSON.stringify(items), subtotal, shipping, total, notes, 'pending', payment_method, payment_id, 'pending', createdAt]
        );
        
        res.status(201).json({ message: 'Order created successfully', orderId });
    } catch (error) {
        console.error('Create order error:', error);
        res.status(500).json({ error: 'Failed to create order' });
    }
});

// Get user orders
app.get('/api/orders', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }
        
        const session = await executeGet('SELECT user_id FROM sessions WHERE token = ? AND expires > ?', [token, Date.now()]);
        if (!session) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }
        
        const orders = await executeAll('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC', [session.user_id]);
        // Parse items JSON for each order
        orders.forEach(order => {
            if (order.items) {
                order.items = JSON.parse(order.items);
            }
        });
        
        res.json(orders);
    } catch (error) {
        console.error('Get orders error:', error);
        res.status(500).json({ error: 'Failed to get orders' });
    }
});

// Get single order
app.get('/api/orders/:id', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }
        
        const session = await executeGet('SELECT user_id FROM sessions WHERE token = ? AND expires > ?', [token, Date.now()]);
        if (!session) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }
        
        const order = await executeGet('SELECT * FROM orders WHERE order_id = ? AND user_id = ?', [req.params.id, session.user_id]);
        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }
        
        if (order.items) {
            order.items = JSON.parse(order.items);
        }
        
        res.json(order);
    } catch (error) {
        console.error('Get order error:', error);
        res.status(500).json({ error: 'Failed to get order' });
    }
});

// ============= CHAT ROUTES =============

// Get chat messages
app.get('/api/chat/messages', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }
        
        const session = await executeGet('SELECT user_id FROM sessions WHERE token = ? AND expires > ?', [token, Date.now()]);
        if (!session) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }
        
        const messages = await executeAll('SELECT * FROM chat_messages ORDER BY created_at ASC LIMIT 100');
        res.json(messages);
    } catch (error) {
        console.error('Get messages error:', error);
        res.status(500).json({ error: 'Failed to get messages' });
    }
});

// Send chat message
app.post('/api/chat/messages', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }
        
        const session = await executeGet('SELECT user_id FROM sessions WHERE token = ? AND expires > ?', [token, Date.now()]);
        if (!session) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }
        
        const user = await executeGet('SELECT name FROM users WHERE id = ?', [session.user_id]);
        const { message } = req.body;
        
        if (!message || message.trim() === '') {
            return res.status(400).json({ error: 'Message cannot be empty' });
        }
        
        const result = await executeQuery(
            'INSERT INTO chat_messages (user_id, user_name, message, is_admin) VALUES (?, ?, ?, ?)',
            [session.user_id, user.name, message, 0]
        );
        
        res.status(201).json({ 
            id: result.lastID,
            user_id: session.user_id,
            user_name: user.name,
            message: message,
            is_admin: 0,
            created_at: new Date().toISOString()
        });
    } catch (error) {
        console.error('Send message error:', error);
        res.status(500).json({ error: 'Failed to send message' });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

module.exports = app;