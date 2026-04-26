const sqlite3 = require('sqlite3'); 
const db = new sqlite3.Database('sigma_store.db'); 
console.log('Creating tables...'); 
db.serialize(function() { 
  db.run("CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT UNIQUE, name TEXT, password TEXT, profile_picture TEXT, created_at TEXT)"); 
  db.run("CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id TEXT, expires INTEGER, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)"); 
  db.run("CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY, name TEXT, price REAL, category TEXT, image TEXT, stock INTEGER DEFAULT 999, description TEXT, created_at TEXT)"); 
  db.run("CREATE TABLE IF NOT EXISTS orders (order_id TEXT PRIMARY KEY, user_id TEXT, user_email TEXT, items TEXT, subtotal REAL, shipping REAL, total REAL, status TEXT, created_at TEXT)"); 
  db.run("CREATE TABLE IF NOT EXISTS reviews (id TEXT PRIMARY KEY, product_id TEXT, user_id TEXT, rating INTEGER, comment TEXT, created_at TEXT)"); 
  db.run("CREATE TABLE IF NOT EXISTS coupons (id TEXT PRIMARY KEY, code TEXT UNIQUE, type TEXT, value REAL, min_order REAL, expires_at TEXT, created_at TEXT)"); 
}); 
setTimeout(function() { 
  console.log('Tables created successfully'); 
  db.close(); 
}, 1000); 
