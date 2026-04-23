// ============================================
// SIGMA STORE - NAVIGATION AND AUTH
// ============================================

// ============================================
// CART FUNCTIONS
// ============================================

function updateCartCount() {
    const cart = JSON.parse(localStorage.getItem('sigma_cart') || '[]');
    const total = cart.reduce(function(sum, item) {
        return sum + (item.quantity || 1);
    }, 0);
    const badge = document.getElementById('cartCount');
    if (badge) badge.innerText = total;
}

// ============================================
// AUTH FUNCTIONS
// ============================================

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

function logoutAndRedirect() {
    clearAuth();
    window.location.href = 'index.html';
}

// ============================================
// UPDATE AUTH BUTTON WITH DROPDOWN
// ============================================

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
            
            // Change the login link to show username with dropdown indicator
            authLink.innerHTML = displayName + ' ▼';
            authLink.href = '#';
            authLink.onclick = function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                // Remove existing dropdown
                var existing = document.getElementById('userDropdown');
                if (existing) existing.remove();
                
                // Create dropdown menu
                var dropdown = document.createElement('div');
                dropdown.id = 'userDropdown';
                dropdown.style.cssText = 'position:absolute; right:20px; top:60px; background:white; border-radius:8px; box-shadow:0 4px 20px rgba(0,0,0,0.15); z-index:1000; min-width:160px; overflow:hidden;';
                
                dropdown.innerHTML = `
                    <a href="profile.html" style="display:block; padding:12px 20px; color:#333; text-decoration:none; border-bottom:1px solid #eee; transition:background 0.2s;">
                        👤 My Profile
                    </a>
                    <a href="#" onclick="logoutAndRedirect()" style="display:block; padding:12px 20px; color:#e05a2a; text-decoration:none; transition:background 0.2s;">
                        🚪 Logout
                    </a>
                `;
                
                // Add hover effects
                var links = dropdown.getElementsByTagName('a');
                for (var i = 0; i < links.length; i++) {
                    links[i].onmouseover = function() { this.style.background = '#f5f5f5'; };
                    links[i].onmouseout = function() { this.style.background = 'transparent'; };
                }
                
                document.body.appendChild(dropdown);
                
                // Close dropdown when clicking outside
                function closeDropdown(e) {
                    if (!dropdown.contains(e.target) && e.target !== authLink) {
                        dropdown.remove();
                        document.removeEventListener('click', closeDropdown);
                    }
                }
                setTimeout(function() {
                    document.addEventListener('click', closeDropdown);
                }, 100);
            };
        } catch(e) {
            authLink.innerHTML = 'Login';
            authLink.href = 'login.html';
            authLink.onclick = null;
        }
    } else {
        authLink.innerHTML = 'Login';
        authLink.href = 'login.html';
        authLink.onclick = null;
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
// INITIALIZE ALL
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    updateCartCount();
    updateAuthButton();
    initDarkMode();
    initScrollEffect();
});

// ============================================
// EXPORT FUNCTIONS FOR GLOBAL USE
// ============================================

window.updateCartCount = updateCartCount;
window.isLoggedIn = isLoggedIn;
window.getAuthToken = getAuthToken;
window.setAuthToken = setAuthToken;
window.clearAuth = clearAuth;
window.logoutAndRedirect = logoutAndRedirect;
window.updateAuthButton = updateAuthButton;