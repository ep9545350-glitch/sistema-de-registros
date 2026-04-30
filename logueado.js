import { signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { auth } from "./firebase.js";

window.logout = async function () {
    try {
        await signOut(auth);

        localStorage.removeItem("usuarioLogueado");

        window.location.href = "login.html";
    } catch (error) {
        console.error(error);
        alert("Error al cerrar sesión");
    }
};