const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'sigma_store.db'));

const products = [
    { id: 'p1', name: 'Wireless Headphones', price: 49.99, category: 'electronics', image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400', stock: 50 },
    { id: 'p2', name: 'Smart Watch', price: 89.99, category: 'electronics', image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400', stock: 30 },
    { id: 'p3', name: 'Premium Backpack', price: 79.99, category: 'accessories', image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400', stock: 25 },
    { id: 'p4', name: 'Coffee Maker', price: 129.99, category: 'home', image: 'https://images.unsplash.com/photo-1517668808822-9bba02b6f420?w=400', stock: 15 },
    { id: 'p5', name: 'Yoga Mat', price: 29.99, category: 'sports', image: 'https://images.unsplash.com/photo-1592432678016-e910b452f9a2?w=400', stock: 45 },
    { id: 'p6', name: 'Bluetooth Speaker', price: 59.99, category: 'electronics', image: 'https://images.unsplash.com/photo-1545454675-3531b543be5d?w=400', stock: 40 },
    { id: 'p7', name: 'Leather Wallet', price: 24.99, category: 'accessories', image: 'https://images.unsplash.com/photo-1627123424574-724758594e93?w=400', stock: 100 },
    { id: 'p8', name: 'Desk Lamp', price: 34.99, category: 'home', image: 'https://images.unsplash.com/photo-1507473885765-e6b057f7a2b2?w=400', stock: 60 }
];

db.serialize(() => {
    // Clear existing products
    db.run('DELETE FROM products');
    
    // Insert new products
    const stmt = db.prepare('INSERT INTO products (id, name, price, category, image, stock, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
    products.forEach(p => {
        stmt.run(p.id, p.name, p.price, p.category, p.image, p.stock, new Date().toISOString());
        console.log('Added:', p.name);
    });
    stmt.finalize();
    
    console.log('All products added successfully!');
    db.close();
});