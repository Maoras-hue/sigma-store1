// ============================================
// SIGMA STORE - MAIN FRONTEND SCRIPT
// ============================================

let products = [];
let currentFilter = 'all';
let searchTerm = '';
let currentSort = 'default';

const API_URL = window.BACKEND_URL || 'https://sigma-store-api.onrender.com';

// ============================================
// LOAD PRODUCTS FROM BACKEND
// ============================================
async function loadProducts() {
    console.log('Loading products from:', API_URL);
    const grid = document.getElementById('productsGrid');
    if (grid) grid.innerHTML = '<div class="spinner"></div>';
    
    try {
        const response = await fetch(`${API_URL}/api/products`);
        if (!response.ok) throw new Error('Failed to fetch products');
        products = await response.json();
        console.log('Products loaded:', products.length);
        renderProducts();
        renderRecentlyViewed();
        updateProductCount();
    } catch (error) {
        console.error('Error loading products:', error);
        if (grid) grid.innerHTML = '<p style="text-align:center; padding:40px;">Cannot load products. Please try again later.</p>';
    }
}

// Update product count in UI
function updateProductCount() {
    const countElement = document.getElementById('productCount');
    if (countElement) countElement.innerText = products.length + ' products';
}

// ============================================
// AUTO-REFRESH PRODUCTS
// ============================================

let lastUpdateCheck = Date.now();

async function refreshProductsFromServer() {
    console.log('Checking for product updates...');
    try {
        const response = await fetch(`${API_URL}/api/products`);
        if (!response.ok) throw new Error('Failed to fetch');
        const newProducts = await response.json();
        
        // Check if products changed
        if (JSON.stringify(products) !== JSON.stringify(newProducts)) {
            products = newProducts;
            console.log('Products updated! New count:', products.length);
            renderProducts();
            renderRecentlyViewed();
            updateProductCount();
            showToast('Products updated!', 'info');
        }
    } catch (error) {
        console.error('Auto-refresh error:', error);
    }
}

async function checkForAdminUpdates() {
    try {
        const response = await fetch(`${API_URL}/api/last-product-update`);
        const data = await response.json();
        
        if (data.lastUpdate > lastUpdateCheck) {
            console.log('Admin made changes, refreshing...');
            lastUpdateCheck = data.lastUpdate;
            await refreshProductsFromServer();
        }
    } catch(e) {
        // Silently fail - admin notification endpoint might not exist
    }
}

// Auto-refresh every 10 seconds
setInterval(refreshProductsFromServer, 10000);

// Check for admin updates every 5 seconds
setInterval(checkForAdminUpdates, 5000);

// Refresh when page becomes visible again
document.addEventListener('visibilitychange', function() {
    if (!document.hidden) {
        refreshProductsFromServer();
    }
});

// ============================================
// SHOW TOAST NOTIFICATION
// ============================================
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.innerText = message;
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 20px;
        background: ${type === 'success' ? '#111' : '#e05a2a'};
        color: white;
        padding: 12px 24px;
        border-radius: 50px;
        z-index: 9999;
        animation: fadeInUp 0.3s ease;
        box-shadow: 0 4px 15px rgba(0,0,0,0.2);
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// ============================================
// CART FUNCTIONS
// ============================================
function getCart() {
    return JSON.parse(localStorage.getItem('sigma_cart') || '[]');
}

function saveCart(cart) {
    localStorage.setItem('sigma_cart', JSON.stringify(cart));
    updateCartCount();
}

function updateCartCount() {
    const cart = getCart();
    const total = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
    const badge = document.getElementById('cartCount');
    if (badge) badge.innerText = total;
}

function addToCart(id, name, price) {
    const cart = getCart();
    const existing = cart.find(item => item.id === id);
    if (existing) {
        existing.quantity++;
    } else {
        cart.push({ id, name, price, quantity: 1 });
    }
    saveCart(cart);
    showToast(`${name} added to cart`);
    pulseCart();
}

function updateQty(id, delta) {
    let cart = getCart();
    const index = cart.findIndex(i => i.id === id);
    if (index !== -1) {
        cart[index].quantity += delta;
        if (cart[index].quantity < 1) cart.splice(index, 1);
        saveCart(cart);
        if (typeof renderCart === 'function') renderCart();
    }
}

function removeItem(id) {
    let cart = getCart();
    cart = cart.filter(i => i.id !== id);
    saveCart(cart);
    if (typeof renderCart === 'function') renderCart();
    showToast('Item removed from cart');
}

function pulseCart() {
    const cartBtn = document.querySelector('.cart-btn');
    if (cartBtn) {
        cartBtn.classList.add('pulse');
        setTimeout(() => cartBtn.classList.remove('pulse'), 500);
    }
}

// ============================================
// WISHLIST FUNCTIONS
// ============================================
function getWishlist() {
    return JSON.parse(localStorage.getItem('sigma_wishlist') || '[]');
}

function saveWishlist(wishlist) {
    localStorage.setItem('sigma_wishlist', JSON.stringify(wishlist));
}

function toggleWishlist(productId) {
    let wishlist = getWishlist();
    if (wishlist.includes(productId)) {
        wishlist = wishlist.filter(id => id !== productId);
        showToast('Removed from wishlist');
    } else {
        wishlist.push(productId);
        showToast('Added to wishlist');
    }
    saveWishlist(wishlist);
    renderProducts();
}

function isInWishlist(productId) {
    return getWishlist().includes(productId);
}

// ============================================
// RECENTLY VIEWED FUNCTIONS
// ============================================
function getRecentlyViewed() {
    return JSON.parse(localStorage.getItem('sigma_recently_viewed') || '[]');
}

function addToRecentlyViewed(id) {
    let recent = getRecentlyViewed();
    recent = recent.filter(i => i !== id);
    recent.unshift(id);
    if (recent.length > 5) recent.pop();
    localStorage.setItem('sigma_recently_viewed', JSON.stringify(recent));
    renderRecentlyViewed();
}

function renderRecentlyViewed() {
    const container = document.getElementById('recentlyViewed');
    if (!container) return;
    
    const recentIds = getRecentlyViewed();
    if (recentIds.length === 0 || products.length === 0) {
        container.innerHTML = '<p style="color:#888; font-size:14px;">No recent views</p>';
        return;
    }
    
    const recentProducts = products.filter(p => recentIds.includes(p.id));
    container.innerHTML = recentProducts.map(p => {
        const imgSrc = getProductImage(p);
        return `
            <div style="display:flex; align-items:center; gap:10px; padding:10px 0; border-bottom:1px solid #eee;">
                <img src="${imgSrc}" style="width:45px;height:45px;object-fit:cover;border-radius:8px;" onerror="this.src='https://placehold.co/45x45/111/white?text=?'">
                <div style="flex:1">
                    <div style="font-size:13px; font-weight:500;">${escapeHtml(p.name)}</div>
                    <div style="font-size:12px; color:#e05a2a;">$${p.price}</div>
                </div>
                <button onclick="addToCart('${p.id}','${escapeHtml(p.name)}',${p.price})" style="background:#111;color:white;border:none;padding:5px 12px;border-radius:20px;cursor:pointer;font-size:12px;">Buy</button>
            </div>
        `;
    }).join('');
}

// ============================================
// PRODUCT IMAGE HELPER
// ============================================
function getProductImage(product) {
    if (!product.image) {
        return `https://placehold.co/400x300/1a1a2e/white?text=${encodeURIComponent(product.name)}`;
    }
    if (product.image.startsWith('http')) {
        return product.image;
    }
    return `${API_URL}/uploads/${product.image}`;
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// ============================================
// RENDER PRODUCTS GRID
// ============================================
function renderProducts() {
    const grid = document.getElementById('productsGrid');
    if (!grid) return;
    
    if (products.length === 0) {
        grid.innerHTML = '<p style="text-align:center;padding:40px;">Loading products...</p>';
        return;
    }
    
    let filtered = [...products];
    
    if (currentFilter !== 'all') {
        filtered = filtered.filter(p => p.category === currentFilter);
    }
    
    if (searchTerm.trim()) {
        filtered = filtered.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }
    
    if (currentSort === 'priceLow') {
        filtered.sort((a, b) => a.price - b.price);
    } else if (currentSort === 'priceHigh') {
        filtered.sort((a, b) => b.price - a.price);
    }
    
    if (filtered.length === 0) {
        grid.innerHTML = '<p style="text-align:center;padding:40px;">No products found</p>';
        return;
    }
    
    grid.innerHTML = filtered.map(p => {
        const heartColor = isInWishlist(p.id) ? '#e05a2a' : '#ccc';
        const imageSrc = getProductImage(p);
        
        return `
            <div class="product-card" onclick="addToRecentlyViewed('${p.id}')">
                <div style="position:relative;">
                    <img src="${imageSrc}" class="product-image" onerror="this.src='https://placehold.co/400x300/ff6b6b/white?text=Image+Error'" loading="lazy">
                    <button onclick="event.stopPropagation(); toggleWishlist('${p.id}')" style="position:absolute;top:10px;right:10px;background:white;border:none;border-radius:50%;width:35px;height:35px;cursor:pointer;font-size:18px;box-shadow:0 2px 10px rgba(0,0,0,0.1);">
                        <span style="color:${heartColor};">♥</span>
                    </button>
                </div>
                <div class="product-info">
                    <div class="product-title">${escapeHtml(p.name)}</div>
                    <div class="product-price">$${p.price}</div>
                    <button class="add-btn" onclick="event.stopPropagation(); addToCart('${p.id}','${escapeHtml(p.name)}',${p.price})">Add to Cart</button>
                </div>
            </div>
        `;
    }).join('');
}

// ============================================
// FILTER AND SORT EVENT LISTENERS
// ============================================
function setupEventListeners() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchTerm = e.target.value;
            renderProducts();
        });
    }
    
    const clearBtn = document.getElementById('clearSearch');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            if (searchInput) searchInput.value = '';
            searchTerm = '';
            renderProducts();
        });
    }
    
    const sortSelect = document.getElementById('sortBy');
    if (sortSelect) {
        sortSelect.addEventListener('change', (e) => {
            currentSort = e.target.value;
            renderProducts();
        });
    }
    
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            renderProducts();
        });
    });
    
    const darkToggle = document.getElementById('darkToggle');
    if (darkToggle) {
        darkToggle.addEventListener('click', () => {
            document.body.classList.toggle('dark');
            darkToggle.innerText = document.body.classList.contains('dark') ? '☀️' : '🌙';
            localStorage.setItem('sigma_dark', document.body.classList.contains('dark'));
        });
        if (localStorage.getItem('sigma_dark') === 'true') {
            document.body.classList.add('dark');
            darkToggle.innerText = '☀️';
        }
    }
}

// ============================================
// INITIALIZE ON PAGE LOAD
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded - initializing Sigma Store');
    setupEventListeners();
    updateCartCount();
    loadProducts();
});

// Make functions global
window.addToCart = addToCart;
window.updateQty = updateQty;
window.removeItem = removeItem;
window.toggleWishlist = toggleWishlist;
window.refreshProductsFromServer = refreshProductsFromServer;
window.showConfetti = function() {
    console.log('Confetti!');
};