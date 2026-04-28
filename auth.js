const API_URL = window.BACKEND_URL || 'https://sigma-store-api.onrender.com';

function getAuthToken() {
    return localStorage.getItem('sigma_token');
}

function isLoggedIn() {
    const token = getAuthToken();
    const expiry = localStorage.getItem('sigma_token_expiry');
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
    localStorage.removeItem('sigma_user');
}

function logout() {
    clearAuth();
    window.location.href = 'index.html';
}