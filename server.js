require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcrypt');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { connectDB, executeQuery, insertOne, findOne, findAll, updateOne, deleteOne, DB_TYPE } = require('./config/db');

// Try to load socket.io (optional)
let socketIo;
try {
    socketIo = require('socket.io');
} catch(e) {
    console.log('Socket.io not available, chat feature disabled');
    socketIo = null;
}

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'sigma123';

// ============================================
// MIDDLEWARE
// ============================================
app.use(cors({
    origin: '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(cookieParser());
app.use('/uploads', express.static('uploads'));
app.use('/admin', express.static(path.join(__dirname, 'admin')));
app.use(express.static('admin'));
app.use(express.static('frontend'));

// Create necessary directories
const dirs = ['./uploads', './uploads/profiles', './admin'];
for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log('Created directory:', dir);
    }
}

// ============================================
// DATABASE CONNECTION & TABLE CREATION
// ============================================
connectDB();

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
// SESSION FUNCTIONS - DATABASE BASED
// ============================================

async function saveSession(token, userId, expires) {
    try {
        await executeQuery(
            'INSERT OR REPLACE INTO sessions (token, user_id, expires) VALUES (?, ?, ?)',
            [token, userId, expires]
        );
        console.log('Session saved for user:', userId);
    } catch (error) {
        console.error('Save session error:', error);
    }
}

async function getUserFromToken(token) {
    if (!token) return null;
    
    try {
        const sessions = await executeQuery(
            'SELECT * FROM sessions WHERE token = ? AND expires > ?',
            [token, Date.now()]
        );
        
        if (sessions.length === 0) return null;
        
        return { userId: sessions[0].user_id };
    } catch (error) {
        console.error('Get user from token error:', error);
        return null;
    }
}

async function deleteSession(token) {
    try {
        await executeQuery('DELETE FROM sessions WHERE token = ?', [token]);
    } catch (error) {
        console.error('Delete session error:', error);
    }
}

async function cleanExpiredSessions() {
    try {
        const result = await executeQuery('DELETE FROM sessions WHERE expires < ?', [Date.now()]);
        console.log('Cleaned expired sessions');
    } catch (error) {
        console.error('Clean sessions error:', error);
    }
}

// Run cleanup every hour
setInterval(cleanExpiredSessions, 60 * 60 * 1000);

// ============================================
// TEST ROUTE
// ============================================
app.get('/api/test', (req, res) => {
    res.json({ 
        message: 'Backend is working with ' + (DB_TYPE === 'mysql' ? 'MySQL' : 'SQLite') + '!',
        database: DB_TYPE,
        status: 'online'
    });
});

// ============================================
// AUTH ROUTES
// ============================================

app.post('/api/signup', async (req, res) => {
    try {
        const { email, password, name, remember } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password required' });
        }
        
        const existing = await findOne('users', 'email', email);
        if (existing) {
            return res.status(400).json({ error: 'Email already exists' });
        }
        
        const hashedPassword = await bcrypt.hash(password, 10);
        const userId = Date.now().toString();
        const userName = name || email.split('@')[0];
        
        await insertOne('users', {
            id: userId,
            email: email,
            name: userName,
            password: hashedPassword,
            profile_picture: null,
            created_at: new Date().toISOString()
        });
        
        const token = userId + '_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        const expiryDays = remember ? 30 : 7;
        const expires = Date.now() + (expiryDays * 24 * 60 * 60 * 1000);
        
        await saveSession(token, userId, expires);
        
        res.json({
            success: true,
            user: { id: userId, email: email, name: userName },
            token: token
        });
    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { email, password, remember } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password required' });
        }
        
        const user = await findOne('users', 'email', email);
        
        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        
        const token = user.id + '_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        const expiryDays = remember ? 30 : 7;
        const expires = Date.now() + (expiryDays * 24 * 60 * 60 * 1000);
        
        await saveSession(token, user.id, expires);
        
        res.json({
            success: true,
            user: { id: user.id, email: user.email, name: user.name },
            token: token
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/logout', async (req, res) => {
    const token = req.headers.authorization;
    if (token) {
        await deleteSession(token);
    }
    res.json({ success: true });
});

app.get('/api/me', async (req, res) => {
    const token = req.headers.authorization;
    const session = await getUserFromToken(token);
    
    if (!session) {
        return res.status(401).json({ error: 'Not logged in' });
    }
    
    const user = await findOne('users', 'id', session.userId);
    
    if (!user) {
        return res.status(401).json({ error: 'User not found' });
    }
    
    res.json({ user: { id: user.id, email: user.email, name: user.name, profile_picture: user.profile_picture } });
});

// ============================================
// PROFILE ROUTES
// ============================================

app.get('/api/profile', async (req, res) => {
    try {
        const token = req.headers.authorization;
        const session = await getUserFromToken(token);
        
        if (!session) {
            return res.status(401).json({ error: 'Not logged in' });
        }
        
        const user = await findOne('users', 'id', session.userId);
        
        res.json({
            success: true,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                profile_picture: user.profile_picture,
                created_at: user.created_at
            }
        });
    } catch (error) {
        console.error('Profile error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.put('/api/profile', async (req, res) => {
    try {
        const token = req.headers.authorization;
        const session = await getUserFromToken(token);
        
        if (!session) {
            return res.status(401).json({ error: 'Not logged in' });
        }
        
        const { name, email } = req.body;
        const updates = {};
        if (name) updates.name = name;
        if (email) updates.email = email;
        
        await updateOne('users', session.userId, 'id', updates);
        
        const updatedUser = await findOne('users', 'id', session.userId);
        
        res.json({
            success: true,
            user: {
                id: updatedUser.id,
                name: updatedUser.name,
                email: updatedUser.email
            }
        });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.put('/api/change-password', async (req, res) => {
    try {
        const token = req.headers.authorization;
        const session = await getUserFromToken(token);
        
        if (!session) {
            return res.status(401).json({ error: 'Not logged in' });
        }
        
        const { currentPassword, newPassword } = req.body;
        
        const user = await findOne('users', 'id', session.userId);
        
        const validPassword = await bcrypt.compare(currentPassword, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Current password is incorrect' });
        }
        
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await updateOne('users', session.userId, 'id', { password: hashedPassword });
        
        res.json({ success: true, message: 'Password changed successfully' });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ============================================
// PROFILE PICTURE ROUTES
// ============================================

// Configure multer for profile pictures
const profileStorage = multer.diskStorage({
    destination: function(req, file, cb) {
        const profileDir = path.join(__dirname, 'uploads', 'profiles');
        if (!fs.existsSync(profileDir)) {
            fs.mkdirSync(profileDir, { recursive: true });
        }
        cb(null, profileDir);
    },
    filename: function(req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'profile-' + uniqueSuffix + ext);
    }
});

const profileUpload = multer({ 
    storage: profileStorage,
    limits: { fileSize: 2 * 1024 * 1024 },
    fileFilter: function(req, file, cb) {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/gif', 'image/webp'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Only images allowed'));
        }
    }
});

app.post('/api/upload-profile-picture', profileUpload.single('profilePicture'), async (req, res) => {
    try {
        const token = req.headers.authorization;
        const session = await getUserFromToken(token);
        
        if (!session) {
            return res.status(401).json({ error: 'Not logged in' });
        }
        
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        
        const profilePictureUrl = '/uploads/profiles/' + req.file.filename;
        
        await updateOne('users', session.userId, 'id', { profile_picture: profilePictureUrl });
        
        res.json({ 
            success: true, 
            profilePicture: profilePictureUrl,
            message: 'Profile picture updated successfully'
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/profile-picture', async (req, res) => {
    try {
        const token = req.headers.authorization;
        const session = await getUserFromToken(token);
        
        if (!session) {
            return res.status(401).json({ error: 'Not logged in' });
        }
        
        const user = await findOne('users', 'id', session.userId);
        
        res.json({ 
            profilePicture: user?.profile_picture || null,
            hasPicture: !!(user?.profile_picture)
        });
    } catch (error) {
        console.error('Get profile picture error:', error);
        res.status(500).json({ error: 'Failed to get profile picture' });
    }
});

app.delete('/api/profile-picture', async (req, res) => {
    try {
        const token = req.headers.authorization;
        const session = await getUserFromToken(token);
        
        if (!session) {
            return res.status(401).json({ error: 'Not logged in' });
        }
        
        const user = await findOne('users', 'id', session.userId);
        if (user?.profile_picture) {
            const filePath = path.join(__dirname, user.profile_picture);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }
        
        await updateOne('users', session.userId, 'id', { profile_picture: null });
        
        res.json({ success: true, message: 'Profile picture removed' });
    } catch (error) {
        console.error('Delete error:', error);
        res.status(500).json({ error: 'Failed to delete profile picture' });
    }
});

// ============================================
// ORDER ROUTES
// ============================================

app.get('/api/my-orders', async (req, res) => {
    try {
        const token = req.headers.authorization;
        const session = await getUserFromToken(token);
        
        if (!session) {
            return res.status(401).json({ error: 'Not logged in' });
        }
        
        const orders = await executeQuery(
            'SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC',
            [session.userId]
        );
        
        for (let order of orders) {
            if (order.items && typeof order.items === 'string') {
                order.items = JSON.parse(order.items);
            }
        }
        
        res.json({ success: true, orders: orders || [] });
    } catch (error) {
        console.error('My orders error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/orders', async (req, res) => {
    try {
        const token = req.headers.authorization;
        const session = await getUserFromToken(token);
        
        if (!session) {
            return res.status(401).json({ error: 'Please login to place order' });
        }
        
        const { items, subtotal, shipping, total, notes, paymentMethod, paymentId } = req.body;
        
        if (!items || items.length === 0) {
            return res.status(400).json({ error: 'Cart is empty' });
        }
        
        const user = await findOne('users', 'id', session.userId);
        const orderId = 'ORD' + Date.now();
        
        await insertOne('orders', {
            order_id: orderId,
            user_id: session.userId,
            user_email: user.email,
            items: JSON.stringify(items),
            subtotal: subtotal || 0,
            shipping: shipping || 0,
            total: total || 0,
            notes: notes || '',
            status: 'pending',
            payment_method: paymentMethod || 'whatsapp',
            payment_id: paymentId || null,
            payment_status: paymentId ? 'paid' : 'pending',
            created_at: new Date().toISOString()
        });
        
        res.json({ success: true, order: { orderId: orderId, total: total } });
    } catch (error) {
        console.error('Error creating order:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/orders/:orderId', async (req, res) => {
    try {
        const order = await findOne('orders', 'order_id', req.params.orderId);
        if (!order) return res.status(404).json({ error: 'Order not found' });
        if (order.items && typeof order.items === 'string') {
            order.items = JSON.parse(order.items);
        }
        res.json({ order: order });
    } catch (error) {
        console.error('Error fetching order:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ============================================
// PRODUCT ROUTES
// ============================================

app.get('/api/products', async (req, res) => {
    try {
        const products = await findAll('products');
        res.json(products);
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

const storage = multer.diskStorage({
    destination: function(req, file, cb) { cb(null, 'uploads/'); },
    filename: function(req, file, cb) { cb(null, Date.now() + '-' + file.originalname); }
});
const upload = multer({ storage: storage, limits: { fileSize: 5 * 1024 * 1024 } });

app.post('/api/products', upload.single('image'), async (req, res) => {
    try {
        const { name, price, category, stock, imageUrl } = req.body;
        
        if (!name || !price) {
            return res.status(400).json({ error: 'Name and price required' });
        }
        
        const productId = 'p' + Date.now();
        let image = req.file ? req.file.filename : (imageUrl || null);
        
        await insertOne('products', {
            id: productId,
            name: name,
            price: parseFloat(price),
            category: category || 'digital',
            image: image,
            stock: stock || 999,
            created_at: new Date().toISOString()
        });
        
        res.json({ success: true, product: { id: productId, name: name, price: price } });
    } catch (error) {
        console.error('Error adding product:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.delete('/api/products/:id', async (req, res) => {
    try {
        await deleteOne('products', 'id', req.params.id);
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting product:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ============================================
// ADMIN ROUTES
// ============================================

app.post('/api/admin/login', (req, res) => {
    const { password } = req.body;
    if (password === ADMIN_PASSWORD) {
        res.json({ success: true });
    } else {
        res.status(401).json({ error: 'Wrong password' });
    }
});

app.get('/api/admin/orders', async (req, res) => {
    try {
        const orders = await findAll('orders');
        for (let order of orders) {
            if (order.items && typeof order.items === 'string') {
                order.items = JSON.parse(order.items);
            }
        }
        res.json({ orders: orders });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
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
        const messages = await executeQuery(
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
        const chats = await executeQuery(
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
// CREATE HTTP SERVER FOR SOCKET.IO
// ============================================

const server = http.createServer(app);
let io = null;

if (socketIo) {
    io = socketIo(server, {
        cors: {
            origin: '*',
            methods: ['GET', 'POST']
        }
    });
    
    const connectedUsers = {};
    
    io.on('connection', (socket) => {
        console.log('Client connected:', socket.id);
        
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
            io.emit('new-message', {
                userId: data.userId,
                userName: data.userName,
                message: data.message,
                timestamp: new Date().toISOString(),
                isAdmin: false
            });
        });
        
        socket.on('admin-message', (data) => {
            console.log('Admin message to:', data.userId);
            const customerSocketId = connectedUsers[data.userId];
            if (customerSocketId) {
                io.to(customerSocketId).emit('new-message', {
                    message: data.message,
                    timestamp: new Date().toISOString(),
                    isAdmin: true
                });
            }
        });
        
        socket.on('disconnect', () => {
            console.log('Client disconnected:', socket.id);
            for (let userId in connectedUsers) {
                if (connectedUsers[userId] === socket.id) {
                    delete connectedUsers[userId];
                    break;
                }
            }
        });
    });
    
    console.log('Socket.io enabled');
} else {
    console.log('Socket.io not available - chat feature disabled');
}

// ============================================
// START SERVER
// ============================================

server.listen(PORT, () => {
    console.log('========================================');
    console.log('SIGMA STORE IS RUNNING!');
    console.log('========================================');
    console.log('Server: http://localhost:' + PORT);
    console.log('Test: http://localhost:' + PORT + '/api/test');
    console.log('Admin: http://localhost:' + PORT + '/admin.html');
    console.log('Chat: http://localhost:' + PORT + '/admin/chat.html');
    console.log('Database: ' + (DB_TYPE === 'mysql' ? 'MySQL' : 'SQLite'));
    console.log('Socket.io: ' + (socketIo ? 'Enabled' : 'Disabled'));
    console.log('Sessions: Database based');
    console.log('========================================');
});