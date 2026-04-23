require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcrypt');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { connectDB, executeQuery, insertOne, findOne, findAll, updateOne, deleteOne, DB_TYPE } = require('./config/db');

// Email system
const nodemailer = require('nodemailer');
let transporter = null;

// ============================================
// EMAIL CONFIGURATION
// ============================================
function initEmail() {
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    if (!user || !pass) {
        console.log('⚠️ Email not configured');
        return false;
    }
    transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: process.env.SMTP_PORT || 587,
        secure: false,
        auth: { user, pass }
    });
    console.log('✅ Email system initialized');
    return true;
}

async function sendOrderConfirmation(order, user, items) {
    if (!transporter) return;
    const itemsHtml = items.map(item => `<tr><td>${item.name}</td><td>x${item.quantity}</td><td>$${item.price}</td><td>$${item.price * item.quantity}</td></tr>`).join('');
    const html = `
        <h2>Order Confirmation #${order.order_id}</h2>
        <p>Thank you ${user.name}!</p>
        <table border="1"><tr><th>Product</th><th>Qty</th><th>Price</th><th>Total</th></tr>${itemsHtml}</table>
        <p><strong>Total: $${order.total}</strong></p>
        <p>Track: https://sigma-store1.vercel.app/track.html?order=${order.order_id}</p>
    `;
    await transporter.sendMail({ from: process.env.SMTP_FROM || 'noreply@sigma.com', to: user.email, subject: `Order Confirmation #${order.order_id}`, html });
}

async function sendWelcomeEmail(user) {
    if (!transporter) return;
    const html = `<h2>Welcome to Sigma Store!</h2><p>Hi ${user.name}, thank you for joining!</p>`;
    await transporter.sendMail({ from: process.env.SMTP_FROM || 'noreply@sigma.com', to: user.email, subject: 'Welcome to Sigma Store!', html });
}

// ============================================
// PAYMENT CONFIGURATION
// ============================================
const PAYMENT_CONFIG = {
    stripe: { enabled: process.env.STRIPE_ENABLED === 'true', publicKey: process.env.STRIPE_PUBLIC_KEY, secretKey: process.env.STRIPE_SECRET_KEY },
    paypal: { enabled: process.env.PAYPAL_ENABLED === 'true', clientId: process.env.PAYPAL_CLIENT_ID, secret: process.env.PAYPAL_SECRET, mode: process.env.PAYPAL_MODE || 'sandbox' }
};

let stripe = null;
if (PAYMENT_CONFIG.stripe.enabled) {
    const Stripe = require('stripe');
    stripe = Stripe(PAYMENT_CONFIG.stripe.secretKey);
    console.log('💳 Stripe enabled');
}

// ============================================
// MIDDLEWARE
// ============================================
const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'sigma123';

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use('/uploads', express.static('uploads'));
app.use(express.static('admin'));

if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');

// ============================================
// SESSIONS
// ============================================
const sessions = {};
function getUserFromToken(token) {
    if (!token || !sessions[token]) return null;
    if (sessions[token].expires < Date.now()) { delete sessions[token]; return null; }
    return sessions[token];
}

// ============================================
// DATABASE CONNECTION
// ============================================
connectDB();
initEmail();

// ============================================
// TEST ROUTE
// ============================================
app.get('/api/test', (req, res) => {
    res.json({ message: `✅ Backend working with ${DB_TYPE}!`, database: DB_TYPE, payments: { stripe: PAYMENT_CONFIG.stripe.enabled, paypal: PAYMENT_CONFIG.paypal.enabled } });
});

app.get('/api/payment-config', (req, res) => {
    res.json({ stripe: { enabled: PAYMENT_CONFIG.stripe.enabled, publicKey: PAYMENT_CONFIG.stripe.publicKey }, paypal: { enabled: PAYMENT_CONFIG.paypal.enabled, clientId: PAYMENT_CONFIG.paypal.clientId, mode: PAYMENT_CONFIG.paypal.mode } });
});

// ============================================
// STRIPE PAYMENT
// ============================================
if (PAYMENT_CONFIG.stripe.enabled) {
    app.post('/api/create-payment-intent', async (req, res) => {
        try {
            const { amount, currency, orderId } = req.body;
            const paymentIntent = await stripe.paymentIntents.create({ amount: Math.round(amount * 100), currency: currency || 'usd', metadata: { orderId } });
            res.json({ clientSecret: paymentIntent.client_secret, paymentIntentId: paymentIntent.id });
        } catch (error) { res.status(500).json({ error: error.message }); }
    });
}

// ============================================
// PAYPAL PAYMENT
// ============================================
if (PAYMENT_CONFIG.paypal.enabled) {
    async function getPayPalAccessToken() {
        const auth = Buffer.from(`${PAYMENT_CONFIG.paypal.clientId}:${PAYMENT_CONFIG.paypal.secret}`).toString('base64');
        const response = await fetch(`${PAYMENT_CONFIG.paypal.mode === 'live' ? 'https://api.paypal.com' : 'https://api.sandbox.paypal.com'}/v1/oauth2/token`, { method: 'POST', headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=client_credentials' });
        const data = await response.json();
        return data.access_token;
    }
    app.post('/api/create-paypal-order', async (req, res) => {
        try {
            const { amount, orderId } = req.body;
            const accessToken = await getPayPalAccessToken();
            const response = await fetch(`${PAYMENT_CONFIG.paypal.mode === 'live' ? 'https://api.paypal.com' : 'https://api.sandbox.paypal.com'}/v2/checkout/orders`, { method: 'POST', headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ intent: 'CAPTURE', purchase_units: [{ reference_id: orderId, amount: { currency_code: 'USD', value: amount.toString() } }] }) });
            const order = await response.json();
            res.json({ orderId: order.id });
        } catch (error) { res.status(500).json({ error: error.message }); }
    });
    app.post('/api/capture-paypal-order', async (req, res) => {
        try {
            const { orderId, paypalOrderId } = req.body;
            const accessToken = await getPayPalAccessToken();
            const response = await fetch(`${PAYMENT_CONFIG.paypal.mode === 'live' ? 'https://api.paypal.com' : 'https://api.sandbox.paypal.com'}/v2/checkout/orders/${paypalOrderId}/capture`, { method: 'POST', headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' } });
            const capture = await response.json();
            if (capture.status === 'COMPLETED') { await executeQuery('UPDATE orders SET payment_status = ?, payment_id = ? WHERE order_id = ?', ['paid', capture.id, orderId]); res.json({ success: true }); }
            else res.json({ success: false });
        } catch (error) { res.status(500).json({ error: error.message }); }
    });
}

// ============================================
// AUTH ROUTES
// ============================================
app.post('/api/signup', async (req, res) => {
    try {
        const { email, password, name, remember } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
        const existing = await findOne('users', 'email', email);
        if (existing) return res.status(400).json({ error: 'Email already exists' });
        const hashedPassword = await bcrypt.hash(password, 10);
        const userId = Date.now().toString();
        const userName = name || email.split('@')[0];
        await insertOne('users', { id: userId, email, name: userName, password: hashedPassword, created_at: new Date().toISOString() });
        const token = userId + '_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        const expiryDays = remember ? 30 : 7;
        sessions[token] = { userId, expires: Date.now() + (expiryDays * 24 * 60 * 60 * 1000) };
        sendWelcomeEmail({ email, name: userName });
        res.json({ success: true, user: { id: userId, email, name: userName }, token });
    } catch (error) { res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/login', async (req, res) => {
    try {
        const { email, password, remember } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
        const user = await findOne('users', 'email', email);
        if (!user) return res.status(401).json({ error: 'Invalid email or password' });
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) return res.status(401).json({ error: 'Invalid email or password' });
        const token = user.id + '_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        const expiryDays = remember ? 30 : 7;
        sessions[token] = { userId: user.id, expires: Date.now() + (expiryDays * 24 * 60 * 60 * 1000) };
        res.json({ success: true, user: { id: user.id, email: user.email, name: user.name }, token });
    } catch (error) { res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/logout', (req, res) => {
    const token = req.headers.authorization;
    if (token && sessions[token]) delete sessions[token];
    res.json({ success: true });
});

app.get('/api/me', async (req, res) => {
    const token = req.headers.authorization;
    const session = getUserFromToken(token);
    if (!session) return res.status(401).json({ error: 'Not logged in' });
    const user = await findOne('users', 'id', session.userId);
    if (!user) return res.status(401).json({ error: 'User not found' });
    res.json({ user: { id: user.id, email: user.email, name: user.name } });
});

// ============================================
// PRODUCT ROUTES
// ============================================
app.get('/api/products', async (req, res) => {
    try { const products = await findAll('products'); res.json(products); }
    catch (error) { res.status(500).json({ error: 'Server error' }); }
});

const storage = multer.diskStorage({ destination: (req, file, cb) => cb(null, 'uploads/'), filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname) });
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (req, file, cb) => { const allowed = ['image/jpeg', 'image/png', 'image/jpg', 'image/gif', 'image/webp']; cb(null, allowed.includes(file.mimetype)); } });

app.post('/api/products', upload.single('image'), async (req, res) => {
    try {
        const { name, price, category, stock, imageUrl } = req.body;
        if (!name || !price) return res.status(400).json({ error: 'Name and price required' });
        const productId = 'p' + Date.now();
        let image = req.file ? req.file.filename : (imageUrl || null);
        await insertOne('products', { id: productId, name, price: parseFloat(price), category: category || 'digital', image, stock: stock || 999, created_at: new Date().toISOString() });
        res.json({ success: true, product: { id: productId, name, price } });
    } catch (error) { res.status(500).json({ error: 'Server error' }); }
});

app.delete('/api/products/:id', async (req, res) => {
    try { await deleteOne('products', 'id', req.params.id); res.json({ success: true }); }
    catch (error) { res.status(500).json({ error: 'Server error' }); }
});

// ============================================
// SELLER ROUTES
// ============================================
app.post('/api/seller/apply', async (req, res) => {
    try {
        const token = req.headers.authorization;
        const session = getUserFromToken(token);
        if (!session) return res.status(401).json({ error: 'Not logged in' });
        const { storeName, storeDescription, category } = req.body;
        if (!storeName) return res.status(400).json({ error: 'Store name required' });
        const user = await findOne('users', 'id', session.userId);
        const existing = await findOne('sellers', 'user_id', session.userId);
        if (existing) return res.status(400).json({ error: 'Already applied' });
        const sellerId = 'seller' + Date.now();
        await insertOne('sellers', { id: sellerId, user_id: session.userId, user_email: user.email, store_name: storeName, store_description: storeDescription || '', category: category || 'general', status: 'pending', total_sales: 0, balance: 0, created_at: new Date().toISOString() });
        res.json({ success: true, seller: { id: sellerId, storeName, status: 'pending' } });
    } catch (error) { res.status(500).json({ error: 'Server error' }); }
});

app.get('/api/seller/dashboard', async (req, res) => {
    try {
        const token = req.headers.authorization;
        const session = getUserFromToken(token);
        if (!session) return res.status(401).json({ error: 'Not logged in' });
        const seller = await findOne('sellers', 'user_id', session.userId);
        if (!seller) return res.status(404).json({ error: 'Not a seller' });
        const products = await findAll('products', 'seller_id', seller.id);
        res.json({ seller, stats: { totalProducts: products.length, totalOrders: 0, totalSales: seller.total_sales || 0, balance: seller.balance || 0 } });
    } catch (error) { res.status(500).json({ error: 'Server error' }); }
});

app.get('/api/seller/products', async (req, res) => {
    try {
        const token = req.headers.authorization;
        const session = getUserFromToken(token);
        if (!session) return res.status(401).json({ error: 'Not logged in' });
        const seller = await findOne('sellers', 'user_id', session.userId);
        if (!seller || seller.status !== 'approved') return res.status(403).json({ error: 'Not an approved seller' });
        const products = await findAll('products', 'seller_id', seller.id);
        res.json({ products });
    } catch (error) { res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/seller/products', upload.single('image'), async (req, res) => {
    try {
        const token = req.headers.authorization;
        const session = getUserFromToken(token);
        if (!session) return res.status(401).json({ error: 'Not logged in' });
        const seller = await findOne('sellers', 'user_id', session.userId);
        if (!seller || seller.status !== 'approved') return res.status(403).json({ error: 'Not an approved seller' });
        const productId = 'p' + Date.now();
        const { name, price, category, stock, description, imageUrl } = req.body;
        let image = req.file ? req.file.filename : (imageUrl || null);
        if (!name || !price) return res.status(400).json({ error: 'Name and price required' });
        await insertOne('products', { id: productId, name, price: parseFloat(price), category: category || 'digital', image, stock: stock || 999, seller_id: seller.id, description: description || '', created_at: new Date().toISOString() });
        res.json({ success: true, product: { id: productId, name, price } });
    } catch (error) { res.status(500).json({ error: 'Server error' }); }
});

app.delete('/api/seller/products/:id', async (req, res) => {
    try { await deleteOne('products', 'id', req.params.id); res.json({ success: true }); }
    catch (error) { res.status(500).json({ error: 'Server error' }); }
});

// ============================================
// ORDER ROUTES
// ============================================
app.post('/api/orders', async (req, res) => {
    try {
        const token = req.headers.authorization;
        const session = getUserFromToken(token);
        if (!session) return res.status(401).json({ error: 'Please login to place order' });
        const { items, subtotal, shipping, total, notes, paymentMethod, paymentId } = req.body;
        if (!items || items.length === 0) return res.status(400).json({ error: 'Cart is empty' });
        const user = await findOne('users', 'id', session.userId);
        const orderId = 'ORD' + Date.now();
        await insertOne('orders', { order_id: orderId, user_id: session.userId, user_email: user.email, items: JSON.stringify(items), subtotal: subtotal || 0, shipping: shipping || 0, total: total || 0, notes: notes || '', status: 'pending', payment_method: paymentMethod || 'whatsapp', payment_id: paymentId || null, payment_status: paymentId ? 'paid' : 'pending', created_at: new Date().toISOString() });
        sendOrderConfirmation({ order_id: orderId, total }, user, items);
        res.json({ success: true, order: { orderId, total } });
    } catch (error) { res.status(500).json({ error: 'Server error' }); }
});

app.get('/api/orders/:orderId', async (req, res) => {
    try {
        const order = await findOne('orders', 'order_id', req.params.orderId);
        if (!order) return res.status(404).json({ error: 'Order not found' });
        if (order.items && typeof order.items === 'string') order.items = JSON.parse(order.items);
        res.json({ order });
    } catch (error) { res.status(500).json({ error: 'Server error' }); }
});

app.get('/api/myorders', async (req, res) => {
    try {
        const token = req.headers.authorization;
        const session = getUserFromToken(token);
        if (!session) return res.status(401).json({ error: 'Not logged in' });
        const orders = await findAll('orders', 'user_id', session.userId);
        for (let order of orders) { if (order.items && typeof order.items === 'string') order.items = JSON.parse(order.items); }
        res.json({ orders });
    } catch (error) { res.status(500).json({ error: 'Server error' }); }
});

// ============================================
// ADMIN ROUTES
// ============================================
app.post('/api/admin/login', (req, res) => {
    const { password } = req.body;
    if (password === ADMIN_PASSWORD) res.json({ success: true });
    else res.status(401).json({ error: 'Wrong password' });
});

app.get('/api/admin/sellers/pending', async (req, res) => {
    try { const sellers = await findAll('sellers', 'status', 'pending'); res.json({ sellers }); }
    catch (error) { res.status(500).json({ error: 'Server error' }); }
});

app.get('/api/admin/sellers/all', async (req, res) => {
    try { const sellers = await findAll('sellers'); res.json({ sellers }); }
    catch (error) { res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/admin/sellers/:sellerId/approve', async (req, res) => {
    try { await updateOne('sellers', req.params.sellerId, 'id', { status: 'approved' }); res.json({ success: true }); }
    catch (error) { res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/admin/sellers/:sellerId/reject', async (req, res) => {
    try { await updateOne('sellers', req.params.sellerId, 'id', { status: 'rejected' }); res.json({ success: true }); }
    catch (error) { res.status(500).json({ error: 'Server error' }); }
});

app.get('/api/admin/orders', async (req, res) => {
    try {
        const orders = await findAll('orders');
        for (let order of orders) { if (order.items && typeof order.items === 'string') order.items = JSON.parse(order.items); }
        res.json({ orders });
    } catch (error) { res.status(500).json({ error: 'Server error' }); }
});

// ============================================
// REVIEWS ROUTES
// ============================================
app.get('/api/products/:productId/reviews', async (req, res) => {
    try { const reviews = await executeQuery('SELECT * FROM reviews WHERE product_id = ? ORDER BY created_at DESC', [req.params.productId]); res.json({ success: true, reviews: reviews || [] }); }
    catch(error) { res.json({ success: true, reviews: [] }); }
});

app.post('/api/products/:productId/reviews', async (req, res) => {
    try {
        const token = req.headers.authorization;
        const session = getUserFromToken(token);
        if (!session) return res.status(401).json({ error: 'Please login to review' });
        const { rating, comment } = req.body;
        const user = await findOne('users', 'id', session.userId);
        const reviewId = 'rev' + Date.now();
        await insertOne('reviews', { id: reviewId, product_id: req.params.productId, user_id: session.userId, user_name: user.name || user.email, rating: parseInt(rating), comment: comment || '', created_at: new Date().toISOString() });
        res.json({ success: true });
    } catch(error) { res.status(500).json({ error: 'Server error' }); }
});

app.get('/api/products/:productId/rating', async (req, res) => {
    try {
        const result = await executeQuery('SELECT AVG(rating) as averageRating, COUNT(*) as totalReviews FROM reviews WHERE product_id = ?', [req.params.productId]);
        res.json({ averageRating: result[0]?.averageRating || 0, totalReviews: result[0]?.totalReviews || 0 });
    } catch(error) { res.json({ averageRating: 0, totalReviews: 0 }); }
});

// ============================================
// START SERVER
// ============================================
app.listen(PORT, () => {
    console.log(`✅ Server running at http://localhost:${PORT}`);
    console.log(`👑 Admin: http://localhost:${PORT}/admin.html`);
    console.log(`🔐 Admin Password: ${ADMIN_PASSWORD}`);
    console.log(`💳 Stripe: ${PAYMENT_CONFIG.stripe.enabled ? 'ON' : 'OFF'}`);
    console.log(`💙 PayPal: ${PAYMENT_CONFIG.paypal.enabled ? 'ON' : 'OFF'}`);
});