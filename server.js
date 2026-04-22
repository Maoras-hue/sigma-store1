require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcrypt');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { connectDB, executeQuery, insertOne, findOne, findAll, updateOne, deleteOne, DB_TYPE } = require('./config/db');
const { initEmail, sendOrderConfirmation, sendOrderStatusUpdate, sendWelcomeEmail } = require('./email');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'sigma123';

// ============================================
// PAYMENT CONFIGURATION
// ============================================

const PAYMENT_CONFIG = {
    stripe: {
        enabled: process.env.STRIPE_ENABLED === 'true',
        publicKey: process.env.STRIPE_PUBLIC_KEY,
        secretKey: process.env.STRIPE_SECRET_KEY,
        webhookSecret: process.env.STRIPE_WEBHOOK_SECRET
    },
    paypal: {
        enabled: process.env.PAYPAL_ENABLED === 'true',
        clientId: process.env.PAYPAL_CLIENT_ID,
        secret: process.env.PAYPAL_SECRET,
        mode: process.env.PAYPAL_MODE || 'sandbox'
    },
    payoneer: {
        enabled: process.env.PAYONEER_ENABLED === 'true',
        longId: process.env.PAYONEER_LONG_ID,
        apiToken: process.env.PAYONEER_API_TOKEN,
        env: process.env.PAYONEER_ENV || 'sandbox'
    }
};

// Initialize Stripe if enabled
let stripe = null;
if (PAYMENT_CONFIG.stripe.enabled) {
    const Stripe = require('stripe');
    stripe = Stripe(PAYMENT_CONFIG.stripe.secretKey);
    console.log('💳 Stripe payment enabled');
}

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use('/uploads', express.static('uploads'));

// Raw body for Stripe webhook
if (PAYMENT_CONFIG.stripe.enabled) {
    app.post('/api/stripe-webhook', express.raw({type: 'application/json'}), async (req, res) => {
        const sig = req.headers['stripe-signature'];
        let event;
        
        try {
            event = stripe.webhooks.constructEvent(req.body, sig, PAYMENT_CONFIG.stripe.webhookSecret);
        } catch (err) {
            return res.status(400).send(`Webhook Error: ${err.message}`);
        }
        
        if (event.type === 'payment_intent.succeeded') {
            const paymentIntent = event.data.object;
            const orderId = paymentIntent.metadata.orderId;
            
            await executeQuery(
                'UPDATE orders SET payment_status = ?, payment_id = ? WHERE order_id = ?',
                ['paid', paymentIntent.id, orderId]
            );
            console.log(`✅ Payment succeeded for order: ${orderId}`);
        }
        
        res.json({ received: true });
    });
}

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

// Initialize email system
initEmail();

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
        status: 'online',
        payments: {
            stripe: PAYMENT_CONFIG.stripe.enabled,
            paypal: PAYMENT_CONFIG.paypal.enabled,
            payoneer: PAYMENT_CONFIG.payoneer.enabled
        }
    });
});

// ============================================
// PAYMENT CONFIG ROUTE
// ============================================
app.get('/api/payment-config', (req, res) => {
    res.json({
        stripe: {
            enabled: PAYMENT_CONFIG.stripe.enabled,
            publicKey: PAYMENT_CONFIG.stripe.publicKey
        },
        paypal: {
            enabled: PAYMENT_CONFIG.paypal.enabled,
            clientId: PAYMENT_CONFIG.paypal.clientId,
            mode: PAYMENT_CONFIG.paypal.mode
        },
        payoneer: {
            enabled: PAYMENT_CONFIG.payoneer.enabled
        }
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
        
        // Send welcome email
        sendWelcomeEmail({ email, name: userName });
        
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
        const { name, price, category, stock, imageUrl } = req.body;
        
        let image = null;
        if (req.file) {
            image = req.file.filename;
        } else if (imageUrl && imageUrl.trim() !== '') {
            image = imageUrl.trim();
        }
        
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

app.put('/api/products/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { image } = req.body;
        
        if (image) {
            await updateOne('products', id, 'id', { image: image });
            res.json({ success: true, message: 'Image updated' });
        } else {
            res.status(400).json({ error: 'No image provided' });
        }
    } catch (error) {
        console.error('Error updating product:', error);
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
// STRIPE PAYMENT ROUTES
// ============================================

if (PAYMENT_CONFIG.stripe.enabled) {
    app.post('/api/create-payment-intent', async (req, res) => {
        try {
            const { amount, currency, orderId } = req.body;
            
            const paymentIntent = await stripe.paymentIntents.create({
                amount: Math.round(amount * 100),
                currency: currency || 'usd',
                metadata: { orderId: orderId }
            });
            
            res.json({
                clientSecret: paymentIntent.client_secret,
                paymentIntentId: paymentIntent.id
            });
        } catch (error) {
            console.error('Stripe error:', error);
            res.status(500).json({ error: error.message });
        }
    });
}

// ============================================
// PAYPAL PAYMENT ROUTES
// ============================================

if (PAYMENT_CONFIG.paypal.enabled) {
    async function getPayPalAccessToken() {
        const auth = Buffer.from(`${PAYMENT_CONFIG.paypal.clientId}:${PAYMENT_CONFIG.paypal.secret}`).toString('base64');
        const response = await fetch(`${PAYMENT_CONFIG.paypal.mode === 'live' ? 'https://api.paypal.com' : 'https://api.sandbox.paypal.com'}/v1/oauth2/token`, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: 'grant_type=client_credentials'
        });
        const data = await response.json();
        return data.access_token;
    }

    app.post('/api/create-paypal-order', async (req, res) => {
        try {
            const { amount, orderId } = req.body;
            const accessToken = await getPayPalAccessToken();
            
            const response = await fetch(`${PAYMENT_CONFIG.paypal.mode === 'live' ? 'https://api.paypal.com' : 'https://api.sandbox.paypal.com'}/v2/checkout/orders`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    intent: 'CAPTURE',
                    purchase_units: [{
                        reference_id: orderId,
                        amount: {
                            currency_code: 'USD',
                            value: amount.toString()
                        }
                    }]
                })
            });
            
            const order = await response.json();
            res.json({ orderId: order.id });
        } catch (error) {
            console.error('PayPal error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    app.post('/api/capture-paypal-order', async (req, res) => {
        try {
            const { orderId, paypalOrderId } = req.body;
            const accessToken = await getPayPalAccessToken();
            
            const response = await fetch(`${PAYMENT_CONFIG.paypal.mode === 'live' ? 'https://api.paypal.com' : 'https://api.sandbox.paypal.com'}/v2/checkout/orders/${paypalOrderId}/capture`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            });
            
            const capture = await response.json();
            
            if (capture.status === 'COMPLETED') {
                await executeQuery(
                    'UPDATE orders SET payment_status = ?, payment_id = ? WHERE order_id = ?',
                    ['paid', capture.id, orderId]
                );
                res.json({ success: true });
            } else {
                res.json({ success: false });
            }
        } catch (error) {
            console.error('PayPal capture error:', error);
            res.status(500).json({ error: error.message });
        }
    });
}

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
        const { name, price, category, stock, description, imageUrl } = req.body;
        
        let image = null;
        if (req.file) {
            image = req.file.filename;
        } else if (imageUrl && imageUrl.trim() !== '') {
            image = imageUrl.trim();
        }
        
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
        
        const { items, subtotal, shipping, total, notes, paymentMethod, paymentId } = req.body;
        
        if (!items || items.length === 0) {
            return res.status(400).json({ error: 'Cart is empty' });
        }
        
        const userData = await findOne('users', 'id', session.userId);
        const orderId = 'ORD' + Date.now();
        
        await insertOne('orders', {
            order_id: orderId,
            user_id: session.userId,
            user_email: userData.email,
            items: JSON.stringify(items),
            subtotal: subtotal || 0,
            shipping: shipping || 0,
            total: total || 0,
            notes: notes || '',
            status: 'pending',
            payment_method: paymentMethod || 'whatsapp',
            payment_id: paymentId || null,
            payment_status: paymentId ? 'paid' : 'pending'
        });
        
        // Send order confirmation email
        const orderForEmail = {
            order_id: orderId,
            subtotal: subtotal || 0,
            shipping: shipping || 0,
            total: total || 0,
            created_at: new Date(),
            payment_method: paymentMethod || 'whatsapp'
        };
        await sendOrderConfirmation(orderForEmail, userData, items);
        
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
// ORDER STATUS UPDATE WITH EMAIL
// ============================================

app.put('/api/orders/:orderId/status', async (req, res) => {
    try {
        const { status } = req.body;
        const { orderId } = req.params;
        
        await executeQuery('UPDATE orders SET status = ? WHERE order_id = ?', [status, orderId]);
        
        // Send email notification
        const order = await findOne('orders', 'order_id', orderId);
        if (order && order.items && typeof order.items === 'string') {
            order.items = JSON.parse(order.items);
        }
        const user = await findOne('users', 'id', order.user_id);
        await sendOrderStatusUpdate(order, user, status);
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error updating order status:', error);
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
// DATABASE UPDATE FOR PAYMENTS
// ============================================

async function updateDatabaseForPayments() {
    try {
        await executeQuery(`ALTER TABLE orders ADD COLUMN payment_method VARCHAR(50) DEFAULT 'whatsapp'`);
        await executeQuery(`ALTER TABLE orders ADD COLUMN payment_id VARCHAR(100)`);
        await executeQuery(`ALTER TABLE orders ADD COLUMN payment_status VARCHAR(50) DEFAULT 'pending'`);
    } catch (error) {
        console.log('Payment columns already exist or added');
    }
}

updateDatabaseForPayments();

// Serve admin files
app.use(express.static('admin'));

// ============================================
// REVIEWS ROUTES
// ============================================

app.get('/api/products/:productId/reviews', async (req, res) => {
    try {
        const reviews = await executeQuery('SELECT * FROM reviews WHERE product_id = ? ORDER BY created_at DESC', [req.params.productId]);
        res.json({ success: true, reviews });
    } catch(error) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/products/:productId/reviews', async (req, res) => {
    try {
        const token = req.headers.authorization;
        const session = getUserFromToken(token);
        if (!session) return res.status(401).json({ error: 'Please login' });
        
        const { rating, comment } = req.body;
        const user = await findOne('users', 'id', session.userId);
        const reviewId = 'rev' + Date.now();
        
        await insertOne('reviews', {
            id: reviewId,
            product_id: req.params.productId,
            user_id: session.userId,
            user_name: user.name || user.email,
            rating: parseInt(rating),
            comment: comment || ''
        });
        res.json({ success: true });
    } catch(error) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/products/:productId/rating', async (req, res) => {
    try {
        const result = await executeQuery('SELECT AVG(rating) as averageRating, COUNT(*) as totalReviews FROM reviews WHERE product_id = ?', [req.params.productId]);
        res.json({ averageRating: result[0]?.averageRating || 0, totalReviews: result[0]?.totalReviews || 0 });
    } catch(error) {
        res.status(500).json({ error: 'Server error' });
    }
});
app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║                    SIGMA STORE IS RUNNING!                    ║
╠══════════════════════════════════════════════════════════════╣
║   🚀 Server: http://localhost:${PORT}                            ║
║   🧪 Test:   http://localhost:${PORT}/api/test                   ║
║   👑 Admin:  http://localhost:${PORT}/admin.html                 ║
║   🔐 Admin Password: ${ADMIN_PASSWORD}                              ║
║   💾 Database: ${DB_TYPE === 'mysql' ? 'MySQL' : 'SQLite'}               ║
╠══════════════════════════════════════════════════════════════╣
║   💳 PAYMENT GATEWAYS:                                        ║
║      Stripe:   ${PAYMENT_CONFIG.stripe.enabled ? '✅ ENABLED' : '❌ DISABLED'}                                    ║
║      PayPal:   ${PAYMENT_CONFIG.paypal.enabled ? '✅ ENABLED' : '❌ DISABLED'}                                    ║
║      Payoneer: ${PAYMENT_CONFIG.payoneer.enabled ? '✅ ENABLED' : '❌ DISABLED'}                                  ║
╚══════════════════════════════════════════════════════════════╝
    `);
});
