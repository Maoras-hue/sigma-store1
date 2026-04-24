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
// ============================================
// PROFILE PICTURE UPLOAD
// ============================================

// Configure multer for profile pictures
const multer = require('multer');

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

// Upload profile picture
// Upload profile picture
app.post('/api/upload-profile-picture', profileUpload.single('profilePicture'), async (req, res) => {
    console.log('Upload request received');
    
    try {
        const token = req.headers.authorization;
        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }
        
        const userId = token.split('_')[0];
        console.log('User ID:', userId);
        
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        
        console.log('File saved:', req.file.filename);
        
        const profilePictureUrl = '/uploads/profiles/' + req.file.filename;
        
        // Update the database
        db.run(`UPDATE users SET profile_picture = ? WHERE id = ?`, [profilePictureUrl, userId], function(err) {
            if (err) {
                console.error('DB update error:', err);
                return res.status(500).json({ error: 'Database error: ' + err.message });
            }
            
            console.log('Database updated for user:', userId);
            console.log('Rows affected:', this.changes);
            
            res.json({ 
                success: true, 
                profilePicture: profilePictureUrl,
                message: 'Profile picture updated successfully'
            });
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: error.message });
    }
});
// Get profile picture
app.get('/api/profile-picture', (req, res) => {
    const token = req.headers.authorization;
    
    if (!token) {
        return res.status(401).json({ error: 'Not logged in' });
    }
    
    const userId = token.split('_')[0];
    
    db.get(`SELECT profile_picture FROM users WHERE id = ?`, [userId], (err, user) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        
        res.json({ 
            profilePicture: user?.profile_picture || null,
            hasPicture: !!(user?.profile_picture)
        });
    });
});

// Delete profile picture
app.delete('/api/profile-picture', (req, res) => {
    const token = req.headers.authorization;
    
    if (!token) {
        return res.status(401).json({ error: 'Not logged in' });
    }
    
    const userId = token.split('_')[0];
    
    // Get current picture to delete file
    db.get(`SELECT profile_picture FROM users WHERE id = ?`, [userId], (err, user) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        
        if (user?.profile_picture) {
            const filePath = path.join(__dirname, user.profile_picture);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }
        
        db.run(`UPDATE users SET profile_picture = NULL WHERE id = ?`, [userId], function(updateErr) {
            if (updateErr) {
                return res.status(500).json({ error: 'Database error' });
            }
            
            res.json({ success: true, message: 'Profile picture removed' });
        });
    });
});

// ============================================
// PROFILE API ENDPOINTS
// ============================================

// Get user profile
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

// Update user profile
app.put('/api/profile', (req, res) => {
    const token = req.headers.authorization;
    
    if (!token) {
        return res.status(401).json({ error: 'Not logged in' });
    }
    
    const userId = token.split('_')[0];
    const { name, email } = req.body;
    
    let updates = [];
    let values = [];
    
    if (name) {
        updates.push('name = ?');
        values.push(name);
    }
    if (email) {
        updates.push('email = ?');
        values.push(email);
    }
    
    if (updates.length === 0) {
        return res.status(400).json({ error: 'Nothing to update' });
    }
    
    values.push(userId);
    
    db.run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values, function(err) {
        if (err) {
            console.error('Update error:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        
        db.get(`SELECT id, email, name, profile_picture FROM users WHERE id = ?`, [userId], (err, user) => {
            res.json({ success: true, user: user });
        });
    });
});

// Change password
app.put('/api/change-password', async (req, res) => {
    const token = req.headers.authorization;
    
    if (!token) {
        return res.status(401).json({ error: 'Not logged in' });
    }
    
    const userId = token.split('_')[0];
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Current password and new password required' });
    }
    
    if (newPassword.length < 6) {
        return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }
    
    db.get(`SELECT password FROM users WHERE id = ?`, [userId], async (err, user) => {
        if (err || !user) {
            return res.status(401).json({ error: 'User not found' });
        }
        
        const validPassword = await bcrypt.compare(currentPassword, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Current password is incorrect' });
        }
        
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        
        db.run(`UPDATE users SET password = ? WHERE id = ?`, [hashedPassword, userId], function(updateErr) {
            if (updateErr) {
                return res.status(500).json({ error: 'Database error' });
            }
            res.json({ success: true, message: 'Password changed successfully' });
        });
    });
});

// Get user orders
app.get('/api/my-orders', (req, res) => {
    const token = req.headers.authorization;
    
    if (!token) {
        return res.status(401).json({ error: 'Not logged in' });
    }
    
    const userId = token.split('_')[0];
    
    db.all(`SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC`, [userId], (err, orders) => {
        if (err) {
            console.error('Orders error:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        
        // Parse items JSON for each order
        for (let i = 0; i < orders.length; i++) {
            if (orders[i].items && typeof orders[i].items === 'string') {
                try {
                    orders[i].items = JSON.parse(orders[i].items);
                } catch(e) {
                    orders[i].items = [];
                }
            }
        }
        
        res.json({ success: true, orders: orders || [] });
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