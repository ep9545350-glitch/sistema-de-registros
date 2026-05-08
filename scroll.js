function activarScrollSuperior() {

  // 🔥 Buscar por contenedor padre para que cada tabla
  // encuentre su propio scroll superior
  const contenedores = document.querySelectorAll(".mb-5");

  contenedores.forEach(contenedor => {

    const scrollTop = contenedor.querySelector(".scroll-superior");
    const tabla = contenedor.querySelector(".tabla-scroll");
    const barra = contenedor.querySelector(".scroll-bar");

    if (!scrollTop || !tabla || !barra) return;

    const tablaInterna = tabla.querySelector("table");
    if (!tablaInterna) return;

    // 🔥 Ajustar ancho de la barra al ancho real de la tabla
    function actualizarAnchoBarra() {
      barra.style.width = tablaInterna.scrollWidth + "px";
    }
    actualizarAnchoBarra();

    // 🔥 Re-ajustar si la tabla cambia de tamaño
    const observer = new ResizeObserver(() => actualizarAnchoBarra());
    observer.observe(tablaInterna);

    // 🔥 Limpiar eventos anteriores clonando el nodo scroll superior
    const nuevoScrollTop = scrollTop.cloneNode(true);
    scrollTop.parentNode.replaceChild(nuevoScrollTop, scrollTop);

    // 🔥 Re-obtener la barra del nodo clonado
    const nuevaBarra = nuevoScrollTop.querySelector(".scroll-bar");
    if (nuevaBarra) nuevaBarra.style.width = tablaInterna.scrollWidth + "px";

    // 🔥 Sincronizar: barra superior → tabla (scroll horizontal)
    nuevoScrollTop.addEventListener("scroll", () => {
      tabla.scrollLeft = nuevoScrollTop.scrollLeft;
    });

    // 🔥 Sincronizar: tabla → barra superior (scroll horizontal)
    tabla.addEventListener("scroll", () => {
      nuevoScrollTop.scrollLeft = tabla.scrollLeft;
    });
  });
}