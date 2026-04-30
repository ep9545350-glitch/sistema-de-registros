import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getAuth
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  doc,
  deleteDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// CONFIG
const firebaseConfig = {
  apiKey: "AIzaSyCzkpixn6Jb5mLF-ybNqhQd-KK4ZrhRN18",
  authDomain: "sistema-de-registros-4f905.firebaseapp.com",
  projectId: "sistema-de-registros-4f905",
  storageBucket: "sistema-de-registros-4f905.appspot.com",
  messagingSenderId: "900055080818",
  appId: "1:900055080818:web:90ba40a260b6c8cd2187eb"
};

// INIT
const app = initializeApp(firebaseConfig);

// AUTH
const auth = getAuth(app);

// FIRESTORE
const db = getFirestore(app);

// EXPORTS
export { auth, db };

// GLOBAL (para tu appp.js)
window.db = db;
window.fb = {
  collection,
  addDoc,
  getDocs,
  doc,
  deleteDoc,
  updateDoc
};