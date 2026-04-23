// ============================================
// SIGMA STORE - GLOBAL CONFIGURATION
// ============================================

// Backend API URL - Change this to your deployed backend URL
window.BACKEND_URL = 'https://sigma-store-api.onrender.com';

// Alternative: Use localhost for development
// window.BACKEND_URL = 'http://localhost:3000';

// Store Configuration
window.STORE_CONFIG = {
    name: 'Sigma Store',
    currency: '$',
    currencyCode: 'USD',
    minFreeShipping: 120,
    shippingCost: 12,
    supportWhatsApp: '+923259042317',
    supportEmail: 'ifiwas1898617@gmail.com'
};

// Payment Configuration (will be loaded from backend)
window.PAYMENT_CONFIG = {
    stripe: { enabled: false, publicKey: '' },
    paypal: { enabled: false, clientId: '', mode: 'sandbox' }
};

// Feature Flags
window.FEATURES = {
    reviews: true,
    wishlist: true,
    multiVendor: true,
    darkMode: true,
    guestCheckout: true,
    orderTracking: true,
    whatsappOrders: true
};

// Admin Configuration
window.ADMIN_CONFIG = {
    password: 'sigma123',
    email: 'admin@sigma-store.com'
};

// Display configuration
console.log('✓ Sigma Store Config Loaded');
console.log('✓ Backend URL:', window.BACKEND_URL);
console.log('✓ Store Name:', window.STORE_CONFIG.name);
console.log('✓ Support:', window.STORE_CONFIG.supportWhatsApp);

// Load payment config from backend
async function loadPaymentConfig() {
    try {
        const response = await fetch(`${window.BACKEND_URL}/api/payment-config`);
        if (response.ok) {
            window.PAYMENT_CONFIG = await response.json();
            console.log('✓ Payment config loaded:', window.PAYMENT_CONFIG);
        }
    } catch (error) {
        console.log('⚠️ Payment config not available, using defaults');
    }
}

// Auto-load payment config
loadPaymentConfig();