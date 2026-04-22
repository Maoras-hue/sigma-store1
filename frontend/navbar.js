const API_URL = window.BACKEND_URL || 'https://sigma-store-api.onrender.com';

function isTokenValid() {
    const token = localStorage.getItem('authToken');
    const expiry = localStorage.getItem('authTokenExpiry');
    if (!token || !expiry) return false;
    return Date.now() < parseInt(expiry);
}

async function updateAuthLink() {
    const authLink = document.getElementById('authLink');
    if (!authLink) return;
    
    if (!isTokenValid()) {
        localStorage.removeItem('authToken');
        localStorage.removeItem('authTokenExpiry');
        authLink.innerHTML = 'login';
        authLink.href = 'login.html';
        return;
    }
    
    const token = localStorage.getItem('authToken');
    
    try {
        const res = await fetch(API_URL + '/api/me', {
            headers: { 'Authorization': token }
        });
        
        if (res.ok) {
            authLink.innerHTML = 'logout';
            authLink.href = '#';
            authLink.onclick = (e) => {
                e.preventDefault();
                localStorage.removeItem('authToken');
                localStorage.removeItem('authTokenExpiry');
                window.location.href = 'index.html';
            };
        } else {
            localStorage.removeItem('authToken');
            localStorage.removeItem('authTokenExpiry');
            authLink.innerHTML = 'login';
            authLink.href = 'login.html';
        }
    } catch(e) {
        console.log('Auth error:', e);
    }
}

function updateCartCount() {
    const cart = JSON.parse(localStorage.getItem('sigma_cart') || '[]');
    const total = cart.reduce((s, i) => s + (i.quantity || 1), 0);
    const badge = document.getElementById('cartCount');
    if (badge) badge.innerText = total;
}

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

document.addEventListener('DOMContentLoaded', () => {
    updateAuthLink();
    updateCartCount();
    initDarkMode();
});