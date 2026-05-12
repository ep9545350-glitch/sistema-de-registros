// 🔥 IMPORTS FIREBASE
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
    getAuth,
    signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyCzkpixn6Jb5mLF-ybNqhQd-KK4ZrhRN18",
    authDomain: "sistema-de-registros-4f905.firebaseapp.com",
    projectId: "sistema-de-registros-4f905",
    storageBucket: "sistema-de-registros-4f905.firebasestorage.app",
    messagingSenderId: "900055080818",
    appId: "1:900055080818:web:90ba40a260b6c8cd2187eb",
    measurementId: "G-6Q9NG3TCBZ"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

window.login = async function () {

    const correo = document.getElementById("correo").value.trim();
    const password = document.getElementById("password").value.trim();
    const errorDiv = document.getElementById("error");
    const btnLogin = document.querySelector(".btn-login");

    // 🔥 Limpiar error anterior
    errorDiv.style.display = "none";
    errorDiv.innerText = "";

    // 🔥 Validar campos vacíos antes de llamar a Firebase
    if (!correo || !password) {
        errorDiv.style.display = "block";
        errorDiv.innerText = "⚠️ Por favor completa todos los campos.";
        return;
    }

    // 🔥 Deshabilitar botón mientras carga
    btnLogin.disabled = true;
    btnLogin.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Ingresando...`;

    try {

        await signInWithEmailAndPassword(auth, correo, password);
        localStorage.setItem("usuarioLogueado", correo);
        window.location.replace("index.html");

    } catch (error) {
        console.error(error);

        // 🔥 Restaurar botón
        btnLogin.disabled = false;
        btnLogin.innerHTML = "Ingresar";

        // 🔥 Mostrar error
        errorDiv.style.display = "block";

        switch (error.code) {
            case "auth/user-not-found":
            case "auth/invalid-credential":
            case "auth/wrong-password":
                errorDiv.innerText = "⚠️ Correo o contraseña incorrectos.";
                break;
            case "auth/invalid-email":
                errorDiv.innerText = "⚠️ El formato del correo no es válido.";
                break;
            case "auth/too-many-requests":
                errorDiv.innerText = "⚠️ Demasiados intentos fallidos. Espera unos minutos e intenta de nuevo.";
                break;
            case "auth/network-request-failed":
                errorDiv.innerText = "⚠️ Sin conexión a internet. Verifica tu red.";
                break;
            default:
                errorDiv.innerText = "⚠️ Error al iniciar sesión. Inténtalo de nuevo.";
        }
    }
};