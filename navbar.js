// Sigma Store - Navigation and Auth Functions (CLEAN VERSION)

var API_URL = window.BACKEND_URL || 'https://sigma-store-api.onrender.com';

// ============================================
// AUTH FUNCTIONS - SINGLE VERSION
// ============================================

function getAuthToken() { return localStorage.getItem("sigma_token"); }

function isLoggedIn() { return !!localStorage.getItem("sigma_token"); }

function clearAuth() { localStorage.removeItem("sigma_token"); localStorage.removeItem("sigma_token_expiry"); localStorage.removeItem("sigma_user"); }

function logoutAndRedirect() {
    var token = getAuthToken();
    if (token) {
        fetch(API_URL + '/api/logout', {
            method: 'POST',
            headers: { 'Authorization': token }
        }).catch(function() {});
    }
    clearAuth();
    window.location.href = 'index.html';
}

function getUser() {
    var userStr = localStorage.getItem('sigma_user');
    if (userStr) {
        try {
            return JSON.parse(userStr);
        } catch(e) {
            return null;
        }
    }
    return null;
}

// ============================================
// CART FUNCTIONS
// ============================================

function updateCartCount() {
    var cart = JSON.parse(localStorage.getItem('sigma_cart') || '[]');
    var total = 0;
    for (var i = 0; i < cart.length; i++) {
        total = total + (cart[i].quantity || 1);
    }
    var badge = document.getElementById('cartCount');
    if (badge) badge.innerText = total;
}

// ============================================
// AUTH BUTTON - SINGLE VERSION
// ============================================

function updateAuthButton() {
    var authLink = document.getElementById('authLink');
    if (!authLink) return;
    
    if (!isLoggedIn()) {
        authLink.innerHTML = 'Login';
        authLink.href = 'login.html';
        authLink.onclick = null;
        authLink.style.display = 'inline-block';
        return;
    }
    
    var user = getUser();
    if (user) {
        var displayName = user.name || (user.email ? user.email.split('@')[0] : 'User');
        authLink.innerHTML = displayName + ' ▼';
        authLink.href = '#';
        authLink.style.display = 'inline-block';
        authLink.style.fontWeight = '600';
        authLink.style.color = '#e05a2a';
        
        authLink.onclick = function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            var existing = document.getElementById('userDropdown');
            if (existing) existing.remove();
            
            var dropdown = document.createElement('div');
            dropdown.id = 'userDropdown';
            dropdown.style.cssText = 'position:absolute; right:20px; top:60px; background:white; border-radius:8px; box-shadow:0 4px 20px rgba(0,0,0,0.15); z-index:1000; min-width:160px; overflow:hidden;';
            
            dropdown.innerHTML = `
                <div style="padding:12px 16px; border-bottom:1px solid #eee; background:#f8f9fa;">
                    <div style="font-weight:bold;">${displayName}</div>
                    <div style="font-size:11px; color:#888;">${user.email || ''}</div>
                </div>
                <a href="profile.html" style="display:block; padding:12px 16px; color:#333; text-decoration:none; border-bottom:1px solid #eee;">My Profile</a>
                <a href="#" onclick="logoutAndRedirect()" style="display:block; padding:12px 16px; color:#e05a2a; text-decoration:none;">Logout</a>
            `;
            
            document.body.appendChild(dropdown);
            
            function closeDropdown(e) {
                if (!dropdown.contains(e.target) && e.target !== authLink) {
                    dropdown.remove();
                    document.removeEventListener('click', closeDropdown);
                }
            }
            setTimeout(function() { document.addEventListener('click', closeDropdown); }, 100);
        };
    } else {
        authLink.innerHTML = 'Login';
        authLink.href = 'login.html';
    }
}

// ============================================
// DARK MODE
// ============================================

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

// ============================================
// SCROLL EFFECT
// ============================================

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

// ============================================
// INITIALIZE
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('Navbar initializing...');
    updateCartCount();
    updateAuthButton();
    initDarkMode();
    initScrollEffect();
    console.log('Navbar initialized. Logged in:', isLoggedIn());
});

// ============================================
// GLOBAL EXPORTS
// ============================================

window.updateCartCount = updateCartCount;
window.isLoggedIn = isLoggedIn;
window.getAuthToken = getAuthToken;
window.clearAuth = clearAuth;
window.logoutAndRedirect = logoutAndRedirect;
window.updateAuthButton = updateAuthButton;