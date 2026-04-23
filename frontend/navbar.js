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
// AUTH UI UPDATES - FIXED VERSION
// ============================================

async function updateAuthLink() {
    const authLink = document.getElementById('authLink');
    if (!authLink) {
        console.log('Auth link element not found');
        return;
    }
    
    const token = getAuthToken();
    
    if (!token) {
        // User is not logged in - show Login
        authLink.innerHTML = 'Login';
        authLink.href = 'login.html';
        authLink.onclick = null;
        console.log('Auth: Not logged in, showing Login');
        return;
    }
    
    // User has token - verify with server
    try {
        const response = await fetch(`${API_URL}/api/me`, {
            headers: { 'Authorization': token }
        });
        
        if (response.ok) {
            const data = await response.json();
            const userName = data.user.name || data.user.email.split('@')[0];
            
            // Show Logout button with user name
            authLink.innerHTML = `Logout (${userName})`;
            authLink.href = '#';
            authLink.onclick = (e) => {
                e.preventDefault();
                clearAuthToken();
                // Also clear cart if you want
                // localStorage.removeItem('sigma_cart');
                window.location.href = 'index.html';
            };
            console.log('Auth: Logged in as', userName);
        } else {
            // Token invalid
            clearAuthToken();
            authLink.innerHTML = 'Login';
            authLink.href = 'login.html';
            authLink.onclick = null;
            console.log('Auth: Token invalid, showing Login');
        }
    } catch (error) {
        console.error('Auth check error:', error);
        // Keep current state, don't change UI on network error
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
    showToast(`${name} added to cart`);
    return cart;
}

// ============================================
// TOAST NOTIFICATION
// ============================================

function showToast(message) {
    const toast = document.createElement('div');
    toast.innerText = message;
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #111;
        color: white;
        padding: 12px 24px;
        border-radius: 50px;
        z-index: 9999;
        animation: fadeInUp 0.3s ease;
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// ============================================
// DARK MODE
// ============================================

function initDarkMode() {
    const toggle = document.getElementById('darkToggle');
    if (!toggle) return;
    
    const isDark = localStorage.getItem('sigma_dark') === 'true';
    
    if (isDark) {
        document.body.classList.add('dark');
        toggle.textContent = '☀️';
    } else {
        document.body.classList.remove('dark');
        toggle.textContent = '🌙';
    }
    
    toggle.onclick = () => {
        document.body.classList.toggle('dark');
        const dark = document.body.classList.contains('dark');
        localStorage.setItem('sigma_dark', dark);
        toggle.textContent = dark ? '☀️' : '🌙';
    };
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
    console.log('Navbar initializing...');
    
    // Update auth link (login/logout button)
    await updateAuthLink();
    
    // Update cart count
    updateCartCount();
    
    // Initialize dark mode
    initDarkMode();
    
    // Initialize scroll handler
    initScrollHandler();
    
    console.log('Navbar initialized');
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
window.showToast = showToast;