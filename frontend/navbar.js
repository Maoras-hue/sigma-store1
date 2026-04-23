// ============================================
// SIGMA STORE - NAVIGATION & AUTH SYSTEM
// ============================================

// BACKEND_URL is defined in config.js - use window.BACKEND_URL

// ============================================
// CART FUNCTIONS
// ============================================

function updateCartCount() {
    const cart = JSON.parse(localStorage.getItem('sigma_cart') || '[]');
    const total = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
    const badge = document.getElementById('cartCount');
    if (badge) badge.innerText = total;
}

// ============================================
// AUTH FUNCTIONS
// ============================================

async function updateAuthLink() {
    const authLink = document.getElementById('authLink');
    if (!authLink) return;
    
    const token = localStorage.getItem('authToken');
    
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
                localStorage.removeItem('authToken');
                localStorage.removeItem('authTokenExpiry');
                localStorage.removeItem('sigma_user');
                window.location.href = 'index.html';
            };
        } else {
            localStorage.removeItem('authToken');
            localStorage.removeItem('authTokenExpiry');
            authLink.innerHTML = 'Login';
            authLink.href = 'login.html';
            authLink.onclick = null;
        }
    } catch (error) {
        console.error('Auth error:', error);
        const storedUser = localStorage.getItem('sigma_user');
        if (storedUser) {
            try {
                const user = JSON.parse(storedUser);
                const name = user.name || user.email.split('@')[0];
                authLink.innerHTML = `Logout (${name})`;
                authLink.href = '#';
                authLink.onclick = (e) => {
                    e.preventDefault();
                    localStorage.removeItem('authToken');
                    localStorage.removeItem('authTokenExpiry');
                    localStorage.removeItem('sigma_user');
                    window.location.href = 'index.html';
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

document.addEventListener('DOMContentLoaded', () => {
    updateCartCount();
    updateAuthLink();
    initDarkMode();
    initScrollEffect();
});

// ============================================
// EXPORT FOR GLOBAL USE
// ============================================

window.updateCartCount = updateCartCount;