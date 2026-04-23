// ============================================
// SIGMA STORE - NAVIGATION & AUTH SYSTEM
// ============================================

const API_URL = window.BACKEND_URL || 'https://sigma-store-api.onrender.com';

// ============================================
// TOKEN MANAGEMENT
// ============================================

function isTokenValid() {
    const token = localStorage.getItem('authToken');
    const expiry = localStorage.getItem('authTokenExpiry');
    
    if (!token || !expiry) return false;
    
    // Check if token has expired
    if (Date.now() > parseInt(expiry)) {
        localStorage.removeItem('authToken');
        localStorage.removeItem('authTokenExpiry');
        localStorage.removeItem('sigma_user');
        return false;
    }
    
    return true;
}

function getAuthToken() {
    if (!isTokenValid()) return null;
    return localStorage.getItem('authToken');
}

function setAuthToken(token, remember = false) {
    const expiryDays = remember ? 30 : 7;
    const expiry = Date.now() + (expiryDays * 24 * 60 * 60 * 1000);
    
    localStorage.setItem('authToken', token);
    localStorage.setItem('authTokenExpiry', expiry);
}

function clearAuthToken() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('authTokenExpiry');
    localStorage.removeItem('sigma_user');
}

// ============================================
// USER MANAGEMENT
// ============================================

async function getCurrentUser() {
    const token = getAuthToken();
    if (!token) return null;
    
    try {
        const response = await fetch(`${API_URL}/api/me`, {
            headers: { 'Authorization': token }
        });
        
        if (response.ok) {
            const data = await response.json();
            localStorage.setItem('sigma_user', JSON.stringify(data.user));
            return data.user;
        } else {
            clearAuthToken();
            return null;
        }
    } catch (error) {
        console.error('Get user error:', error);
        return null;
    }
}

function getStoredUser() {
    try {
        const user = localStorage.getItem('sigma_user');
        return user ? JSON.parse(user) : null;
    } catch {
        return null;
    }
}

// ============================================
// AUTH UI UPDATES
// ============================================

async function updateAuthLink() {
    const authLink = document.getElementById('authLink');
    if (!authLink) return;
    
    const token = getAuthToken();
    
    if (!token) {
        authLink.innerHTML = '🔐 Login';
        authLink.href = 'login.html';
        authLink.onclick = null;
        return;
    }
    
    try {
        const user = await getCurrentUser();
        
        if (user) {
            authLink.innerHTML = `👤 ${user.name || user.email.split('@')[0]} (logout)`;
            authLink.href = '#';
            authLink.onclick = (e) => {
                e.preventDefault();
                clearAuthToken();
                window.location.href = 'index.html';
            };
        } else {
            authLink.innerHTML = '🔐 Login';
            authLink.href = 'login.html';
            authLink.onclick = null;
        }
    } catch (error) {
        console.error('Auth update error:', error);
        authLink.innerHTML = '🔐 Login';
        authLink.href = 'login.html';
    }
}

// ============================================
// CART MANAGEMENT
// ============================================

function getCart() {
    try {
        return JSON.parse(localStorage.getItem('sigma_cart') || '[]');
    } catch {
        return [];
    }
}

function saveCart(cart) {
    localStorage.setItem('sigma_cart', JSON.stringify(cart));
    updateCartCount();
}

function updateCartCount() {
    const cart = getCart();
    const totalItems = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
    const cartCountElement = document.getElementById('cartCount');
    
    if (cartCountElement) {
        cartCountElement.textContent = totalItems;
        
        // Add animation
        cartCountElement.style.transform = 'scale(1.2)';
        setTimeout(() => {
            cartCountElement.style.transform = 'scale(1)';
        }, 200);
    }
}

function addToCart(id, name, price, quantity = 1) {
    const cart = getCart();
    const existingItem = cart.find(item => item.id === id);
    
    if (existingItem) {
        existingItem.quantity += quantity;
    } else {
        cart.push({ id, name, price, quantity });
    }
    
    saveCart(cart);
    showToast(`✓ ${name} added to cart`, 'success');
    return cart;
}

function removeFromCart(id) {
    let cart = getCart();
    cart = cart.filter(item => item.id !== id);
    saveCart(cart);
    showToast('Item removed from cart', 'info');
    return cart;
}

function clearCart() {
    localStorage.removeItem('sigma_cart');
    updateCartCount();
}

// ============================================
// TOAST NOTIFICATION
// ============================================

function showToast(message, type = 'success') {
    // Remove existing toast
    const existingToast = document.querySelector('.sigma-toast');
    if (existingToast) existingToast.remove();
    
    const toast = document.createElement('div');
    toast.className = 'sigma-toast';
    toast.innerHTML = `
        <div class="sigma-toast-content ${type}">
            <span>${message}</span>
        </div>
    `;
    
    // Add styles if not already present
    if (!document.querySelector('#toast-styles')) {
        const style = document.createElement('style');
        style.id = 'toast-styles';
        style.textContent = `
            .sigma-toast {
                position: fixed;
                bottom: 30px;
                right: 30px;
                z-index: 10000;
                animation: slideInRight 0.3s ease;
            }
            .sigma-toast-content {
                background: #1a1a2e;
                color: white;
                padding: 12px 24px;
                border-radius: 50px;
                font-size: 14px;
                font-weight: 500;
                box-shadow: 0 4px 20px rgba(0,0,0,0.15);
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .sigma-toast-content.success {
                background: linear-gradient(135deg, #4caf50, #45a049);
            }
            .sigma-toast-content.error {
                background: linear-gradient(135deg, #e05a2a, #c44a1f);
            }
            .sigma-toast-content.info {
                background: linear-gradient(135deg, #2196f3, #1976d2);
            }
            @keyframes slideInRight {
                from {
                    opacity: 0;
                    transform: translateX(100px);
                }
                to {
                    opacity: 1;
                    transform: translateX(0);
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Add fadeOut animation
if (!document.querySelector('#fadeout-styles')) {
    const style = document.createElement('style');
    style.id = 'fadeout-styles';
    style.textContent = `
        @keyframes fadeOut {
            from { opacity: 1; transform: translateX(0); }
            to { opacity: 0; transform: translateX(100px); }
        }
    `;
    document.head.appendChild(style);
}

// ============================================
// DARK MODE
// ============================================

function initDarkMode() {
    const toggle = document.getElementById('darkToggle');
    if (!toggle) return;
    
    // Load saved preference
    const isDark = localStorage.getItem('sigma_dark') === 'true';
    
    if (isDark) {
        document.body.classList.add('dark');
        toggle.textContent = '☀️';
    } else {
        document.body.classList.remove('dark');
        toggle.textContent = '🌙';
    }
    
    // Toggle handler
    toggle.addEventListener('click', () => {
        document.body.classList.toggle('dark');
        const darkMode = document.body.classList.contains('dark');
        localStorage.setItem('sigma_dark', darkMode);
        toggle.textContent = darkMode ? '☀️' : '🌙';
        
        // Show feedback
        showToast(darkMode ? 'Dark mode enabled' : 'Light mode enabled', 'info');
    });
}

// ============================================
// WISHLIST MANAGEMENT
// ============================================

function getWishlist() {
    try {
        return JSON.parse(localStorage.getItem('sigma_wishlist') || '[]');
    } catch {
        return [];
    }
}

function saveWishlist(wishlist) {
    localStorage.setItem('sigma_wishlist', JSON.stringify(wishlist));
}

function toggleWishlist(productId) {
    let wishlist = getWishlist();
    
    if (wishlist.includes(productId)) {
        wishlist = wishlist.filter(id => id !== productId);
        showToast('♥ Removed from wishlist', 'info');
    } else {
        wishlist.push(productId);
        showToast('♥ Added to wishlist', 'success');
    }
    
    saveWishlist(wishlist);
    return wishlist;
}

function isInWishlist(productId) {
    return getWishlist().includes(productId);
}

// ============================================
// RECENTLY VIEWED
// ============================================

function getRecentlyViewed() {
    try {
        return JSON.parse(localStorage.getItem('sigma_recently_viewed') || '[]');
    } catch {
        return [];
    }
}

function addToRecentlyViewed(productId) {
    let recent = getRecentlyViewed();
    
    // Remove if already exists
    recent = recent.filter(id => id !== productId);
    
    // Add to front
    recent.unshift(productId);
    
    // Keep only last 10
    if (recent.length > 10) recent.pop();
    
    localStorage.setItem('sigma_recently_viewed', JSON.stringify(recent));
}

// ============================================
// SCROLL HANDLER
// ============================================

function initScrollHandler() {
    const header = document.querySelector('.header');
    if (!header) return;
    
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    });
}

// ============================================
// INITIALIZE ALL
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
    // Update auth link
    await updateAuthLink();
    
    // Update cart count
    updateCartCount();
    
    // Initialize dark mode
    initDarkMode();
    
    // Initialize scroll handler
    initScrollHandler();
    
    // Update user display in seller dashboard if present
    const user = getStoredUser();
    if (user && document.querySelector('.user-name')) {
        document.querySelector('.user-name').textContent = user.name || user.email;
    }
});

// ============================================
// EXPORT FUNCTIONS FOR GLOBAL USE
// ============================================

window.isTokenValid = isTokenValid;
window.getAuthToken = getAuthToken;
window.setAuthToken = setAuthToken;
window.clearAuthToken = clearAuthToken;
window.getCurrentUser = getCurrentUser;
window.getStoredUser = getStoredUser;
window.updateAuthLink = updateAuthLink;
window.getCart = getCart;
window.saveCart = saveCart;
window.updateCartCount = updateCartCount;
window.addToCart = addToCart;
window.removeFromCart = removeFromCart;
window.clearCart = clearCart;
window.showToast = showToast;
window.getWishlist = getWishlist;
window.toggleWishlist = toggleWishlist;
window.isInWishlist = isInWishlist;
window.getRecentlyViewed = getRecentlyViewed;
window.addToRecentlyViewed = addToRecentlyViewed;