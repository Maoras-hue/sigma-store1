<script> 
function acceptCookies() { localStorage.setItem('cookiesAccepted', 'true'); document.getElementById('cookieBanner').style.display = 'none'; } 
function declineCookies() { localStorage.setItem('cookiesAccepted', 'false'); document.getElementById('cookieBanner').style.display = 'none'; } 
if (localStorage.getItem('cookiesAccepted') === null) { document.getElementById('cookieBanner').style.display = 'flex'; } 
</script> 
