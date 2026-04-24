const sqlite3 = require('sqlite3'); 
const db = new sqlite3.Database('sigma_store.db'); 
db.run("INSERT INTO coupons (id, code, type, value, min_order, created_at) VALUES ('c1', 'WELCOME10', 'percentage', 10, 0, datetime('now'))", function(err) { 
    if (err) console.log('Error:', err.message); 
    else console.log('Coupon added successfully!'); 
    db.close(); 
}); 
