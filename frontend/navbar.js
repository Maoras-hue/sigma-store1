// ============================================
// SIGMA STORE - NAVIGATION & AUTH
// API_URL is already defined in config.js
// ============================================

// ============================================
// CART FUNCTIONS
// ============================================

function getCart() {
    try {
        return JSON.parse(localStorage.getItem('sigma_cart') || '[]');
    } catch {
        return [];
    }
}

function updateCartCount() {
    const cart = getCart();
    const total = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
    const badge = document.getElementById('cartCount');
    if (badge) badge.innerText = total;
}

// ============================================
// AUTH FUNCTIONS
// ============================================

function getToken() {
    return localStorage.getItem('authToken');
}

function isLoggedIn() {
    const token = getToken();
    const expiry = localStorage.getItem('authTokenExpiry');
    if (!token || !expiry) return false;
    return Date.now() < parseInt(expiry);
}

function logout() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('authTokenExpiry');
    localStorage.removeItem('sigma_user');
    window.location.href = 'index.html';
}

// ============================================
// UPDATE LOGIN/LOGOUT BUTTON
// ============================================

async function updateAuthButton() {
    const authLink = document.getElementById('authLink');
    if (!authLink) return;
    
    const token = getToken();
    
    if (!token) {
        authLink.innerHTML = 'Login';
        authLink.href = 'login.html';
        authLink.onclick = null;
        return;
    }
    
    try {
        const response = await fetch(`${window.BACKEND_URL}/api/me`, {
            headers: { 'Authorization': token }
        });
        
        if (response.ok) {
            const data = await response.json();
            const name = data.user.name || data.user.email.split('@')[0];
            authLink.innerHTML = `Logout (${name})`;
            authLink.href = '#';
            authLink.onclick = (e) => {
                e.preventDefault();
                logout();
            };
        } else {
            localStorage.removeItem('authToken');
            localStorage.removeItem('authTokenExpiry');
            authLink.innerHTML = 'Login';
            authLink.href = 'login.html';
        }
    } catch (error) {
        const storedUser = localStorage.getItem('sigma_user');
        if (storedUser) {
            try {
                const user = JSON.parse(storedUser);
                authLink.innerHTML = `Logout (${user.name || user.email.split('@')[0]})`;
                authLink.href = '#';
                authLink.onclick = (e) => {
                    e.preventDefault();
                    logout();
                };
            } catch(e) {
                authLink.innerHTML = 'Login';
                authLink.href = 'login.html';
            }
        } else {
            authLink.innerHTML = 'Login';
            authLink.href = 'login.html';
        }
    }
}

// ============================================
// DARK MODE
// ============================================

function initDarkMode() {
    const toggle = document.getElementById('darkToggle');
    if (!toggle) return;
    
    const isDark = localStorage.getItem('sigma_dark') === 'true';
    if (isDark) document.body.classList.add('dark');
    toggle.innerText = isDark ? '☀️' : '🌙';
    
    toggle.onclick = () => {
        document.body.classList.toggle('dark');
        const dark = document.body.classList.contains('dark');
        localStorage.setItem('sigma_dark', dark);
        toggle.innerText = dark ? '☀️' : '🌙';
    };
}

// ============================================
// SCROLL EFFECT
// ============================================

function initScrollEffect() {
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
// INITIALIZE
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
    updateCartCount();
    initDarkMode();
    initScrollEffect();
    await updateAuthButton();
});

window.updateCartCount = updateCartCount;
window.logout = logout;