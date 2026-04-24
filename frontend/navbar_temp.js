function isLoggedIn() { var token = getAuthToken(); if (!token) return false; return true; } 
