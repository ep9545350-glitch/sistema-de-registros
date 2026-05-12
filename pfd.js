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

  // ── PASO 1: Filtrar datos por hoja ────────────────────────────
  // 🔥 REPORTE DIARIO → filtrar con todos los filtros activos
  // 🔥 OTRAS HOJAS    → filtrar por los N° de orden que salieron de REPORTE DIARIO
  const datosFiltradosPorHoja = {};

  // Primero filtrar REPORTE DIARIO
  const hojaRD = "REPORTE DIARIO";
  if (columnasSeleccionadas[hojaRD] && columnasSeleccionadas[hojaRD].size > 0) {
    let dataRD = datosPorHoja[hojaRD] || [];
    datosFiltradosPorHoja[hojaRD] = aplicarFiltroAData(dataRD, hojaRD);
  } else {
    // aunque no tenga columnas seleccionadas, necesitamos los N° de orden
    // para filtrar las demás hojas
    let dataRD = datosPorHoja[hojaRD] || [];
    datosFiltradosPorHoja[hojaRD] = aplicarFiltroAData(dataRD, hojaRD);
  }

  // 🔥 Obtener los N° de orden del REPORTE DIARIO filtrado
  const headersRD = headersPorHoja[hojaRD] || [];
  const campoOrdenRD = headersRD.find(h => esCampoOrden(h));
  const ordenesFiltradas = new Set();

  datosFiltradosPorHoja[hojaRD].forEach(row => {
    if (campoOrdenRD && row[campoOrdenRD] !== undefined && row[campoOrdenRD] !== "") {
      ordenesFiltradas.add(String(row[campoOrdenRD]).trim());
    }
  });

  // Filtrar las demás hojas por N° de orden
  for (let hoja in columnasSeleccionadas) {
    if (hoja === hojaRD) continue;
    const cols = columnasSeleccionadas[hoja];
    if (!cols || cols.size === 0) continue;

    let data = datosPorHoja[hoja] || [];
    if (!data.length) continue;

    const headersHoja = headersPorHoja[hoja] || [];
    const campoOrdenHoja = headersHoja.find(h => esCampoOrden(h));

    if (campoOrdenHoja && ordenesFiltradas.size > 0) {
      // 🔥 Filtrar por N° de orden que coincida con REPORTE DIARIO
      datosFiltradosPorHoja[hoja] = data.filter(row => {
        const orden = String(row[campoOrdenHoja] || "").trim();
        return ordenesFiltradas.has(orden);
      });
    } else {
      datosFiltradosPorHoja[hoja] = data;
    }
  }

  // ── PASO 2: Unir todas las hojas por N° de orden ─────────────
  // 🔥 El mapa usa el N° de orden como clave → unión exacta y confiable
  const mapaFilas = new Map(); // clave: N° de orden (string)

  // Primero insertar todos los registros de REPORTE DIARIO
  const colsRD = columnasSeleccionadas[hojaRD];
  if (datosFiltradosPorHoja[hojaRD]) {
    datosFiltradosPorHoja[hojaRD].forEach((row, index) => {
      const orden = campoOrdenRD
        ? String(row[campoOrdenRD] || "").trim()
        : String(index);

      const clave = orden || `rd_${index}`;

      if (!mapaFilas.has(clave)) {
        mapaFilas.set(clave, {});
      }

      const filaObj = mapaFilas.get(clave);

      // Guardar TODOS los campos del registro (aunque no estén seleccionados),
      // para que la unión funcione bien
      if (colsRD && colsRD.size > 0) {
        colsRD.forEach(h => {
          let valor = row[h] ?? "";

          if (h.toLowerCase().replace(/\s+/g, "").includes("matrimonio")) {
            valor = normalizarTipoMatrimonio(valor);
          }
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
          filaObj[h] = valor;
        });
      }
    });
  }

  // Luego agregar datos de las demás hojas al mapa, por N° de orden
  for (let hoja in columnasSeleccionadas) {
    if (hoja === hojaRD) continue;
    const cols = columnasSeleccionadas[hoja];
    if (!cols || cols.size === 0) continue;

    const dataFiltrada = datosFiltradosPorHoja[hoja] || [];
    const headersHoja = headersPorHoja[hoja] || [];
    const campoOrdenHoja = headersHoja.find(h => esCampoOrden(h));

    dataFiltrada.forEach((row, index) => {
      const orden = campoOrdenHoja
        ? String(row[campoOrdenHoja] || "").trim()
        : String(index);

      // 🔥 Solo agregar si ya existe en el mapa (proviene de REPORTE DIARIO filtrado)
      if (!mapaFilas.has(orden)) return;

      const filaObj = mapaFilas.get(orden);

      cols.forEach(h => {
        let valor = row[h] ?? "";

        if (h.toLowerCase().replace(/\s+/g, "").includes("matrimonio")) {
          valor = normalizarTipoMatrimonio(valor);
        }
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

        // Solo rellenar si está vacío
        if (!filaObj[h] || filaObj[h].toString().trim() === "") {
          filaObj[h] = valor;
        }
      });
    });
  }

  // ── PASO 3: Construir array de filas en orden ─────────────────
  // 🔥 Ordenar por N° de orden numérico
  const clavesOrdenadas = [...mapaFilas.keys()].sort((a, b) => {
    return Number(a) - Number(b);
  });

  let filasCombinadas = clavesOrdenadas.map(clave => {
    const obj = mapaFilas.get(clave);
    return headersGlobalesOrdenados.map(h => {
      let v = obj[h];
      return (v !== undefined && v !== null) ? v.toString().toUpperCase() : "";
    });
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

      const logo = new Image();
      logo.src = "ESCUDO_MPT_2.png";
      pdf.addImage(logo, "PNG", 14, 8, 15, 15);

      pdf.setFontSize(9);
      pdf.setTextColor(150);
      pdf.text("SUBGERENCIA DE SALUD - OBSTETRICIA", 14, pageHeight - 10);

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