require('dotenv').config();
const { connectDB, insertOne, findAll } = require('./config/db');

async function setup() {
    console.log(' Setting up Sigma Store...\n');
    await connectDB();
    
    const products = await findAll('products');
    
    if (products.length === 0) {
        console.log(' Adding demo products...');
        
        const demoProducts = [
            { id: 'demo1', name: 'Wireless Headphones', price: 49.99, category: 'electronics', image: 'headphones.jpg', stock: 50 },
            { id: 'demo2', name: 'Smart Watch', price: 89.99, category: 'electronics', image: 'watch.jpg', stock: 30 },
            { id: 'demo3', name: 'Premium Backpack', price: 79.99, category: 'accessories', image: 'backpack.jpg', stock: 25 },
            { id: 'demo4', name: 'Coffee Maker', price: 129.99, category: 'home', image: 'coffee-maker.jpg', stock: 15 },
            { id: 'demo5', name: 'Yoga Mat', price: 29.99, category: 'sports', image: 'yoga-mat.jpg', stock: 45 }
        ];
        
        for (const product of demoProducts) {
            await insertOne('products', product);
            console.log(`    Added: ${product.name}`);
        }
    } else {
        console.log(`📦 Found ${products.length} existing products`);
    }
    
    console.log('\n Setup complete!');
    console.log('\n Next: node server.js');
    process.exit(0);
}

setup().catch(err => { showToast("Something went wrong", "error"); console.error(err); });