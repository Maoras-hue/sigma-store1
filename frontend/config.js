// ============================================
// SIGMA STORE - GLOBAL CONFIGURATION
// ============================================

window.BACKEND_URL = 'https://sigma-store-api.onrender.com';

window.STORE_CONFIG = {
    name: 'Sigma Store',
    currency: '$',
    currencyCode: 'USD',
    minFreeShipping: 120,
    shippingCost: 12,
    supportWhatsApp: '+923259042317',
    supportEmail: 'ifiwas1898617@gmail.com'
};

window.PAYMENT_CONFIG = {
    stripe: { enabled: false, publicKey: '' },
    paypal: { enabled: false, clientId: '', mode: 'sandbox' }
};

window.FEATURES = {
    reviews: true,
    wishlist: true,
    multiVendor: true,
    darkMode: true,
    guestCheckout: true,
    orderTracking: true,
    whatsappOrders: true
};

console.log('✓ Sigma Store Config Loaded');
console.log('✓ Backend URL:', window.BACKEND_URL);