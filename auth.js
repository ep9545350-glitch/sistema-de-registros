import { getAuth, onAuthStateChanged }
    from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const auth = getAuth();

// 🔥 Evitar que el navegador cachee esta página
window.history.pushState(null, "", window.location.href);
window.addEventListener("popstate", function () {
    window.history.pushState(null, "", window.location.href);
});

onAuthStateChanged(auth, (user) => {
    if (!user) {
        // ❌ no hay sesión → fuera, reemplazando historial para que no pueda volver atrás
        window.location.replace("login.html");
    }
});