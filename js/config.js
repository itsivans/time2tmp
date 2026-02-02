/**
 * Firebase Configuration
 * Shared across all pages
 */

const firebaseConfig = {
  apiKey: "AIzaSyDEq8aUhdBPcjYM6H6909DldXAdjhRNWbI",
  authDomain: "time-ff7ed.firebaseapp.com",
  projectId: "time-ff7ed",
  storageBucket: "time-ff7ed.appspot.com",
  messagingSenderId: "842285944784",
  appId: "1:842285944784:web:de483548153abc956033d5",
  measurementId: "G-ZR0BNWGVXJ"
};

// Initialize Firebase (only once)
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// Enable offline persistence
firebase.firestore().enablePersistence({ synchronizeTabs: true }).catch(e => {
  console.warn('Persistence non attiva:', e.code);
});

// Make auth and db globally available (no module system, so use window)
window.auth = firebase.auth();
window.db = firebase.firestore();

// Also create aliases without window prefix for convenience
const auth = window.auth;
const db = window.db;
