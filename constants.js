// App Configuration - Change values here to update everywhere
const APP_CONFIG = {
    FREE_SHIPPING_THRESHOLD: 120,
    SHIPPING_COST: 12,
    PRODUCTS_PER_PAGE: 6,
    TOAST_DURATION: 3000,
    CART_PULSE_DURATION: 500,
    MAX_REVIEW_LENGTH: 500,
    DEFAULT_CURRENCY: '$',
    SITE_NAME: 'Sigma Store'
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = APP_CONFIG;
}