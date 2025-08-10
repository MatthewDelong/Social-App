// src/firebase.js
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage'; // ✅ Added

const firebaseConfig = {
  apiKey: "AIzaSyBLRU-79wJ88jj775FAxO8buS6cFI-U6lg",
  authDomain: "social-app-8a28d.firebaseapp.com",
  projectId: "social-app-8a28d",
  storageBucket: "social-app-8a28d.appspot.com", // ✅ Correct
  messagingSenderId: "443274605720",
  appId: "1:443274605720:web:92bb9948cb62efe6288ced",
  measurementId: "G-8Y06BB76GK"
};

const app = initializeApp(firebaseConfig);

// Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app); // ✅ Added export