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
