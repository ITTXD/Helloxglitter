// Firebase Configuration for Client-Side (Realtime)
// This file is loaded by dashboard.html and customer.html

const firebaseConfig = {
   apiKey: "AIzaSyAUM7TwEkhesXidpgVu63gKoEc-IZnI2n8",
   authDomain: "quemanagement-c392e.firebaseapp.com",
   projectId: "quemanagement-c392e",
   storageBucket: "quemanagement-c392e.firebasestorage.app",
   messagingSenderId: "1020532017419",
   appId: "1:1020532017419:web:0029e780edcabf76d8ba0e",
   measurementId: "G-TMNWBFZEHY"
};

// Initialize Firebase (Compat Mode for Script Tags)
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
    console.log("✅ Firebase Client Initialized");
}

// Initialize Firestore
const db = firebase.firestore();

// Optional: Enable Analytics if needed
// firebase.analytics();


// ==========================================
// AUTH GUARD SYSTEM
// ==========================================
(function() {
    const path = window.location.pathname;
    // Check if we are NOT on the login page
    // Note: path might be "/login.html" or just "/login" depending on server, or "/" for index
    const isLoginPage = path.includes('login.html');
    const isCustomerPage = path.includes('customer.html');

    // Debug Auth (Remove in production if needed, but helpful for debugging)
    // console.log(`Path: ${path}, Login: ${isLoginPage}, Customer: ${isCustomerPage}`);

    if (!isLoginPage && !isCustomerPage) {
        const isAuthLocal = localStorage.getItem('helloxglitter_auth') === 'true';
        const isAuthSession = sessionStorage.getItem('helloxglitter_auth') === 'true';
        
        // console.log(`Auth Local: ${isAuthLocal}, Auth Session: ${isAuthSession}`);

        if (!isAuthLocal && !isAuthSession) {
            // Store current path to redirect back after login
            const currentPath = path.split('/').pop() || 'index.html';
            window.location.href = `login.html?next=${currentPath}`;
        }
    }
})();
