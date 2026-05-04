function generarPDFSeleccionado() {

  document.querySelectorAll(".columnaCheck").forEach(c => {
    const hoja = c.dataset.hoja;
    if (!hoja) return;
    if (!columnasSeleccionadas[hoja]) columnasSeleccionadas[hoja] = new Set();
    if (c.checked) columnasSeleccionadas[hoja].add(c.value);
    else columnasSeleccionadas[hoja].delete(c.value);
  });

  const totalSeleccionado = Object.values(columnasSeleccionadas)
    .reduce((acc, set) => acc + set.size, 0);

  if (totalSeleccionado === 0) {
    mostrarAlerta("Selecciona al menos una columna", "warning");
    return;
  }

  // ── Headers globales sin duplicados ──────────────────────────
  const headersGlobalesOrdenados = [];
  const headersVistos = new Set();

  for (let hoja in columnasSeleccionadas) {
    const cols = columnasSeleccionadas[hoja];
    if (!cols || cols.size === 0) continue;
    cols.forEach(col => {
      if (!headersVistos.has(col)) {
        headersVistos.add(col);
        headersGlobalesOrdenados.push(col);
      }
    });
  }

  if (headersGlobalesOrdenados.length === 0) {
    mostrarAlerta("No hay columnas para exportar", "warning");
    return;
  }

  // ── Función para normalizar nombre como clave de unión ────────
  function claveNombre(row) {
    const campoNombre = Object.keys(row).find(k =>
      k.toLowerCase().includes("nombre") || k.toLowerCase().includes("apellido")
    );
    if (!campoNombre) return null;
    return (row[campoNombre] || "").toString().trim().toUpperCase();
  }

  // ── PASO 1: Filtrar REPORTE DIARIO con todos los filtros activos
  // Las demás hojas se filtran SOLO por nombre/DNI (no por tipo matrimonio ni fecha)
  // ─────────────────────────────────────────────────────────────
  const datosFiltradosPorHoja = {};

  for (let hoja in columnasSeleccionadas) {
    const cols = columnasSeleccionadas[hoja];
    if (!cols || cols.size === 0) continue;

    let data = datosPorHoja[hoja];
    if (!data || data.length === 0) continue;

    let dataFiltrada;

    if (hoja === "REPORTE DIARIO") {
      // 🔥 Aplicar TODOS los filtros activos
      dataFiltrada = aplicarFiltroAData(data);
    } else {
      // 🔥 Para otras hojas: solo filtrar por nombre y DNI
      // NO filtrar por tipo matrimonio ni fecha (esos son campos de REPORTE DIARIO)
      dataFiltrada = data.filter(row => {

        // Filtro nombre
        if (filtroGlobal.nombre) {
          let encontrado = Object.values(row).some(v =>
            v && v.toString().toLowerCase().includes(filtroGlobal.nombre)
          );
          if (!encontrado) return false;
        }

        // Filtro DNI
        if (filtroGlobal.dni) {
          const campoDni = Object.keys(row).find(k =>
            k.toLowerCase().replace(/\s+/g, "").includes("dni") ||
            k.toLowerCase().replace(/\s+/g, "").includes("ce")
          );
          let valorDni = campoDni ? (row[campoDni] || "").toString().toLowerCase() : "";
          if (!valorDni.includes(filtroGlobal.dni)) return false;
        }

        return true;
      });
    }

    // Quitar filas sin nombre
    dataFiltrada = dataFiltrada.filter(row => {
      let clave = claveNombre(row);
      return clave && clave.trim() !== "";
    });

    datosFiltradosPorHoja[hoja] = dataFiltrada;
  }

  // ── PASO 2: Si hay REPORTE DIARIO, obtener los nombres que pasaron el filtro
  // y usarlos para filtrar las demás hojas (unión por nombre)
  // ─────────────────────────────────────────────────────────────
  const nombresDeReporte = new Set();
  const hayReporte = datosFiltradosPorHoja["REPORTE DIARIO"];

  if (hayReporte && hayReporte.length > 0) {
    hayReporte.forEach(row => {
      let clave = claveNombre(row);
      if (clave) nombresDeReporte.add(clave);
    });

    // 🔥 Filtrar otras hojas para que solo incluyan nombres que están en REPORTE DIARIO
    for (let hoja in datosFiltradosPorHoja) {
      if (hoja === "REPORTE DIARIO") continue;
      datosFiltradosPorHoja[hoja] = datosFiltradosPorHoja[hoja].filter(row => {
        let clave = claveNombre(row);
        return clave && nombresDeReporte.has(clave);
      });
    }
  }

  // ── PASO 3: Unir todas las hojas en un mapa por nombre ────────
  // Cada nombre = una sola fila con datos de todas las hojas
  // ─────────────────────────────────────────────────────────────
  const mapaFilas = new Map();

  for (let hoja in datosFiltradosPorHoja) {
    const cols = columnasSeleccionadas[hoja];
    if (!cols || cols.size === 0) continue;

    const dataFiltrada = datosFiltradosPorHoja[hoja];
    if (!dataFiltrada || dataFiltrada.length === 0) continue;

    dataFiltrada.forEach((row, index) => {
      let clave = claveNombre(row) || (hoja + "_" + index);

      if (!mapaFilas.has(clave)) {
        mapaFilas.set(clave, {});
      }

      let filaObj = mapaFilas.get(clave);

      cols.forEach(h => {
        let valor;

        if (esCampoOrden(h)) {
          let v = row[h];
          valor = (v !== undefined && v !== "") ? v : index + 1;
        } else {
          valor = row[h] ?? "";
        }

        if (h.toLowerCase().replace(/\s+/g, "").includes("matrimonio")) {
          valor = normalizarTipoMatrimonio(valor);
        }

        // 🔥 NUEVO: convertir fechas YYYY-MM-DD → DD/MM/YYYY
        if (
          h.toLowerCase().includes("fecha") ||
          h.toLowerCase().includes("f.") ||
          h.toLowerCase().includes("consejeria") ||
          h.toLowerCase().includes("laboratorio") ||
          h.toLowerCase().includes("consulta") ||
          h.toLowerCase().includes("recibo")
        ) {
          valor = soloFecha(valor);
        }

        if (typeof valor === "string") valor = valor.trim();

        // Solo sobrescribir si el campo está vacío
        if (!filaObj[h] || filaObj[h].toString().trim() === "") {
          filaObj[h] = valor;
        }
      });
    });
  }

  // ── PASO 4: Construir array de filas ──────────────────────────
  let filasCombinadas = [];
  mapaFilas.forEach(obj => {
    let fila = headersGlobalesOrdenados.map(h => obj[h] || "");
    filasCombinadas.push(fila);
  });

  if (filasCombinadas.length === 0) {
    mostrarAlerta("No hay datos para exportar con los filtros aplicados", "warning");
    return;
  }

  // ── Descripción del filtro ────────────────────────────────────
  let descripcionFiltro = "";
  if (filtroGlobal.nombre) descripcionFiltro += ` | Nombre: ${filtroGlobal.nombre.toUpperCase()}`;
  if (filtroGlobal.dni) descripcionFiltro += ` | DNI: ${filtroGlobal.dni}`;
  if (filtroGlobal.tipoMatrimonio) descripcionFiltro += ` | Tipo: ${filtroGlobal.tipoMatrimonio}`;
  if (filtroGlobal.desde) descripcionFiltro += ` | Desde: ${soloFecha(filtroGlobal.desde)}`;
  if (filtroGlobal.hasta) descripcionFiltro += ` | Hasta: ${soloFecha(filtroGlobal.hasta)}`;
  if (!descripcionFiltro) descripcionFiltro = " | Sin filtros (todos los registros)";

  // ── Headers formateados ───────────────────────────────────────
  const headersFormateados = headersGlobalesOrdenados.map(h => {
    let palabras = h.split(" ");
    if (palabras.length >= 2) {
      let mitad = Math.ceil(palabras.length / 2);
      return palabras.slice(0, mitad).join(" ") + "\n" + palabras.slice(mitad).join(" ");
    }
    return h;
  });

  // ── Calcular anchos ───────────────────────────────────────────
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  pdf.setFontSize(7);

  let columnStyles = {};
  let totalWidth = 0;

  headersGlobalesOrdenados.forEach((h, i) => {
    let maxWidth = pdf.getTextWidth(h);
    filasCombinadas.forEach(f => {
      let w = pdf.getTextWidth((f[i] || "").toString().trim());
      if (w > maxWidth) maxWidth = w;
    });
    maxWidth += 4;
    maxWidth = Math.max(6, Math.min(maxWidth, 60));
    columnStyles[i] = { cellWidth: maxWidth };
    totalWidth += maxWidth;
  });

  const pageWidth = pdf.internal.pageSize.getWidth() - 20;
  const scale = pageWidth / totalWidth;
  Object.keys(columnStyles).forEach(i => {
    columnStyles[i].cellWidth *= scale;
  });

  const seccionesIncluidas = Object.entries(columnasSeleccionadas)
    .filter(([, set]) => set.size > 0)
    .map(([hoja]) => hoja)
    .join(" + ");

  // ── Generar PDF ───────────────────────────────────────────────
  pdf.autoTable({
    head: [
      [{
        content: "Base de datos de atención a contrayentes para la emisión de certificado médico prenupcial - 2026",
        colSpan: headersFormateados.length,
        styles: {
          halign: "center", fillColor: [180, 180, 180],
          textColor: [0, 0, 0], fontStyle: "bold",
          fontSize: 10, lineWidth: 0.4, lineColor: [0, 0, 0]
        }
      }],
      [{
        content: `Filtro:${descripcionFiltro} | Total: ${filasCombinadas.length} registros`,
        colSpan: headersFormateados.length,
        styles: {
          halign: "left", fillColor: [230, 230, 230],
          textColor: [0, 0, 0], fontSize: 7,
          fontStyle: "italic", lineWidth: 0.2, lineColor: [0, 0, 0]
        }
      }],
      headersFormateados
    ],
    body: filasCombinadas,
    margin: { top: 25, left: 10, right: 10 },
    tableWidth: "wrap",
    columnStyles,
    styles: {
      fontSize: 7, cellPadding: 0.5,
      overflow: "linebreak", lineWidth: 0.2, lineColor: [0, 0, 0]
    },
    headStyles: {
      fillColor: [205, 205, 205], textColor: [0, 0, 0],
      halign: "center", fontStyle: "bold",
      lineWidth: 0.3, lineColor: [0, 0, 0]
    },
    didParseCell: function (data) {
      if (data.section === "body") {
        let texto = (data.cell.text[0] || "").toString().trim();
        let esNumero = /^\d+$/.test(texto);
        let esFecha = /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(texto);
        data.cell.styles.halign = (esNumero || esFecha) ? "center" : "left";
      }
    },
    didDrawPage: function (data) {

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      // 🔥 LOGO
      const logo = new Image();
      logo.src = "ESCUDO_MPT_2.png";
      pdf.addImage(logo, "PNG", 14, 8, 15, 15);

      // 🔥 TÍTULO
      pdf.setFontSize(11);
      pdf.setTextColor(0);


      // ───────────── MARCA DE AGUA IZQUIERDA ─────────────
      pdf.setFontSize(9);
      pdf.setTextColor(150); // gris suave
      pdf.text("SUBGERENCIA DE SALUD - OBSTETRICIA", 14, pageHeight - 10);

      // ───────────── NUMERO DE PAGINA CENTRO ─────────────
      const pageNumber = pdf.internal.getNumberOfPages();

      pdf.setFontSize(10);
      pdf.setTextColor(120);

      const textoPagina = `Página ${pageNumber}`;
      const textWidth = pdf.getTextWidth(textoPagina);

      pdf.text(textoPagina, pageWidth / 2 - textWidth / 2, pageHeight - 10);
    },
    theme: "grid"
  });

  pdf.save("Base de datos de atención de contrayentes para la emisión de certificado médico prenupcial - 2026.pdf");
}
function exportarDashboardPDF() {

  const canvasBarra = document.getElementById("graficoBarras");
  const canvasPie = document.getElementById("graficoTorta");

  // 🔥 Verificar que el dashboard fue generado
  if (!canvasBarra || !canvasPie) {
    mostrarAlerta("No hay gráficos disponibles. Genera el dashboard primero.", "danger");
    return;
  }

  // 🔥 Verificar que los gráficos tienen datos
  if (!window.graficoBarra || !window.graficoPie) {
    mostrarAlerta("Genera el dashboard antes de exportar.", "warning");
    return;
  }

  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF("landscape", "mm", "a4");
  const pageWidth = pdf.internal.pageSize.getWidth();

  // ── Obtener fechas del filtro del dashboard ───────────────────
  const desde = document.getElementById("filtroFechaDesdeDashboard")?.value || "";
  const hasta = document.getElementById("filtroFechaHastaDashboard")?.value || "";

  // ── Recalcular datos con el mismo filtro del dashboard ────────
  const data = datosPorHoja["REPORTE DIARIO"] || [];
  const headerRD = headersPorHoja["REPORTE DIARIO"] || [];

  const campoTipoFijo = headerRD.find(h =>
    h.toLowerCase().replace(/\s+/g, "")
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .includes("matrimonio")
  );

  const campoFechaFijo = headerRD.find(h =>
    h.toLowerCase().includes("fecha") || h.toLowerCase().includes("f.")
  );

  let conteo = {};
  let totalMatrimonios = 0;

  data.forEach(row => {
    let tipo = normalizarTipoMatrimonio(row[campoTipoFijo] || "");
    if (!tipo || tipo.trim() === "") return;

    let valorFecha = row[campoFechaFijo] || "";
    if (!valorFecha || valorFecha.toString().trim() === "") return;

    let fechaISO = fechaAISO(valorFecha.toString().trim());
    if (!fechaISO) return;

    if (desde && fechaISO < desde) return;
    if (hasta && fechaISO > hasta) return;

    totalMatrimonios++;
    if (!conteo[tipo]) conteo[tipo] = 0;
    conteo[tipo]++;
  });

  const labels = Object.keys(conteo);
  const valores = Object.values(conteo);

  // ── Texto del período ─────────────────────────────────────────
  let textoPeriodo = "Período: todos los registros";
  if (desde && hasta) {
    textoPeriodo = `Período: ${soloFecha(desde)} al ${soloFecha(hasta)}`;
  } else if (desde) {
    textoPeriodo = `Desde: ${soloFecha(desde)}`;
  } else if (hasta) {
    textoPeriodo = `Hasta: ${soloFecha(hasta)}`;
  }

  // ── Header ────────────────────────────────────────────────────
  pdf.setFillColor(13, 110, 253);
  pdf.rect(0, 0, pageWidth, 20, "F");

  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(16);
  pdf.text("Frecuencia de atención a contrayentes por tipo de matrimonio – 2026", 14, 12);

  pdf.setFontSize(10);
  pdf.text(`Fecha: ${new Date().toLocaleDateString()}`, pageWidth - 50, 12);

  // ── Subtítulo período ─────────────────────────────────────────
  pdf.setTextColor(0, 0, 0);
  pdf.setFontSize(11);
  pdf.text(textoPeriodo, 14, 28);

  // ── Tarjeta total ─────────────────────────────────────────────
  pdf.setFillColor(255, 165, 0);
  pdf.roundedRect(14, 32, 60, 30, 4, 4, "F");

  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(18);
  let totalStr = totalMatrimonios.toString();
  pdf.text(totalStr, 14 + 30 - pdf.getTextWidth(totalStr) / 2, 45);

  pdf.setFontSize(10);
  pdf.text(" MATRIMONIOS", 14 + 30 - pdf.getTextWidth(" MATRIMONIOS") / 2, 55);

  // ── Tarjetas por tipo ─────────────────────────────────────────
  const colores = ["#0d6efd", "#198754", "#ffc107", "#dc3545", "#6f42c1", "#20c997", "#fd7e14", "#0dcaf0"];
  let x = 80, y = 32;
  const ancho = 45, alto = 30, espacio = 8;

  labels.forEach((tipo, i) => {
    let colorHex = tipo === "MASIVO" ? "#51D1F6" : tipo === "PAGADO" ? "#0d6efd" : colores[i % colores.length];
    let r = parseInt(colorHex.substring(1, 3), 16);
    let g = parseInt(colorHex.substring(3, 5), 16);
    let b = parseInt(colorHex.substring(5, 7), 16);

    pdf.setFillColor(200, 200, 200);
    pdf.roundedRect(x + 1, y + 1, ancho, alto, 4, 4, "F");
    pdf.setFillColor(r, g, b);
    pdf.roundedRect(x, y, ancho, alto, 4, 4, "F");

    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(16);
    let val = valores[i].toString();
    pdf.text(val, x + ancho / 2 - pdf.getTextWidth(val) / 2, y + 12);

    pdf.setFontSize(10);
    pdf.text(tipo, x + ancho / 2 - pdf.getTextWidth(tipo) / 2, y + 22);

    x += ancho + espacio;
    if (x + ancho > pageWidth) { x = 80; y += alto + espacio; }
  });

  // ── Gráficos ──────────────────────────────────────────────────
  const imgBarra = canvasBarra.toDataURL("image/png", 1.0);
  const imgPie = canvasPie.toDataURL("image/png", 1.0);
  const inicioY = y + alto + 15;
  const imgWidth = pageWidth / 2 - 20;

  pdf.addImage(imgBarra, "PNG", 14, inicioY, imgWidth, 80);
  pdf.addImage(imgPie, "PNG", pageWidth / 2 + 5, inicioY, 80, 80);

  // ── Footer ────────────────────────────────────────────────────
  pdf.setFontSize(9);
  pdf.setTextColor(120);
  pdf.text("SUBGERENCIA DE SALUD - OBSTETRICIA", 14, pdf.internal.pageSize.getHeight() - 5);

  pdf.save("Frecuencia de contrayentes por tipo de matrimonio – MPT 2026.pdf");
}