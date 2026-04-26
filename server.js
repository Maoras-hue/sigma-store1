require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { connectDB, executeQuery, insertOne, findOne, findAll, updateOne, deleteOne, DB_TYPE } = require('./config/db');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'sigma123';

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use('/uploads', express.static('uploads'));

// Create uploads folder
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

// Sessions storage
const sessions = {};

// ============================================
// CONNECT TO DATABASE
// ============================================
connectDB();

// ============================================
// HELPER FUNCTIONS
// ============================================
function getUserFromToken(token) {
    if (!token || !sessions[token]) return null;
    if (sessions[token].expires < Date.now()) {
        delete sessions[token];
        return null;
    }
    return sessions[token];
}

// ============================================
// TEST ROUTE
// ============================================
app.get('/api/test', (req, res) => {
    res.json({ 
        message: `Backend is working with ${DB_TYPE === 'mysql' ? 'MySQL' : 'SQLite'}!`,
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
            password: hashedPassword
        });
        
        const token = Date.now().toString() + Math.random();
        const expiryDays = remember ? 30 : 7;
        sessions[token] = {
            userId: userId,
            expires: Date.now() + (expiryDays * 24 * 60 * 60 * 1000)
        };
        
        res.json({
            success: true,
            user: { id: userId, email, name: userName },
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
        
        const token = Date.now().toString() + Math.random();
        const expiryDays = remember ? 30 : 7;
        sessions[token] = {
            userId: user.id,
            expires: Date.now() + (expiryDays * 24 * 60 * 60 * 1000)
        };
        
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

app.post('/api/logout', (req, res) => {
    const token = req.headers.authorization;
    if (token && sessions[token]) {
        delete sessions[token];
    }
    res.json({ success: true });
});

app.get('/api/me', async (req, res) => {
    const token = req.headers.authorization;
    const session = getUserFromToken(token);
    
    if (!session) {
        return res.status(401).json({ error: 'Not logged in' });
    }
    
    const user = await findOne('users', 'id', session.userId);
    
    if (!user) {
        return res.status(401).json({ error: 'User not found' });
    }
    
    res.json({ user: { id: user.id, email: user.email, name: user.name } });
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

// Image upload setup
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ 
    storage,
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/gif'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Only images allowed'));
        }
    }
});

app.post('/api/products', upload.single('image'), async (req, res) => {
    try {
        const productId = 'p' + Date.now();
        const { name, price, category, stock } = req.body;
        const image = req.file ? req.file.filename : null;
        
        if (!name || !price) {
            return res.status(400).json({ error: 'Name and price required' });
        }
        
        await insertOne('products', {
            id: productId,
            name: name,
            price: parseFloat(price),
            category: category || 'digital',
            image: image,
            stock: stock || 999
        });
        
        res.json({ success: true, product: { id: productId, name, price, category, image } });
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
// SELLER ROUTES
// ============================================

app.post('/api/seller/apply', async (req, res) => {
    try {
        const token = req.headers.authorization;
        const session = getUserFromToken(token);
        
        if (!session) {
            return res.status(401).json({ error: 'Not logged in' });
        }
        
        const { storeName, storeDescription, category } = req.body;
        
        if (!storeName) {
            return res.status(400).json({ error: 'Store name required' });
        }
        
        const user = await findOne('users', 'id', session.userId);
        const existing = await findOne('sellers', 'user_id', session.userId);
        
        if (existing) {
            return res.status(400).json({ error: 'Already applied' });
        }
        
        const sellerId = 'seller' + Date.now();
        
        await insertOne('sellers', {
            id: sellerId,
            user_id: session.userId,
            user_email: user.email,
            store_name: storeName,
            store_description: storeDescription || '',
            category: category || 'general',
            status: 'pending'
        });
        
        res.json({ success: true, seller: { id: sellerId, storeName, status: 'pending' } });
    } catch (error) {
        console.error('Error applying as seller:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/seller/dashboard', async (req, res) => {
    try {
        const token = req.headers.authorization;
        const session = getUserFromToken(token);
        
        if (!session) {
            return res.status(401).json({ error: 'Not logged in' });
        }
        
        const seller = await findOne('sellers', 'user_id', session.userId);
        
        if (!seller) {
            return res.status(404).json({ error: 'Not a seller' });
        }
        
        const products = await findAll('products', 'seller_id', seller.id);
        
        res.json({
            seller: seller,
            stats: {
                totalProducts: products.length,
                totalOrders: 0,
                totalSales: seller.total_sales || 0,
                balance: seller.balance || 0
            }
        });
    } catch (error) {
        console.error('Error fetching seller dashboard:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/seller/products', async (req, res) => {
    try {
        const token = req.headers.authorization;
        const session = getUserFromToken(token);
        
        if (!session) {
            return res.status(401).json({ error: 'Not logged in' });
        }
        
        const seller = await findOne('sellers', 'user_id', session.userId);
        
        if (!seller || seller.status !== 'approved') {
            return res.status(403).json({ error: 'Not an approved seller' });
        }
        
        const products = await findAll('products', 'seller_id', seller.id);
        res.json({ products });
    } catch (error) {
        console.error('Error fetching seller products:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/seller/products', upload.single('image'), async (req, res) => {
    try {
        const token = req.headers.authorization;
        const session = getUserFromToken(token);
        
        if (!session) {
            return res.status(401).json({ error: 'Not logged in' });
        }
        
        const seller = await findOne('sellers', 'user_id', session.userId);
        
        if (!seller || seller.status !== 'approved') {
            return res.status(403).json({ error: 'Not an approved seller' });
        }
        
        const productId = 'p' + Date.now();
        const { name, price, category, stock, description } = req.body;
        const image = req.file ? req.file.filename : null;
        
        if (!name || !price) {
            return res.status(400).json({ error: 'Name and price required' });
        }
        
        await insertOne('products', {
            id: productId,
            name: name,
            price: parseFloat(price),
            category: category || 'digital',
            image: image,
            stock: stock || 999,
            seller_id: seller.id,
            description: description || ''
        });
        
        res.json({ success: true, product: { id: productId, name, price } });
    } catch (error) {
        console.error('Error adding seller product:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.delete('/api/seller/products/:id', async (req, res) => {
    try {
        const token = req.headers.authorization;
        const session = getUserFromToken(token);
        
        if (!session) {
            return res.status(401).json({ error: 'Not logged in' });
        }
        
        const seller = await findOne('sellers', 'user_id', session.userId);
        
        if (!seller) {
            return res.status(403).json({ error: 'Not a seller' });
        }
        
        await deleteOne('products', 'id', req.params.id);
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting seller product:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ============================================
// ORDER ROUTES
// ============================================

app.post('/api/orders', async (req, res) => {
    try {
        const token = req.headers.authorization;
        const session = getUserFromToken(token);
        
        if (!session) {
            return res.status(401).json({ error: 'Not logged in' });
        }
        
        const { items, subtotal, shipping, total, notes } = req.body;
        
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
            status: 'pending'
        });
        
        res.json({ success: true, order: { orderId, total } });
    } catch (error) {
        console.error('Error creating order:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/orders/:orderId', async (req, res) => {
    try {
        const order = await findOne('orders', 'order_id', req.params.orderId);
        
        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }
        
        if (order.items && typeof order.items === 'string') {
            order.items = JSON.parse(order.items);
        }
        
        res.json({ order });
    } catch (error) {
        console.error('Error fetching order:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/myorders', async (req, res) => {
    try {
        const token = req.headers.authorization;
        const session = getUserFromToken(token);
        
        if (!session) {
            return res.status(401).json({ error: 'Not logged in' });
        }
        
        const orders = await findAll('orders', 'user_id', session.userId);
        
        for (let order of orders) {
            if (order.items && typeof order.items === 'string') {
                order.items = JSON.parse(order.items);
            }
        }
        
        res.json({ orders });
    } catch (error) {
        console.error('Error fetching user orders:', error);
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

app.get('/api/admin/sellers/pending', async (req, res) => {
    try {
        const sellers = await findAll('sellers', 'status', 'pending');
        res.json({ sellers });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/admin/sellers/all', async (req, res) => {
    try {
        const sellers = await findAll('sellers');
        res.json({ sellers });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/admin/sellers/:sellerId/approve', async (req, res) => {
    try {
        await updateOne('sellers', req.params.sellerId, 'id', { status: 'approved' });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/admin/sellers/:sellerId/reject', async (req, res) => {
    try {
        await updateOne('sellers', req.params.sellerId, 'id', { status: 'rejected' });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
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
        res.json({ orders });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// ============================================
// MIGRATION ROUTE
// ============================================

app.post('/api/migrate-products', async (req, res) => {
    try {
        const productsFile = path.join(__dirname, 'products.json');
        if (fs.existsSync(productsFile)) {
            const productsData = JSON.parse(fs.readFileSync(productsFile, 'utf8'));
            const products = productsData.products || productsData;
            
            let count = 0;
            for (let product of products) {
                const existing = await findOne('products', 'id', product.id);
                if (!existing) {
                    await insertOne('products', {
                        id: product.id,
                        name: product.name,
                        price: product.price,
                        category: product.category || 'digital',
                        image: product.image,
                        stock: product.stock || 999
                    });
                    count++;
                }
            }
            res.json({ success: true, message: `Migrated ${count} new products` });
        } else {
            res.json({ success: true, message: 'No products.json found' });
        }
    } catch (error) {
        console.error('Migration error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// DEMO PRODUCTS ROUTE (Add sample products)
// ============================================

app.post('/api/add-demo-products', async (req, res) => {
    try {
        const demoProducts = [
            { id: 'demo1', name: 'Wireless Headphones', price: 49.99, category: 'electronics', image: 'headphones.jpg', stock: 50 },
            { id: 'demo2', name: 'Smart Watch', price: 89.99, category: 'electronics', image: 'watch.jpg', stock: 30 },
            { id: 'demo3', name: 'Leather Wallet', price: 24.99, category: 'accessories', image: 'wallet.jpg', stock: 100 },
            { id: 'demo4', name: 'Yoga Mat', price: 29.99, category: 'sports', image: 'yoga-mat.jpg', stock: 45 },
            { id: 'demo5', name: 'Coffee Mug', price: 12.99, category: 'home', image: 'mug.jpg', stock: 200 }
        ];
        
        let count = 0;
        for (let product of demoProducts) {
            const existing = await findOne('products', 'id', product.id);
            if (!existing) {
                await insertOne('products', product);
                count++;
            }
        }
        
        res.json({ success: true, message: `Added ${count} demo products` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Serve admin files
app.use(express.static('admin'));

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║                    SIGMA STORE IS RUNNING!                    ║
╠══════════════════════════════════════════════════════════════╣
║   Server: http://localhost:${PORT}                            ║
║   Test:   http://localhost:${PORT}/api/test                   ║
║   Admin:  http://localhost:${PORT}/admin.html                 ║
║   Admin Password: ${ADMIN_PASSWORD}                              ║
║   Database: ${DB_TYPE === 'mysql' ? 'MySQL' : 'SQLite'}               ║
╚══════════════════════════════════════════════════════════════╝
    `);
});