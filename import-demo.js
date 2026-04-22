// import-demo.js - Import demo products into database
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const db = new sqlite3.Database(path.join(__dirname, 'sigma_store.db'));

const demoData = JSON.parse(fs.readFileSync(path.join(__dirname, 'demo-products.json'), 'utf8'));
const products = demoData.products;

console.log('Importing ' + products.length + ' demo products...');

let count = 0;
products.forEach(product => {
    db.run(`INSERT OR REPLACE INTO products (id, name, price, category, image, stock, description) 
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [product.id, product.name, product.price, product.category, product.image, product.stock, product.description],
        function(err) {
            if (err) {
                console.log('Failed to import ' + product.name + ': ' + err.message);
            } else {
                count++;
                console.log('Imported: ' + product.name);
            }
        }
    );
});

setTimeout(() => {
    console.log('Import complete! ' + count + ' products added.');
    console.log('Restart your server: node server.js');
    db.close();
}, 2000);
