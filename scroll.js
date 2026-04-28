function activarScrollSuperior() {

  const scrollsTop = document.querySelectorAll(".scroll-superior");
  const tablas = document.querySelectorAll(".tabla-scroll");
  const barras = document.querySelectorAll(".scroll-bar");

  scrollsTop.forEach((scrollTop, index) => {

    const tabla = tablas[index];
    const barra = barras[index];

    if (!scrollTop || !tabla || !barra) return;

    const tablaInterna = tabla.querySelector("table");
    if (!tablaInterna) return;

    // 🔥 AJUSTAR ANCHO
    barra.style.width = tablaInterna.scrollWidth + "px";

    // 🔥 EVITAR EVENTOS DUPLICADOS
    scrollTop.onscroll = null;
    tabla.onscroll = null;

    // 🔥 SINCRONIZAR
    scrollTop.addEventListener("scroll", () => {
      tabla.scrollLeft = scrollTop.scrollLeft;
    });

    tabla.addEventListener("scroll", () => {
      scrollTop.scrollLeft = tabla.scrollLeft;
    });

  });
}