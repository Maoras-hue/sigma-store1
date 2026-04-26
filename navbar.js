function getAuthToken() {
    // Try all possible token locations
    var token = localStorage.getItem('sigma_token');
    if (token) return token;
    token = localStorage.getItem('sigma_token');
    if (token) return token;
    return null;
}

function isLoggedIn() { var token = getAuthToken(); if (!token) return false; return true; }

function clearAuth() {
    localStorage.removeItem('sigma_token');
    localStorage.removeItem('sigma_token_expiry');
    localStorage.removeItem('sigma_token');
    localStorage.removeItem('sigma_tokenExpiry');
    localStorage.removeItem('sigma_user');
}

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
    
    token = localStorage.getItem('sigma_token');
    if (token) return token;
    
    token = localStorage.getItem('sigma_auth_token');
    if (token) return token;
    
    return null;
}

function isLoggedIn() {
    var token = getAuthToken();
    var expiry = localStorage.getItem('sigma_token_expiry') || localStorage.getItem('sigma_tokenExpiry');
    
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
    localStorage.removeItem('sigma_token');
    localStorage.removeItem('sigma_tokenExpiry');
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

async function updateAuthButton() {
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
            var profilePic = user.profile_picture || null;
            
            // Get latest profile picture from server
            var token = getAuthToken();
            if (token) {
                try {
                    var picResponse = await fetch(API_URL + '/api/profile-picture', {
                        headers: { 'Authorization': token }
                    });
                    var picData = await picResponse.json();
                    if (picData.profilePicture) {
                        profilePic = API_URL + picData.profilePicture;
                        user.profile_picture = profilePic;
                        localStorage.setItem('sigma_user', JSON.stringify(user));
                    }
                } catch(e) {}
            }
            
            // Create profile image HTML
            var profileImgHtml = '';
            if (profilePic) {
                profileImgHtml = '<img src="' + profilePic + '" style="width:28px; height:28px; border-radius:50%; object-fit:cover; margin-right:8px;">';
            } else {
                profileImgHtml = '<div style="width:28px; height:28px; border-radius:50%; background:#e05a2a; color:white; display:inline-flex; align-items:center; justify-content:center; margin-right:8px; font-size:14px;">' + (displayName.charAt(0).toUpperCase()) + '</div>';
            }
            
            authLink.innerHTML = profileImgHtml + displayName + ' ▼';
            authLink.href = '#';
            authLink.style.display = 'flex';
            authLink.style.alignItems = 'center';
            
            authLink.onclick = function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                var existing = document.getElementById('userDropdown');
                if (existing) existing.remove();
                
                var dropdown = document.createElement('div');
                dropdown.id = 'userDropdown';
                dropdown.style.cssText = 'position:absolute; right:20px; top:60px; background:white; border-radius:8px; box-shadow:0 4px 20px rgba(0,0,0,0.15); z-index:1000; min-width:180px; overflow:hidden;';
                
                dropdown.innerHTML = `
                    <div style="display:flex; align-items:center; padding:12px 16px; border-bottom:1px solid #eee;">
                        ${profileImgHtml}
                        <div>
                            <div style="font-weight:bold;">${displayName}</div>
                            <div style="font-size:11px; color:#888;">${user.email}</div>
                        </div>
                    </div>
                    <a href="profile.html" style="display:block; padding:12px 16px; color:#333; text-decoration:none; border-bottom:1px solid #eee;">👤 My Profile</a>
                    <a href="#" onclick="logoutAndRedirect()" style="display:block; padding:12px 16px; color:#e05a2a; text-decoration:none;">🚪 Logout</a>
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
        } catch(e) {
            authLink.innerHTML = 'Login';
            authLink.href = 'login.html';
        }
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