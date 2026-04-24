// ============================================
// SIGMA STORE - NAVIGATION AND AUTH
// ============================================

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
// AUTH FUNCTIONS
// ============================================

function isLoggedIn() {
    var token = localStorage.getItem('sigma_token');
    var expiry = localStorage.getItem('sigma_token_expiry');
    
    if (!token || !expiry) return false;
    if (Date.now() > parseInt(expiry)) {
        localStorage.removeItem('sigma_token');
        localStorage.removeItem('sigma_token_expiry');
        localStorage.removeItem('sigma_user');
        return false;
    }
    return true;
}

// ============================================
// AUTH FUNCTIONS - FIXED
// ============================================

function getAuthToken() {
    // Try multiple possible token locations
    var token = localStorage.getItem('sigma_token');
    if (token) return token;
    
    token = localStorage.getItem('authToken');
    if (token) return token;
    
    token = localStorage.getItem('sigma_auth_token');
    if (token) return token;
    
    return null;
}

function isLoggedIn() {
    var token = getAuthToken();
    var expiry = localStorage.getItem('sigma_token_expiry') || localStorage.getItem('authTokenExpiry');
    
    if (!token) return false;
    if (expiry && Date.now() > parseInt(expiry)) {
        clearAuth();
        return false;
    }
    return true;
}

function clearAuth() {
    localStorage.removeItem('sigma_token');
    localStorage.removeItem('sigma_token_expiry');
    localStorage.removeItem('authToken');
    localStorage.removeItem('authTokenExpiry');
    localStorage.removeItem('sigma_user');
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
// UPDATE AUTH BUTTON - FIXED VERSION
// ============================================

function updateAuthButton() {
    var authLink = document.getElementById('authLink');
    if (!authLink) {
        console.log('Auth link element not found');
        return;
    }
    
    // Check if user is logged in
    var token = localStorage.getItem('sigma_token');
    var expiry = localStorage.getItem('sigma_token_expiry');
    var isValid = false;
    
    if (token && expiry && Date.now() < parseInt(expiry)) {
        isValid = true;
    }
    
    if (!isValid) {
        // Not logged in - show Login button
        authLink.innerHTML = 'Login';
        authLink.href = 'login.html';
        authLink.onclick = null;
        console.log('Auth: Showing Login button');
        return;
    }
    
    // Logged in - show username with dropdown
    var userStr = localStorage.getItem('sigma_user');
    if (userStr) {
        try {
            var user = JSON.parse(userStr);
            var displayName = user.name || user.email.split('@')[0];
            
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
                    <a href="profile.html" style="display:block; padding:12px 20px; color:#333; text-decoration:none; border-bottom:1px solid #eee;">👤 My Profile</a>
                    <a href="#" onclick="logoutAndRedirect()" style="display:block; padding:12px 20px; color:#e05a2a; text-decoration:none;">🚪 Logout</a>
                `;
                
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
            console.log('Auth: Showing logged in as', displayName);
        } catch(e) {
            authLink.innerHTML = 'Login';
            authLink.href = 'login.html';
            console.log('Auth: Error parsing user, showing Login');
        }
    } else {
        authLink.innerHTML = 'Login';
        authLink.href = 'login.html';
        console.log('Auth: No user data, showing Login');
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
    console.log('Navbar initializing...');
    updateCartCount();
    updateAuthButton();
    initDarkMode();
    initScrollEffect();
    console.log('Navbar initialized');
});

// ============================================
// EXPORT FUNCTIONS FOR GLOBAL USE
// ============================================

window.updateCartCount = updateCartCount;
window.isLoggedIn = isLoggedIn;
window.getAuthToken = getAuthToken;
window.clearAuth = clearAuth;
window.logoutAndRedirect = logoutAndRedirect;
window.updateAuthButton = updateAuthButton;