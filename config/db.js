const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, '..', 'sigma_store.db'));

function connectDB() {
    return new Promise((resolve, reject) => {
        // Create tables if they don't exist
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            name TEXT,
            password TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
        
        db.run(`CREATE TABLE IF NOT EXISTS products (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            price REAL NOT NULL,
            category TEXT,
            image TEXT,
            stock INTEGER DEFAULT 999,
            seller_id TEXT,
            description TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
        
        db.run(`CREATE TABLE IF NOT EXISTS sellers (
            id TEXT PRIMARY KEY,
            user_id TEXT,
            user_email TEXT,
            store_name TEXT,
            store_description TEXT,
            category TEXT,
            status TEXT DEFAULT 'pending',
            total_sales REAL DEFAULT 0,
            balance REAL DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
        
        db.run(`CREATE TABLE IF NOT EXISTS orders (
            order_id TEXT PRIMARY KEY,
            user_id TEXT,
            user_email TEXT,
            items TEXT,
            subtotal REAL,
            shipping REAL,
            total REAL,
            notes TEXT,
            status TEXT DEFAULT 'pending',
            seller_id TEXT,
            payment_method TEXT DEFAULT 'whatsapp',
            payment_id TEXT,
            payment_status TEXT DEFAULT 'pending',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
        
        console.log('✅ SQLite database connected and tables ready');
        resolve(db);
    });
}

// Helper functions
async function executeQuery(query, params = []) {
    return new Promise((resolve, reject) => {
        if (query.trim().toUpperCase().startsWith('SELECT')) {
            db.all(query, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        } else {
            db.run(query, params, function(err) {
                if (err) reject(err);
                else resolve({ affectedRows: this.changes, insertId: this.lastID });
            });
        }
    });
}

async function insertOne(table, data) {
    const keys = Object.keys(data);
    const placeholders = keys.map(() => '?').join(',');
    const query = `INSERT INTO ${table} (${keys.join(',')}) VALUES (${placeholders})`;
    const values = Object.values(data);
    return await executeQuery(query, values);
}

async function findOne(table, condition, value) {
    const rows = await executeQuery(`SELECT * FROM ${table} WHERE ${condition} = ?`, [value]);
    return rows[0];
}

async function findAll(table, condition = null, value = null) {
    if (condition && value) {
        return await executeQuery(`SELECT * FROM ${table} WHERE ${condition} = ?`, [value]);
    }
    return await executeQuery(`SELECT * FROM ${table}`);
}

async function updateOne(table, id, idField, data) {
    const sets = Object.keys(data).map(key => `${key} = ?`).join(',');
    const values = [...Object.values(data), id];
    return await executeQuery(`UPDATE ${table} SET ${sets} WHERE ${idField} = ?`, values);
}

async function deleteOne(table, condition, value) {
    return await executeQuery(`DELETE FROM ${table} WHERE ${condition} = ?`, [value]);
}

module.exports = { 
    connectDB, 
    executeQuery, 
    insertOne, 
    findOne, 
    findAll, 
    updateOne, 
    deleteOne,
    db
};
