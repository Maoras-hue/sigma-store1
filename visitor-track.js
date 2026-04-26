// Visitor Tracking Script
(function() {
    const API_URL = window.BACKEND_URL || 'https://sigma-store-api.onrender.com';
    
    function getUserId() {
        let userId = localStorage.getItem('sigma_token');
        if (!userId) {
            const user = localStorage.getItem('sigma_user');
            if (user) {
                try {
                    const userData = JSON.parse(user);
                    return userData.id;
                } catch(e) {}
            }
        }
        return null;
    }
    
    function getUserInfo() {
        const user = localStorage.getItem('sigma_user');
        if (user) {
            try {
                const userData = JSON.parse(user);
                return { name: userData.name, email: userData.email };
            } catch(e) {}
        }
        return { name: null, email: null };
    }
    
    function trackVisit() {
        const userId = getUserId();
        const userInfo = getUserInfo();
        const page = window.location.pathname;
        const referrer = document.referrer;
        
        fetch(API_URL + '/api/visitor/track', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: userId,
                user_name: userInfo.name,
                user_email: userInfo.email,
                page: page,
                referrer: referrer
            })
        }).catch(e => //console.log('Track error:', e));
    }
    
    // Track on page load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', trackVisit);
    } else {
        trackVisit();
    }
})();