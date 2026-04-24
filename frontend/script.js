// ============================================
// SIGMA STORE - MAIN FRONTEND SCRIPT
// ============================================

let products = [];
let currentFilter = 'all';
let searchTerm = '';
let currentSort = 'default';
let priceMin = 0;
let priceMax = 1000;
let minRating = 0;
let productRatings = {};
let currentPage = 1;
let itemsPerPage = 6;
let allFilteredProducts = [];

const API_URL = window.BACKEND_URL || 'https://sigma-store-api.onrender.com';

// ============================================
// LOAD PRODUCTS FROM BACKEND
// ============================================
async function loadProducts() {
    const grid = document.getElementById('productsGrid');
    if (grid) grid.innerHTML = '<div class="spinner"></div>';
    
    try {
        const response = await fetch(`${API_URL}/api/products`);
        if (!response.ok) throw new Error('Failed to fetch products');
        products = await response.json();
        console.log('Products loaded:', products.length);
        
        await loadProductRatings();
        applyFiltersAndSort();
        renderRecentlyViewed();
    } catch (error) {
        console.error('Error loading products:', error);
        if (grid) grid.innerHTML = '<p style="text-align:center; padding:40px;">❌ Cannot load products. Please try again later.</p>';
    }
}

// Load average ratings for all products
async function loadProductRatings() {
    for (let i = 0; i < products.length; i++) {
        try {
            const response = await fetch(`${API_URL}/api/products/${products[i].id}/rating`);
            const data = await response.json();
            productRatings[products[i].id] = data.averageRating || 0;
        } catch(e) {
            productRatings[products[i].id] = 0;
        }
    }
}

// Apply all filters and sorting
function applyFiltersAndSort() {
    let filtered = [...products];
    
    // Category filter
    if (currentFilter !== 'all') {
        filtered = filtered.filter(p => p.category === currentFilter);
    }
    
    // Search filter
    if (searchTerm.trim()) {
        filtered = filtered.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }
    
    // Price range filter
    filtered = filtered.filter(p => p.price >= priceMin && p.price <= priceMax);
    
    // Rating filter
    if (minRating > 0) {
        filtered = filtered.filter(p => (productRatings[p.id] || 0) >= minRating);
    }
    
    // Sort
    if (currentSort === 'priceLow') {
        filtered.sort((a, b) => a.price - b.price);
    } else if (currentSort === 'priceHigh') {
        filtered.sort((a, b) => b.price - a.price);
    } else if (currentSort === 'newest') {
        filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    } else if (currentSort === 'oldest') {
        filtered.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    } else if (currentSort === 'ratingHigh') {
        filtered.sort((a, b) => (productRatings[b.id] || 0) - (productRatings[a.id] || 0));
    } else if (currentSort === 'nameAZ') {
        filtered.sort((a, b) => a.name.localeCompare(b.name));
    } else if (currentSort === 'nameZA') {
        filtered.sort((a, b) => b.name.localeCompare(a.name));
    }
    
    allFilteredProducts = filtered;
    currentPage = 1;
    renderProductsWithPagination();
}

// Render products with pagination
function renderProductsWithPagination() {
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const paginatedProducts = allFilteredProducts.slice(start, end);
    
    renderProductGrid(paginatedProducts);
    renderPagination();
}

// Render product grid
function renderProductGrid(productsToRender) {
    const grid = document.getElementById('productsGrid');
    if (!grid) return;
    
    if (allFilteredProducts.length === 0) {
        grid.innerHTML = '<p style="text-align:center;padding:40px;">No products found</p>';
        return;
    }
    
    grid.innerHTML = productsToRender.map(p => {
        const heartColor = isInWishlist(p.id) ? '#e05a2a' : '#ccc';
        const imageSrc = getProductImage(p);
        const rating = productRatings[p.id] || 0;
        const stars = '★'.repeat(Math.round(rating)) + '☆'.repeat(5 - Math.round(rating));
        
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
                    <div class="product-rating">
                        <span class="stars">${stars}</span>
                        <span class="rating-count">(${rating.toFixed(1)})</span>
                    </div>
                    <div class="product-price">$${p.price}</div>
                    <button class="add-btn" onclick="event.stopPropagation(); addToCart('${p.id}','${escapeHtml(p.name)}',${p.price})">Add to Cart</button>
                </div>
            </div>
        `;
    }).join('');
}

// Render pagination controls
function renderPagination() {
    const totalPages = Math.ceil(allFilteredProducts.length / itemsPerPage);
    const paginationDiv = document.getElementById('pagination');
    
    if (!paginationDiv || totalPages <= 1) {
        if (paginationDiv) paginationDiv.innerHTML = '';
        return;
    }
    
    let html = '';
    
    // Previous button
    if (currentPage > 1) {
        html += `<button onclick="goToPage(${currentPage - 1})" style="padding:8px 12px;border-radius:8px;border:1px solid #ddd;background:white;cursor:pointer;">← Prev</button>`;
    }
    
    // Page numbers
    for (let i = 1; i <= totalPages; i++) {
        if (i === currentPage) {
            html += `<button style="padding:8px 12px;border-radius:8px;background:#e05a2a;color:white;border:none;cursor:pointer;">${i}</button>`;
        } else if (Math.abs(i - currentPage) <= 2 || i === 1 || i === totalPages) {
            html += `<button onclick="goToPage(${i})" style="padding:8px 12px;border-radius:8px;border:1px solid #ddd;background:white;cursor:pointer;">${i}</button>`;
        } else if (Math.abs(i - currentPage) === 3) {
            html += `<span style="padding:8px 4px;">...</span>`;
        }
    }
    
    // Next button
    if (currentPage < totalPages) {
        html += `<button onclick="goToPage(${currentPage + 1})" style="padding:8px 12px;border-radius:8px;border:1px solid #ddd;background:white;cursor:pointer;">Next →</button>`;
    }
    
    paginationDiv.innerHTML = html;
}

function goToPage(page) {
    currentPage = page;
    renderProductsWithPagination();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ============================================
// SHOW TOAST NOTIFICATION
// ============================================
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.innerText = message;
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
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
    showToast(`✓ ${name} added to cart`);
    pulseCart();
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
    applyFiltersAndSort();
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
    if (product.image.startsWith('/uploads/')) {
        return API_URL + product.image;
    }
    return API_URL + '/uploads/' + product.image;
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
// FILTER AND SORT EVENT LISTENERS
// ============================================
function setupEventListeners() {
    // Search input
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchTerm = e.target.value;
            applyFiltersAndSort();
        });
    }
    
    // Clear search
    const clearBtn = document.getElementById('clearSearch');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            if (searchInput) searchInput.value = '';
            searchTerm = '';
            applyFiltersAndSort();
        });
    }
    
    // Sort select
    const sortSelect = document.getElementById('sortBy');
    if (sortSelect) {
        sortSelect.addEventListener('change', (e) => {
            currentSort = e.target.value;
            applyFiltersAndSort();
        });
    }
    
    // Category filters
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            applyFiltersAndSort();
        });
    });
    
    // Price range filters
    const priceSlider = document.getElementById('priceSlider');
    const priceMinInput = document.getElementById('priceMin');
    const priceMaxInput = document.getElementById('priceMax');
    const applyPriceFilter = document.getElementById('applyPriceFilter');
    const clearPriceFilter = document.getElementById('clearPriceFilter');
    
    if (priceSlider) {
        priceSlider.addEventListener('input', function(e) {
            const value = parseInt(e.target.value);
            priceMinInput.value = 0;
            priceMaxInput.value = value;
            priceMin = 0;
            priceMax = value;
            applyFiltersAndSort();
        });
    }
    
    if (applyPriceFilter) {
        applyPriceFilter.addEventListener('click', function() {
            priceMin = parseInt(priceMinInput.value) || 0;
            priceMax = parseInt(priceMaxInput.value) || 1000;
            if (priceSlider) priceSlider.value = priceMax;
            applyFiltersAndSort();
        });
    }
    
    if (clearPriceFilter) {
        clearPriceFilter.addEventListener('click', function() {
            priceMin = 0;
            priceMax = 1000;
            priceMinInput.value = 0;
            priceMaxInput.value = 1000;
            if (priceSlider) priceSlider.value = 1000;
            applyFiltersAndSort();
        });
    }
    
    // Rating filters
    document.querySelectorAll('.rating-option').forEach(option => {
        option.addEventListener('click', function() {
            document.querySelectorAll('.rating-option').forEach(o => o.classList.remove('active'));
            this.classList.add('active');
            minRating = parseInt(this.dataset.rating) || 0;
            applyFiltersAndSort();
        });
    });
    
    // Dark mode
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
window.toggleWishlist = toggleWishlist;
window.goToPage = goToPage;
window.addToRecentlyViewed = addToRecentlyViewed;
// ============================================
// AUTO-REFRESH PRODUCTS
// ============================================

let lastUpdateCheck = Date.now();
let autoRefreshInterval = null;

// Function to refresh products from server
async function refreshProductsFromServer() {
    console.log('Auto-refreshing products...');
    try {
        const response = await fetch(`${API_URL}/api/products`);
        if (!response.ok) throw new Error('Failed to fetch');
        const newProducts = await response.json();
        
        // Check if products changed (compare length or first product ID)
        if (products.length !== newProducts.length || JSON.stringify(products) !== JSON.stringify(newProducts)) {
            console.log('Products updated! Reloading...');
            products = newProducts;
            await loadProductRatings();
            applyFiltersAndSort();
            showToast('Products updated!', 'info');
        }
    } catch (error) {
        console.error('Auto-refresh error:', error);
    }
}

// Check for admin updates
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
        // Silently fail if endpoint doesn't exist
    }
}

// Start auto-refresh (every 10 seconds)
function startAutoRefresh() {
    if (autoRefreshInterval) clearInterval(autoRefreshInterval);
    autoRefreshInterval = setInterval(() => {
        refreshProductsFromServer();
    }, 10000);
}

// Stop auto-refresh
function stopAutoRefresh() {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
        autoRefreshInterval = null;
    }
}

// Refresh when page becomes visible again
document.addEventListener('visibilitychange', function() {
    if (!document.hidden) {
        refreshProductsFromServer();
    }
});

// Start auto-refresh when page loads
startAutoRefresh();

// Make refresh function global for manual refresh
window.refreshProducts = refreshProductsFromServer; 
// Ensure token never expires 
function ensureTokenExpiry() { 
    var token = localStorage.getItem('sigma_token'); 
    var expiry = localStorage.getItem('sigma_token_expiry'); 
        var tenYears = 10 * 365 * 24 * 60 * 60 * 1000; 
        localStorage.setItem('sigma_token_expiry', Date.now() + tenYears); 
    } 
} 
ensureTokenExpiry(); 
