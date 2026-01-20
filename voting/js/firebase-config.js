// Firebase configuration for voting system
// Replace these values with your own Firebase project config
// const firebaseConfig = {
//   apiKey: "YOUR_API_KEY",
//   authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
//   databaseURL: "https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com",
//   projectId: "YOUR_PROJECT_ID",
//   storageBucket: "YOUR_PROJECT_ID.appspot.com",
//   messagingSenderId: "YOUR_SENDER_ID",
//   appId: "YOUR_APP_ID"
// };

const firebaseConfig = {
  apiKey: "AIzaSyCoHBzluolSHuOA1k1yflEMEvqBSRS_AhU",
  authDomain: "authorlist-6fe08.firebaseapp.com",
  projectId: "authorlist-6fe08",
  storageBucket: "authorlist-6fe08.firebasestorage.app",
  messagingSenderId: "144644008770",
  appId: "1:144644008770:web:31b336eccc09522f9ab6db",
  measurementId: "G-TMZN6V1VEN"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// Helper function to generate random token
function generateToken(length = 32) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const randomValues = new Uint8Array(length);
  crypto.getRandomValues(randomValues);
  for (let i = 0; i < length; i++) {
    result += chars[randomValues[i] % chars.length];
  }
  return result;
}

// Helper function to generate session ID
function generateSessionId() {
  return generateToken(16);
}

// Get URL parameters
function getUrlParam(param) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(param);
}
