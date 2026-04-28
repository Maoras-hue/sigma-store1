const fs = require('fs');
const path = require('path');

// DATABASE TYPE - Change to 'mysql' if needed
const DB_TYPE = process.env.DB_TYPE || 'sqlite'; // 'sqlite' or 'mysql'

let pool = null;
let db = null;

// SQLITE DATABASE (Default - No installation needed)
if (DB_TYPE === 'sqlite') {
    const sqlite3 = require('sqlite3').verbose();
    const dbPath = path.join(__dirname, '..', 'sigma_store.db');
    
    db = new sqlite3.Database(dbPath);
    
    // Create all tables
    db.serialize(() => {
        // Users table
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            email TEXT UNIQUE,
            name TEXT,
            password TEXT,
            created_at TEXT
        )`);
        
        // Products table
        db.run(`CREATE TABLE IF NOT EXISTS products (
            id TEXT PRIMARY KEY,
            name TEXT,
            price REAL,
            category TEXT,
            image TEXT,
            stock INTEGER,
            seller_id TEXT,
            description TEXT,
            created_at TEXT
        )`);
        
        // Sellers table
        db.run(`CREATE TABLE IF NOT EXISTS sellers (
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
        
        // Orders table
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
        )`);
        
        // Reviews table
        db.run(`CREATE TABLE IF NOT EXISTS reviews (
            id TEXT PRIMARY KEY,
            product_id TEXT,
            user_id TEXT,
            user_name TEXT,
            rating INTEGER,
            comment TEXT,
            created_at TEXT
        )`);
        
        // Carts table (for guest carts)
        db.run(`CREATE TABLE IF NOT EXISTS carts (
            user_id TEXT PRIMARY KEY,
            items TEXT,
            updated_at TEXT
        )`);
        
        console.log('✅ SQLite database ready - Tables created');
    });
}

// MYSQL DATABASE (Optional - for production)
if (DB_TYPE === 'mysql') {
    const mysql = require('mysql2/promise');
    
    pool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'sigma_store',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    });
    
    console.log('✅ MySQL connection pool ready');
}

// CONNECT DATABASE FUNCTION
async function connectDB() {
    if (DB_TYPE === 'sqlite') {
        return db;
    }
    
    if (DB_TYPE === 'mysql') {
        try {
            const connection = await pool.getConnection();
            console.log('✅ Connected to MySQL successfully');
            connection.release();
            return pool;
        } catch (error) {
            console.error('❌ MySQL connection error:', error.message);
            console.log('💡 Tip: Make sure MySQL is running and database exists');
            process.exit(1);
        }
    }
}

// EXECUTE QUERY FUNCTION
async function executeQuery(sql, params = []) {
    if (DB_TYPE === 'sqlite') {
        return new Promise((resolve, reject) => {
            db.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }
    
    if (DB_TYPE === 'mysql') {
        const [rows] = await pool.execute(sql, params);
        return rows;
    }
}

// INSERT ONE RECORD
async function insertOne(table, data) {
    const keys = Object.keys(data);
    const placeholders = keys.map(() => '?').join(',');
    const sql = `INSERT INTO ${table} (${keys.join(',')}) VALUES (${placeholders})`;
    const values = keys.map(key => data[key]);
    return executeQuery(sql, values);
}

// INSERT MANY RECORDS
async function insertMany(table, dataArray) {
    if (!dataArray || dataArray.length === 0) return [];
    const keys = Object.keys(dataArray[0]);
    const placeholders = keys.map(() => '?').join(',');
    const sql = `INSERT INTO ${table} (${keys.join(',')}) VALUES (${placeholders})`;
    
    for (const data of dataArray) {
        const values = keys.map(key => data[key]);
        await executeQuery(sql, values);
    }
    return dataArray;
}

// FIND ONE RECORD
async function findOne(table, field, value) {
    const results = await executeQuery(`SELECT * FROM ${table} WHERE ${field} = ? LIMIT 1`, [value]);
    return results[0] || null;
}

// FIND ALL RECORDS
async function findAll(table, field = null, value = null) {
    if (field && value !== null) {
        return executeQuery(`SELECT * FROM ${table} WHERE ${field} = ? ORDER BY created_at DESC`, [value]);
    }
    return executeQuery(`SELECT * FROM ${table} ORDER BY created_at DESC`);
}

// FIND WITH PAGINATION
async function findPaginated(table, page = 1, limit = 10, field = null, value = null) {
    const offset = (page - 1) * limit;
    let sql = `SELECT * FROM ${table}`;
    let params = [];
    
    if (field && value !== null) {
        sql += ` WHERE ${field} = ?`;
        params.push(value);
    }
    
    sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);
    
    const results = await executeQuery(sql, params);
    const countResult = await executeQuery(`SELECT COUNT(*) as total FROM ${table}${field ? ` WHERE ${field} = ?` : ''}`, field && value !== null ? [value] : []);
    const total = countResult[0]?.total || 0;
    
    return { data: results, total, page, totalPages: Math.ceil(total / limit) };
}

// UPDATE ONE RECORD
async function updateOne(table, id, idField, data) {
    const keys = Object.keys(data);
    const setClause = keys.map(key => `${key} = ?`).join(',');
    const sql = `UPDATE ${table} SET ${setClause} WHERE ${idField} = ?`;
    const values = [...keys.map(key => data[key]), id];
    return executeQuery(sql, values);
}

// DELETE ONE RECORD
async function deleteOne(table, field, value) {
    return executeQuery(`DELETE FROM ${table} WHERE ${field} = ?`, [value]);
}

// DELETE MANY RECORDS
async function deleteMany(table, field, values) {
    if (!values || values.length === 0) return [];
    const placeholders = values.map(() => '?').join(',');
    return executeQuery(`DELETE FROM ${table} WHERE ${field} IN (${placeholders})`, values);
}

// COUNT RECORDS
async function countRecords(table, field = null, value = null) {
    let sql = `SELECT COUNT(*) as count FROM ${table}`;
    let params = [];
    
    if (field && value !== null) {
        sql += ` WHERE ${field} = ?`;
        params.push(value);
    }
    
    const result = await executeQuery(sql, params);
    return result[0]?.count || 0;
}

// SEARCH PRODUCTS
async function searchProducts(searchTerm, category = null) {
    let sql = `SELECT * FROM products WHERE name LIKE ? OR description LIKE ?`;
    let params = [`%${searchTerm}%`, `%${searchTerm}%`];
    
    if (category && category !== 'all') {
        sql += ` AND category = ?`;
        params.push(category);
    }
    
    sql += ` ORDER BY created_at DESC`;
    return executeQuery(sql, params);
}

// GET USER ORDERS WITH DETAILS
async function getUserOrders(userId) {
    const orders = await executeQuery(`SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC`, [userId]);
    
    for (let order of orders) {
        if (order.items && typeof order.items === 'string') {
            try {
                order.items = JSON.parse(order.items);
            } catch(e) {
                order.items = [];
            }
        }
    }
    
    return orders;
}

// UPDATE ORDER STATUS
async function updateOrderStatus(orderId, status) {
    return executeQuery(`UPDATE orders SET status = ? WHERE order_id = ?`, [status, orderId]);
}

// GET PRODUCT WITH REVIEWS
async function getProductWithReviews(productId) {
    const product = await findOne('products', 'id', productId);
    if (!product) return null;
    
    const reviews = await executeQuery(`SELECT * FROM reviews WHERE product_id = ? ORDER BY created_at DESC`, [productId]);
    const ratingResult = await executeQuery(`SELECT AVG(rating) as averageRating, COUNT(*) as totalReviews FROM reviews WHERE product_id = ?`, [productId]);
    
    product.reviews = reviews;
    product.averageRating = ratingResult[0]?.averageRating || 0;
    product.totalReviews = ratingResult[0]?.totalReviews || 0;
    
    return product;
}

// GET SELLER STATS
async function getSellerStats(sellerId) {
    const products = await findAll('products', 'seller_id', sellerId);
    const orders = await executeQuery(`SELECT * FROM orders WHERE items LIKE ?`, [`%${sellerId}%`]);
    
    let totalSales = 0;
    for (const order of orders) {
        totalSales += order.total || 0;
    }
    
    return {
        totalProducts: products.length,
        totalOrders: orders.length,
        totalSales: totalSales,
        balance: totalSales * 0.9 // 10% commission
    };
}

// EXPORT ALL FUNCTIONS
module.exports = { 
    connectDB, 
    executeQuery, 
    insertOne, 
    insertMany,
    findOne, 
    findAll, 
    findPaginated,
    updateOne, 
    deleteOne,
    deleteMany,
    countRecords,
    searchProducts,
    getUserOrders,
    updateOrderStatus,
    getProductWithReviews,
    getSellerStats,
    DB_TYPE 
};