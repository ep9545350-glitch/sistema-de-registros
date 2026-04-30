// 🔥 IMPORTS FIREBASE
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
    getAuth,
    signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// 🔥 TU CONFIG
const firebaseConfig = {
    apiKey: "AIzaSyCzkpixn6Jb5mLF-ybNqhQd-KK4ZrhRN18",
    authDomain: "sistema-de-registros-4f905.firebaseapp.com",
    projectId: "sistema-de-registros-4f905",
    storageBucket: "sistema-de-registros-4f905.firebasestorage.app",
    messagingSenderId: "900055080818",
    appId: "1:900055080818:web:90ba40a260b6c8cd2187eb",
    measurementId: "G-6Q9NG3TCBZ"
};

// 🔥 INIT
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// 🔐 LOGIN
window.login = async function () {

    const correo = document.getElementById("correo").value;
    const password = document.getElementById("password").value;

    const errorDiv = document.getElementById("error");
    errorDiv.innerText = "";

    try {

        await signInWithEmailAndPassword(auth, correo, password);

        // 🔥 guardar sesión
        localStorage.setItem("usuarioLogueado", correo);

        // 🔥 redirigir
        window.location.href = "index.html";

    } catch (error) {
        console.error(error);

        if (error.code === "auth/user-not-found") {
            errorDiv.innerText = "Usuario no existe";
        } else if (error.code === "auth/wrong-password") {
            errorDiv.innerText = "Contraseña incorrecta";
        } else {
            errorDiv.innerText = "Error: " + error.message;
        }
    }
};