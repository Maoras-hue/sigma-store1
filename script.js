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
    
    if (currentFilter !== 'all') {
        filtered = filtered.filter(p => p.category === currentFilter);
    }
    
    if (searchTerm.trim()) {
        filtered = filtered.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }
    
    filtered = filtered.filter(p => p.price >= priceMin && p.price <= priceMax);
    
    if (minRating > 0) {
        filtered = filtered.filter(p => (productRatings[p.id] || 0) >= minRating);
    }
    
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

function renderProductsWithPagination() {
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const paginatedProducts = allFilteredProducts.slice(start, end);
    renderProductGrid(paginatedProducts);
    renderPagination();
}

// ============================================
// UPDATED RENDER PRODUCT GRID WITH BADGES & SALE PRICE
// ============================================
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
        const stock = p.stock || 999;
        const isLowStock = stock > 0 && stock <= 10;
        const isOutOfStock = stock === 0;
        
        let stockHtml = '';
        if (isOutOfStock) {
            stockHtml = '<div style="background:#e05a2a; color:white; padding:2px 8px; border-radius:20px; font-size:10px; display:inline-block; margin-bottom:5px;">❌ Out of Stock</div>';
        } else if (isLowStock) {
            stockHtml = `<div style="background:#ff9800; color:white; padding:2px 8px; border-radius:20px; font-size:10px; display:inline-block; margin-bottom:5px;">🔥 Only ${stock} left!</div>`;
        }
        
        const addButtonHtml = isOutOfStock 
            ? '<button class="add-btn" disabled style="opacity:0.5; cursor:not-allowed;">Out of Stock</button>'
            : `<button class="add-btn" onclick="event.stopPropagation(); addToCart('${p.id}','${escapeHtml(p.name)}',${p.is_sale === 1 && p.sale_price ? p.sale_price : p.price})">Add to Cart</button>`;
        
        // Generate badges HTML
        let badgesHtml = '';
        if (p.is_new === 1) {
            badgesHtml += '<span style="background:#4caf50; color:white; padding:2px 8px; border-radius:20px; font-size:10px; margin-right:5px;">🆕 NEW</span>';
        }
        if (p.is_sale === 1 && p.sale_price) {
            badgesHtml += '<span style="background:#e05a2a; color:white; padding:2px 8px; border-radius:20px; font-size:10px; margin-right:5px;">🔥 SALE</span>';
        }
        if (p.is_bestseller === 1) {
            badgesHtml += '<span style="background:#ffc107; color:#333; padding:2px 8px; border-radius:20px; font-size:10px; margin-right:5px;">⭐ BESTSELLER</span>';
        }
        if (p.label_text) {
            badgesHtml += `<span style="background:#ff9800; color:white; padding:2px 8px; border-radius:20px; font-size:10px;">${escapeHtml(p.label_text)}</span>`;
        }
        
        // Display sale price if available
        let priceHtml = '';
        const finalPrice = (p.is_sale === 1 && p.sale_price) ? p.sale_price : p.price;
        if (p.is_sale === 1 && p.sale_price) {
            priceHtml = `<div class="product-price"><span style="text-decoration:line-through; font-size:14px; color:#888;">$${p.price}</span> <span style="color:#e05a2a; font-size:1.5rem; font-weight:800;">$${p.sale_price}</span></div>`;
        } else {
            priceHtml = `<div class="product-price">$${p.price}</div>`;
        }
        
        return `
            <div class="product-card">
                <div style="position:relative;">
                    <img src="${imageSrc}" class="product-image" onclick="showQuickView('${p.id}')" style="cursor:pointer;" onerror="this.src='https://placehold.co/400x300/ff6b6b/white?text=Image+Error'" loading="lazy">
                    <button onclick="event.stopPropagation(); toggleWishlist('${p.id}')" style="position:absolute;top:10px;right:10px;background:white;border:none;border-radius:50%;width:35px;height:35px;cursor:pointer;font-size:18px;box-shadow:0 2px 10px rgba(0,0,0,0.1);">
                        <span style="color:${heartColor};">♥</span>
                    </button>
                    <button onclick="event.stopPropagation(); showQuickView('${p.id}')" style="position:absolute;bottom:10px;left:10px;background:rgba(0,0,0,0.7);color:white;border:none;border-radius:20px;padding:5px 12px;font-size:12px;cursor:pointer;">Quick View</button>
                    <button onclick="event.stopPropagation(); window.location.href='product.html?id=${p.id}'" style="position:absolute;bottom:10px;right:10px;background:rgba(0,0,0,0.7);color:white;border:none;border-radius:50%;width:35px;height:35px;cursor:pointer;font-size:16px;">📱</button>
                </div>
                <div class="product-info">
                    <div style="display:flex; flex-wrap:wrap; gap:5px; margin-bottom:10px;">${badgesHtml}</div>
                    <div class="product-title">${escapeHtml(p.name)}</div>
                    <div class="product-rating" style="display:flex; align-items:center; gap:0.25rem; margin:0.25rem 0;">
                        <span class="stars" style="font-size:12px; color:#ffc107;">${stars}</span>
                        <span class="rating-count" style="font-size:10px; color:#888;">(${rating.toFixed(1)})</span>
                    </div>
                    ${priceHtml}
                    ${stockHtml}
                    ${addButtonHtml}
                    <button class="buy-now-btn" onclick="event.stopPropagation(); buyNow('${p.id}', '${escapeHtml(p.name)}', ${finalPrice})" style="background: #e05a2a; color: white; border: none; padding: 8px 16px; border-radius: 50px; cursor: pointer; margin-top: 8px; width: 100%; font-weight:600;">Buy Now</button>
                </div>
            </div>
        `;
    }).join('');
}

function renderPagination() {
    const totalPages = Math.ceil(allFilteredProducts.length / itemsPerPage);
    const paginationDiv = document.getElementById('pagination');
    
    if (!paginationDiv || totalPages <= 1) {
        if (paginationDiv) paginationDiv.innerHTML = '';
        return;
    }
    
    let html = '';
    if (currentPage > 1) {
        html += `<button onclick="goToPage(${currentPage - 1})" style="padding:8px 12px;border-radius:8px;border:1px solid #ddd;background:white;cursor:pointer;">◀ Prev</button>`;
    }
    
    for (let i = 1; i <= totalPages; i++) {
        if (i === currentPage) {
            html += `<button style="padding:8px 12px;border-radius:8px;background:#e05a2a;color:white;border:none;cursor:pointer;">${i}</button>`;
        } else if (Math.abs(i - currentPage) <= 2 || i === 1 || i === totalPages) {
            html += `<button onclick="goToPage(${i})" style="padding:8px 12px;border-radius:8px;border:1px solid #ddd;background:white;cursor:pointer;">${i}</button>`;
        } else if (Math.abs(i - currentPage) === 3) {
            html += `<span style="padding:8px 4px;">...</span>`;
        }
    }
    
    if (currentPage < totalPages) {
        html += `<button onclick="goToPage(${currentPage + 1})" style="padding:8px 12px;border-radius:8px;border:1px solid #ddd;background:white;cursor:pointer;">Next ▶</button>`;
    }
    
    paginationDiv.innerHTML = html;
}

function goToPage(page) {
    currentPage = page;
    renderProductsWithPagination();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

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
    const product = products.find(p => p.id === id);
    const stock = product?.stock || 999;
    
    if (stock <= 0) {
        showToast('❌ Out of stock!', 'error');
        return;
    }
    
    const cart = getCart();
    const existing = cart.find(item => item.id === id);
    if (existing) {
        existing.quantity++;
    } else {
        cart.push({ id, name, price, quantity: 1 });
    }
    saveCart(cart);
    showToast(`✅ ${name} added to cart`);
    pulseCart();
}

function buyNow(id, name, price) {
    const product = products.find(p => p.id === id);
    const stock = product?.stock || 999;
    
    if (stock <= 0) {
        showToast('❌ Out of stock!', 'error');
        return;
    }
    
    const cart = getCart();
    const existing = cart.find(item => item.id === id);
    if (existing) {
        existing.quantity++;
    } else {
        cart.push({ id, name, price, quantity: 1 });
    }
    saveCart(cart);
    window.location.href = 'cart.html';
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
function getProductImage(p){if(!p.image)return "https://placehold.co/400x300/1e293b/white?text="+encodeURIComponent(p.name);if(p.image.startsWith("http"))return p.image;return API_URL+p.image;}`;
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
// SEARCH AUTOCOMPLETE
// ============================================
let searchTimeout = null;
const autocompleteList = document.getElementById('autocomplete-list');

async function showAutocomplete(query) {
    if (!query || query.length < 2) {
        if (autocompleteList) autocompleteList.style.display = 'none';
        return;
    }
    
    const filtered = products.filter(p => p.stock > 0).filter(p => 
        p.name.toLowerCase().includes(query.toLowerCase())
    ).slice(0, 8);
    
    if (filtered.length === 0) {
        autocompleteList.style.display = 'none';
        return;
    }
    
    autocompleteList.innerHTML = filtered.map(p => {
        const imgSrc = getProductImage(p);
        return `
            <div class="autocomplete-item" onclick="selectProduct('${p.id}', '${escapeHtml(p.name)}')">
                <img src="${imgSrc}" onerror="this.src='https://placehold.co/40x40/ccc/white?text=?'">
                <div class="info">
                    <div class="name">${escapeHtml(p.name)}</div>
                    <div class="price">$${p.price}</div>
                </div>
            </div>
        `;
    }).join('');
    
    autocompleteList.style.display = 'block';
}

function selectProduct(id, name) {
    const searchInput = document.getElementById('searchInput');
    searchInput.value = name;
    searchTerm = name;
    autocompleteList.style.display = 'none';
    applyFiltersAndSort();
}

document.addEventListener('click', function(e) {
    if (autocompleteList && !autocompleteList.contains(e.target) && e.target.id !== 'searchInput') {
        autocompleteList.style.display = 'none';
    }
});

// ============================================
// QUICK VIEW MODAL
// ============================================
async function showQuickView(productId) {
    try {
        const response = await fetch(`${API_URL}/api/products/${productId}`);
        const product = await response.json();
        
        const modal = document.getElementById('quickViewModal');
        const content = document.getElementById('quickViewContent');
        const rating = productRatings[productId] || 0;
        const stars = '★'.repeat(Math.round(rating)) + '☆'.repeat(5 - Math.round(rating));
        const imageSrc = getProductImage(product);
        const stock = product.stock || 999;
        const isOutOfStock = stock === 0;
        const finalPrice = (product.is_sale === 1 && product.sale_price) ? product.sale_price : product.price;
        
        let badgesHtml = '';
        if (product.is_new === 1) {
            badgesHtml += '<span style="background:#4caf50; color:white; padding:2px 8px; border-radius:20px; font-size:10px; margin-right:5px;">🆕 NEW</span>';
        }
        if (product.is_sale === 1 && product.sale_price) {
            badgesHtml += '<span style="background:#e05a2a; color:white; padding:2px 8px; border-radius:20px; font-size:10px; margin-right:5px;">🔥 SALE</span>';
        }
        if (product.is_bestseller === 1) {
            badgesHtml += '<span style="background:#ffc107; color:#333; padding:2px 8px; border-radius:20px; font-size:10px; margin-right:5px;">⭐ BESTSELLER</span>';
        }
        
        let priceHtml = '';
        if (product.is_sale === 1 && product.sale_price) {
            priceHtml = `<div style="font-size:2rem; color:#e05a2a; font-weight:800;"><span style="text-decoration:line-through; font-size:1.2rem; color:#888;">$${product.price}</span> $${product.sale_price}</div>`;
        } else {
            priceHtml = `<div style="font-size:2rem; color:#e05a2a; font-weight:800;">$${product.price}</div>`;
        }
        
        content.innerHTML = `
            <div style="display:flex; flex-direction:column; gap:20px;">
                <img src="${imageSrc}" style="width:100%; max-height:300px; object-fit:cover; border-radius:16px;" onerror="this.src='https://placehold.co/400x300/ff6b6b/white?text=Error'">
                <div style="display:flex; flex-wrap:wrap; gap:5px;">${badgesHtml}</div>
                <h2 style="font-size:1.8rem;">${escapeHtml(product.name)}</h2>
                <div style="display:flex; align-items:center; gap:0.5rem;">
                    <span style="color:#ffc107;">${stars}</span>
                    <span style="color:#888;">(${rating.toFixed(1)})</span>
                </div>
                ${priceHtml}
                <div>${stock > 0 ? `<span style="color:green;">✅ In Stock (${stock} available)</span>` : '<span style="color:red;">❌ Out of Stock</span>'}</div>
                <p style="color:#666; line-height:1.6;">${product.description || 'No description available.'}</p>
                <div style="display:flex; gap:1rem; flex-wrap:wrap;">
                    ${!isOutOfStock ? `<button onclick="addToCart('${product.id}', '${escapeHtml(product.name)}', ${finalPrice}); closeQuickView();" style="flex:1; background:linear-gradient(135deg,#e05a2a,#ff8c42); color:white; border:none; padding:12px; border-radius:50px; cursor:pointer; font-weight:600;">Add to Cart</button>` : ''}
                    <button onclick="closeQuickView()" style="background:#f0f0f0; border:none; padding:12px 25px; border-radius:50px; cursor:pointer;">Continue Shopping</button>
                </div>
            </div>
        `;
        modal.style.display = 'flex';
    } catch (error) {
        console.error('Quick view error:', error);
        alert('Failed to load product details');
    }
}

function closeQuickView() {
    const modal = document.getElementById('quickViewModal');
    if (modal) modal.style.display = 'none';
}

document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') closeQuickView();
});

// ============================================
// SETUP EVENT LISTENERS
// ============================================
function setupEventListeners() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const value = e.target.value;
            searchTerm = value;
            if (searchTimeout) clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                showAutocomplete(value);
                applyFiltersAndSort();
            }, 300);
        });
        searchInput.addEventListener('focus', () => {
            if (searchInput.value.length >= 2) {
                showAutocomplete(searchInput.value);
            }
        });
    }
    
    const clearBtn = document.getElementById('clearSearch');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            const searchInputElem = document.getElementById('searchInput');
            if (searchInputElem) searchInputElem.value = '';
            searchTerm = '';
            if (autocompleteList) autocompleteList.style.display = 'none';
            applyFiltersAndSort();
        });
    }
    
    const sortSelect = document.getElementById('sortBy');
    if (sortSelect) {
        sortSelect.addEventListener('change', (e) => {
            currentSort = e.target.value;
            applyFiltersAndSort();
        });
    }
    
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            applyFiltersAndSort();
        });
    });
    
    const priceSlider = document.getElementById('priceSlider');
    const priceMinInput = document.getElementById('priceMin');
    const priceMaxInput = document.getElementById('priceMax');
    const applyPriceFilter = document.getElementById('applyPriceFilter');
    const clearPriceFilter = document.getElementById('clearPriceFilter');
    
    if (priceSlider) {
        priceSlider.addEventListener('input', function(e) {
            const value = parseFloat(e.target.value);
            if (priceMinInput) priceMinInput.value = 0;
            if (priceMaxInput) priceMaxInput.value = value;
            priceMin = 0;
            priceMax = value;
            applyFiltersAndSort();
        });
    }
    
    if (applyPriceFilter) {
        applyPriceFilter.addEventListener('click', function() {
            priceMin = parseFloat(priceMinInput?.value) || 0;
            priceMax = parseFloat(priceMaxInput?.value) || 1000;
            if (priceSlider) priceSlider.value = priceMax;
            applyFiltersAndSort();
        });
    }
    
    if (clearPriceFilter) {
        clearPriceFilter.addEventListener('click', function() {
            priceMin = 0;
            priceMax = 1000;
            if (priceMinInput) priceMinInput.value = 0;
            if (priceMaxInput) priceMaxInput.value = 1000;
            if (priceSlider) priceSlider.value = 1000;
            applyFiltersAndSort();
        });
    }
    
    document.querySelectorAll('.rating-option').forEach(option => {
        option.addEventListener('click', function() {
            document.querySelectorAll('.rating-option').forEach(o => o.classList.remove('active'));
            this.classList.add('active');
            minRating = parseFloat(this.dataset.rating) || 0;
            applyFiltersAndSort();
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
// AUTO-REFRESH PRODUCTS
// ============================================
let lastUpdateCheck = Date.now();
let autoRefreshInterval = null;

async function refreshProductsFromServer() {
    try {
        const response = await fetch(`${API_URL}/api/products`);
        if (!response.ok) throw new Error('Failed to fetch');
        const newProducts = await response.json();
        if (products.length !== newProducts.length || JSON.stringify(products) !== JSON.stringify(newProducts)) {
            products = newProducts;
            await loadProductRatings();
            applyFiltersAndSort();
            showToast('Products updated!', 'info');
        }
    } catch(e) {}
}

async function checkForAdminUpdates() {
    try {
        const response = await fetch(`${API_URL}/api/last-product-update`);
        const data = await response.json();
        if (data.lastUpdate > lastUpdateCheck) {
            lastUpdateCheck = data.lastUpdate;
            await refreshProductsFromServer();
        }
    } catch(e) {}
}

function startAutoRefresh() {
    if (autoRefreshInterval) clearInterval(autoRefreshInterval);
    autoRefreshInterval = setInterval(() => {
        refreshProductsFromServer();
    }, 10000);
}

document.addEventListener('visibilitychange', function() {
    if (!document.hidden) refreshProductsFromServer();
});

startAutoRefresh();

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
window.buyNow = buyNow;
window.toggleWishlist = toggleWishlist;
window.goToPage = goToPage;
window.addToRecentlyViewed = addToRecentlyViewed;
window.selectProduct = selectProduct;
window.showQuickView = showQuickView;
window.closeQuickView = closeQuickView;
window.refreshProducts = refreshProductsFromServer;