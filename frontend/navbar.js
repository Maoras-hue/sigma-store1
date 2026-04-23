// ============================================
// SIGMA STORE - NAVIGATION AND AUTH
// ============================================

function updateCartCount() {
    const cart = JSON.parse(localStorage.getItem('sigma_cart') || '[]');
    const total = cart.reduce(function(sum, item) {
        return sum + (item.quantity || 1);
    }, 0);
    const badge = document.getElementById('cartCount');
    if (badge) badge.innerText = total;
}

function isLoggedIn() {
    const token = localStorage.getItem('sigma_token');
    const expiry = localStorage.getItem('sigma_token_expiry');
    
    if (!token || !expiry) return false;
    if (Date.now() > parseInt(expiry)) {
        localStorage.removeItem('sigma_token');
        localStorage.removeItem('sigma_token_expiry');
        localStorage.removeItem('sigma_user');
        return false;
    }
    return true;
}

function getAuthToken() {
    if (!isLoggedIn()) return null;
    return localStorage.getItem('sigma_token');
}

function setAuthToken(token, remember) {
    var expiryDays = remember ? 30 : 7;
    var expiry = Date.now() + (expiryDays * 24 * 60 * 60 * 1000);
    localStorage.setItem('sigma_token', token);
    localStorage.setItem('sigma_token_expiry', expiry.toString());
}

function clearAuth() {
    localStorage.removeItem('sigma_token');
    localStorage.removeItem('sigma_token_expiry');
    localStorage.removeItem('sigma_user');
}

function updateAuthButton() {
    var authLink = document.getElementById('authLink');
    if (!authLink) return;
    
    if (!isLoggedIn()) {
        authLink.innerHTML = 'Login';
        authLink.href = 'login.html';
        authLink.onclick = null;
        return;
    }
    
    var userStr = localStorage.getItem('sigma_user');
    if (userStr) {
        try {
            var user = JSON.parse(userStr);
            var displayName = user.name || user.email.split('@')[0];
            authLink.innerHTML = 'Logout (' + displayName + ')';
            authLink.href = '#';
            authLink.onclick = function(e) {
                e.preventDefault();
                clearAuth();
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

function initDarkMode() {
    var toggle = document.getElementById('darkToggle');
    if (!toggle) return;
    
    var isDark = localStorage.getItem('sigma_dark') === 'true';
    if (isDark) document.body.classList.add('dark');
    toggle.innerText = isDark ? '☀️' : '🌙';
    
    toggle.onclick = function() {
        document.body.classList.toggle('dark');
        var dark = document.body.classList.contains('dark');
        localStorage.setItem('sigma_dark', dark);
        toggle.innerText = dark ? '☀️' : '🌙';
    };
}

function initScrollEffect() {
    var header = document.querySelector('.header');
    if (!header) return;
    
    window.addEventListener('scroll', function() {
        if (window.scrollY > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    });
}

document.addEventListener('DOMContentLoaded', function() {
    updateCartCount();
    updateAuthButton();
    initDarkMode();
    initScrollEffect();
});

window.updateCartCount = updateCartCount;
window.isLoggedIn = isLoggedIn;
window.getAuthToken = getAuthToken;
window.setAuthToken = setAuthToken;
window.clearAuth = clearAuth;