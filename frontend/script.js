// ============================================
// SIGMA STORE - MAIN FRONTEND SCRIPT
// ============================================
let products = [];
let currentFilter = 'all';
let searchTerm = '';
let currentSort = 'default';

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
    } catch (error) {
        console.error('Error loading products:', error);
        if (grid) grid.innerHTML = '<p style="text-align:center; padding:40px;">❌ Cannot load products. Make sure backend is running.</p>';
    }
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
        font-size: 14px;
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

function updateQty(id, delta) {
    let cart = getCart();
    const index = cart.findIndex(i => i.id === id);
    if (index !== -1) {
        cart[index].quantity += delta;
        if (cart[index].quantity < 1) cart.splice(index, 1);
        saveCart(cart);
        renderCart();
    }
}

function removeItem(id) {
    let cart = getCart();
    cart = cart.filter(i => i.id !== id);
    saveCart(cart);
    renderCart();
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
        showToast('♥ Removed from wishlist');
    } else {
        wishlist.push(productId);
        showToast('♥ Added to wishlist');
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
                    <div style="font-size:13px; font-weight:500;">${p.name}</div>
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
    
    // Apply category filter
    if (currentFilter !== 'all') {
        filtered = filtered.filter(p => p.category === currentFilter);
    }
    
    // Apply search filter
    if (searchTerm.trim()) {
        filtered = filtered.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }
    
    // Apply sorting
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
                    <button onclick="event.stopPropagation(); toggleWishlist('${p.id}')" class="wishlist-btn" style="position:absolute;top:10px;right:10px;background:white;border:none;border-radius:50%;width:35px;height:35px;cursor:pointer;font-size:18px;box-shadow:0 2px 10px rgba(0,0,0,0.1);">
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
// RENDER CART PAGE
// ============================================
function renderCart() {
    const container = document.getElementById('cartItems');
    if (!container) return;
    
    const cart = getCart();
    
    if (cart.length === 0) {
        container.innerHTML = '<p style="text-align:center;padding:40px;">🛒 Your cart is empty</p>';
        const totalContainer = document.getElementById('cartTotal');
        if (totalContainer) totalContainer.innerHTML = '';
        return;
    }
    
    let subtotal = 0;
    let html = '<div style="background:white; border-radius:16px; overflow:hidden;">';
    
    for (let item of cart) {
        const itemTotal = item.price * item.quantity;
        subtotal += itemTotal;
        html += `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:15px; border-bottom:1px solid #eee; flex-wrap:wrap; gap:10px;">
                <div style="flex:2;">
                    <strong>${escapeHtml(item.name)}</strong><br>
                    <span style="font-size:13px; color:#666;">$${item.price} each</span>
                </div>
                <div style="display:flex; gap:8px; align-items:center;">
                    <button onclick="updateQty('${item.id}', -1)" style="width:30px;height:30px;border-radius:50%;border:1px solid #ddd;background:white;cursor:pointer;">-</button>
                    <span style="min-width:30px;text-align:center;">${item.quantity}</span>
                    <button onclick="updateQty('${item.id}', 1)" style="width:30px;height:30px;border-radius:50%;border:1px solid #ddd;background:white;cursor:pointer;">+</button>
                    <button onclick="removeItem('${item.id}')" style="background:#e05a2a;color:white;border:none;padding:6px 12px;border-radius:20px;cursor:pointer;">Remove</button>
                </div>
                <div style="min-width:80px;text-align:right;"><strong>$${itemTotal}</strong></div>
            </div>
        `;
    }
    
    const shipping = subtotal > 120 ? 0 : 12;
    const total = subtotal + shipping;
    
    html += '</div>';
    container.innerHTML = html;
    
    const totalContainer = document.getElementById('cartTotal');
    if (totalContainer) {
        totalContainer.innerHTML = `
            <div style="background:white; border-radius:16px; padding:20px; margin-top:20px;">
                <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                    <span>Subtotal:</span><span>$${subtotal}</span>
                </div>
                <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                    <span>Shipping:</span><span>${shipping === 0 ? 'Free' : '$' + shipping}</span>
                </div>
                <div style="display:flex; justify-content:space-between; font-size:20px; font-weight:bold; margin-top:15px; padding-top:15px; border-top:2px solid #eee;">
                    <span>Total:</span><span>$${total}</span>
                </div>
                ${subtotal < 120 ? `<p style="color:#666; font-size:12px; margin-top:10px;">💡 Add $${120 - subtotal} more for free shipping</p>` : '<p style="color:#4caf50; font-size:12px; margin-top:10px;">✓ Free shipping applied</p>'}
            </div>
        `;
    }
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
// CREATE ORDER FUNCTION
// ============================================
async function createOrder(paymentMethod, paymentId = null) {
    const cart = getCart();
    if (cart.length === 0) {
        showToast('Cart is empty', 'error');
        return null;
    }
    
    let subtotal = 0;
    for (let item of cart) {
        subtotal += item.price * item.quantity;
    }
    const shipping = subtotal > 120 ? 0 : 12;
    const total = subtotal + shipping;
    const notes = document.getElementById('orderNotes')?.value || '';
    const token = localStorage.getItem('authToken');
    
    if (!token) {
        if (confirm('Please login to place order. Go to login page?')) {
            window.location.href = 'login.html';
        }
        return null;
    }
    
    try {
        const response = await fetch(`${API_URL}/api/orders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': token
            },
            body: JSON.stringify({
                items: cart,
                subtotal: subtotal,
                shipping: shipping,
                total: total,
                notes: notes,
                paymentMethod: paymentMethod,
                paymentId: paymentId
            })
        });
        
        const data = await response.json();
        if (data.success) {
            return data.order;
        } else {
            showToast(data.error || 'Order failed', 'error');
            return null;
        }
    } catch (error) {
        console.error('Order error:', error);
        showToast('Server error. Please try again.', 'error');
        return null;
    }
}

// ============================================
// WHATSAPP ORDER
// ============================================
async function sendWhatsAppOrder() {
    const cart = getCart();
    if (cart.length === 0) {
        showToast('Cart is empty', 'error');
        return;
    }
    
    const order = await createOrder('whatsapp');
    if (!order) return;
    
    let itemsList = '';
    for (let item of cart) {
        itemsList += `${item.name} x ${item.quantity} = $${item.price * item.quantity}\n`;
    }
    
    let subtotal = 0;
    for (let item of cart) subtotal += item.price * item.quantity;
    const shipping = subtotal > 120 ? 0 : 12;
    const total = subtotal + shipping;
    const notes = document.getElementById('orderNotes')?.value || '';
    
    let userName = 'Customer';
    try {
        const user = JSON.parse(localStorage.getItem('sigma_user') || 'null');
        if (user && user.name) userName = user.name;
    } catch(e) {}
    
    const message = `🛒 NEW ORDER #${order.orderId}\n\n👤 Customer: ${userName}\n\n📦 ITEMS:\n${itemsList}\n💰 Subtotal: $${subtotal}\n🚚 Shipping: ${shipping === 0 ? 'Free' : '$' + shipping}\n💵 TOTAL: $${total}\n\n📝 Notes: ${notes || 'None'}\n\n🔗 Track: ${window.location.origin}/track.html?order=${order.orderId}`;
    
    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/923259042317?text=${encodedMessage}`, '_blank');
    
    localStorage.removeItem('sigma_cart');
    updateCartCount();
    if (typeof renderCart === 'function') renderCart();
    
    showToast(`✓ Order placed! ID: ${order.orderId}`);
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

// ============================================
// MAGNETIC BUTTON EFFECTS
// ============================================
document.addEventListener('DOMContentLoaded', function() {
    const buttons = document.querySelectorAll('.btn, .add-btn, .filter-btn');
    buttons.forEach(btn => {
        btn.addEventListener('mousemove', function(e) {
            const rect = this.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            const moveX = (x - centerX) / 15;
            const moveY = (y - centerY) / 15;
            this.style.transform = `translate(${moveX}px, ${moveY}px)`;
        });
        btn.addEventListener('mouseleave', function() {
            this.style.transform = 'translate(0, 0)';
        });
        btn.addEventListener('click', function(e) {
            const ripple = document.createElement('span');
            ripple.classList.add('ripple');
            const rect = this.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            ripple.style.left = x + 'px';
            ripple.style.top = y + 'px';
            this.appendChild(ripple);
            setTimeout(() => ripple.remove(), 600);
        });
    });
});

// ============================================
// SCROLL HEADER EFFECT
// ============================================
window.addEventListener('scroll', function() {
    const header = document.querySelector('.header');
    if (header) {
        if (window.scrollY > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    }
});

// ============================================
// CONFETTI EFFECT
// ============================================
function showConfetti() {
    const colors = ['#e05a2a', '#ff8c42', '#4caf50', '#2196f3', '#9c27b0', '#ffeb3b'];
    for (let i = 0; i < 100; i++) {
        const confetti = document.createElement('div');
        confetti.classList.add('confetti');
        confetti.style.left = Math.random() * 100 + '%';
        confetti.style.width = (Math.random() * 10 + 5) + 'px';
        confetti.style.height = confetti.style.width;
        confetti.style.background = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.animationDuration = (Math.random() * 3 + 2) + 's';
        confetti.style.animationDelay = Math.random() * 0.5 + 's';
        document.body.appendChild(confetti);
        setTimeout(() => confetti.remove(), 3500);
    }
}

window.showConfetti = showConfetti;
window.addToCart = addToCart;
window.updateQty = updateQty;
window.removeItem = removeItem;
window.sendWhatsAppOrder = sendWhatsAppOrder;
window.toggleWishlist = toggleWishlist;