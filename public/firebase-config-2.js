// Firebase Configuration for Second Project (preorder-11942)
// Used for Pre-order print functions

const firebaseConfig2 = {
  apiKey: "AIzaSyAxSqZTLDLqbbJeyLVuYt5ZXIvz5voQjxk",
  authDomain: "preorder-11942.firebaseapp.com",
  projectId: "preorder-11942",
  storageBucket: "preorder-11942.firebasestorage.app",
  messagingSenderId: "1066095236348",
  appId: "1:1066095236348:web:c48a84912f1f4775cab379",
  measurementId: "G-7L99X9S8XM"
};

// Initialize Second Firebase App (named 'preorder')
let db2 = null;
try {
  const app2 = firebase.initializeApp(firebaseConfig2, 'preorder');
  db2 = app2.firestore();
  console.log("✅ Firebase 2 (preorder) Initialized");
} catch (e) {
  console.error("❌ Firebase 2 init error:", e);
}
