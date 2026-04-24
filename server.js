const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Database path - FIXED for Render
const dbPath = path.join(process.cwd(), 'sigma_store.db');
console.log('Database path:', dbPath);

const db = new sqlite3.Database(dbPath);

// Create tables
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE,
        name TEXT,
        password TEXT,
        profile_picture TEXT,
        created_at TEXT
    )`, (err) => {
        if (err) console.error('Users table error:', err.message);
        else console.log('Users table ready');
    });
    
    db.run(`CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        name TEXT,
        price REAL,
        category TEXT,
        image TEXT,
        stock INTEGER,
        created_at TEXT
    )`, (err) => {
        if (err) console.error('Products table error:', err.message);
        else console.log('Products table ready');
    });
    
    db.run(`CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        user_id TEXT,
        expires INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
        if (err) console.error('Sessions table error:', err.message);
        else console.log('Sessions table ready');
    });
    
    db.run(`CREATE TABLE IF NOT EXISTS orders (
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
    )`, (err) => {
        if (err) console.error('Orders table error:', err.message);
        else console.log('Orders table ready');
    });
});

// ========== TEST ROUTE ==========
app.get('/api/test', (req, res) => {
    res.json({ 
        message: 'Backend is working with SQLite!',
        database: 'sqlite',
        status: 'online',
        time: new Date().toISOString()
    });
});

// ========== SIGNUP ==========
app.post('/api/signup', async (req, res) => {
    console.log('Signup request received:', req.body.email);
    
    try {
        const { email, password, name } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password required' });
        }
        
        // Check if user exists
        db.get('SELECT * FROM users WHERE email = ?', [email], async (err, existingUser) => {
            if (err) {
                console.error('Check user error:', err);
                return res.status(500).json({ error: 'Database error' });
            }
            
            if (existingUser) {
                return res.status(400).json({ error: 'Email already exists' });
            }
            
            const hashedPassword = await bcrypt.hash(password, 10);
            const userId = Date.now().toString();
            const userName = name || email.split('@')[0];
            
            db.run(
                `INSERT INTO users (id, email, name, password, created_at) VALUES (?, ?, ?, ?, ?)`,
                [userId, email, userName, hashedPassword, new Date().toISOString()],
                function(insertErr) {
                    if (insertErr) {
                        console.error('Insert error:', insertErr);
                        return res.status(500).json({ error: 'Failed to create user' });
                    }
                    
                    const token = userId + '_' + Date.now();
                    
                    res.json({
                        success: true,
                        user: { id: userId, email: email, name: userName },
                        token: token
                    });
                }
            );
        });
    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ error: 'Server error: ' + error.message });
    }
});

// ========== LOGIN ==========
app.post('/api/login', async (req, res) => {
    console.log('Login request received:', req.body.email);
    
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password required' });
        }
        
        db.get(`SELECT * FROM users WHERE email = ?`, [email], async (err, user) => {
            if (err) {
                console.error('Login DB error:', err);
                return res.status(500).json({ error: 'Database error' });
            }
            
            if (!user) {
                return res.status(401).json({ error: 'Invalid email or password' });
            }
            
            const validPassword = await bcrypt.compare(password, user.password);
            if (!validPassword) {
                return res.status(401).json({ error: 'Invalid email or password' });
            }
            
            const token = user.id + '_' + Date.now();
            
            // Save session
            db.run(`INSERT OR REPLACE INTO sessions (token, user_id, expires) VALUES (?, ?, ?)`,
                [token, user.id, Date.now() + 30 * 24 * 60 * 60 * 1000]);
            
            res.json({
                success: true,
                user: { id: user.id, email: user.email, name: user.name },
                token: token
            });
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ========== GET USER ==========
app.get('/api/me', (req, res) => {
    const token = req.headers.authorization;
    
    if (!token) {
        return res.status(401).json({ error: 'Not logged in' });
    }
    
    const userId = token.split('_')[0];
    
    db.get(`SELECT id, email, name, profile_picture FROM users WHERE id = ?`, [userId], (err, user) => {
        if (err || !user) {
            return res.status(401).json({ error: 'User not found' });
        }
        res.json({ user: user });
    });
});

// ========== PROFILE ==========
app.get('/api/profile', (req, res) => {
    const token = req.headers.authorization;
    
    if (!token) {
        return res.status(401).json({ error: 'Not logged in' });
    }
    
    const userId = token.split('_')[0];
    
    db.get(`SELECT id, email, name, profile_picture, created_at FROM users WHERE id = ?`, [userId], (err, user) => {
        if (err || !user) {
            return res.status(401).json({ error: 'User not found' });
        }
        res.json({ success: true, user: user });
    });
});

// ========== PRODUCTS ==========
app.get('/api/products', (req, res) => {
    db.all(`SELECT * FROM products ORDER BY created_at DESC`, (err, products) => {
        if (err) {
            console.error('Products error:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(products || []);
    });
});

// ========== START SERVER ==========
app.listen(PORT, () => {
    console.log(`========================================`);
    console.log(`SIGMA STORE BACKEND RUNNING`);
    console.log(`========================================`);
    console.log(`Port: ${PORT}`);
    console.log(`Test: https://sigma-store-api.onrender.com/api/test`);
    console.log(`========================================`);
});