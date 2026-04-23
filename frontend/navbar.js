const BACKEND_URL = window.BACKEND_URL || 'https://sigma-store-api.onrender.com';

function updateCartCount() {
    const cart = JSON.parse(localStorage.getItem('sigma_cart') || '[]');
    const total = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
    const badge = document.getElementById('cartCount');
    if (badge) badge.innerText = total;
}

async function updateAuthLink() {
    const authLink = document.getElementById('authLink');
    if (!authLink) return;
    
    const token = localStorage.getItem('authToken');
    
    if (!token) {
        authLink.innerHTML = 'Login';
        authLink.href = 'login.html';
        return;
    }
    
    try {
        const response = await fetch(`${BACKEND_URL}/api/me`, {
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
                window.location.href = 'index.html';
            };
        } else {
            authLink.innerHTML = 'Login';
            authLink.href = 'login.html';
        }
    } catch(e) {
        authLink.innerHTML = 'Login';
        authLink.href = 'login.html';
    }
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
    updateCartCount();
    updateAuthLink();
    initDarkMode();
});

window.updateCartCount = updateCartCount;