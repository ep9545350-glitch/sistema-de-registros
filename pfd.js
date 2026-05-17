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

  const datosFiltradosPorHoja = {};
  const hojaRD = "REPORTE DIARIO";

  if (columnasSeleccionadas[hojaRD] && columnasSeleccionadas[hojaRD].size > 0) {
    let dataRD = datosPorHoja[hojaRD] || [];
    datosFiltradosPorHoja[hojaRD] = aplicarFiltroAData(dataRD, hojaRD);
  } else {
    let dataRD = datosPorHoja[hojaRD] || [];
    datosFiltradosPorHoja[hojaRD] = aplicarFiltroAData(dataRD, hojaRD);
  }

  const headersRD = headersPorHoja[hojaRD] || [];
  const campoOrdenRD = headersRD.find(h => esCampoOrden(h));
  const ordenesFiltradas = new Set();

  datosFiltradosPorHoja[hojaRD].forEach(row => {
    if (campoOrdenRD && row[campoOrdenRD] !== undefined && row[campoOrdenRD] !== "") {
      ordenesFiltradas.add(String(row[campoOrdenRD]).trim());
    }
  });

  for (let hoja in columnasSeleccionadas) {
    if (hoja === hojaRD) continue;
    const cols = columnasSeleccionadas[hoja];
    if (!cols || cols.size === 0) continue;

    let data = datosPorHoja[hoja] || [];
    if (!data.length) continue;

    const headersHoja = headersPorHoja[hoja] || [];
    const campoOrdenHoja = headersHoja.find(h => esCampoOrden(h));

    if (campoOrdenHoja && ordenesFiltradas.size > 0) {
      datosFiltradosPorHoja[hoja] = data.filter(row => {
        const orden = String(row[campoOrdenHoja] || "").trim();
        return ordenesFiltradas.has(orden);
      });
    } else {
      datosFiltradosPorHoja[hoja] = data;
    }
  }

  const mapaFilas = new Map();
  const colsRD = columnasSeleccionadas[hojaRD];

  if (datosFiltradosPorHoja[hojaRD]) {
    datosFiltradosPorHoja[hojaRD].forEach((row, index) => {
      const orden = campoOrdenRD ? String(row[campoOrdenRD] || "").trim() : String(index);
      const clave = orden || `rd_${index}`;

      if (!mapaFilas.has(clave)) mapaFilas.set(clave, {});
      const filaObj = mapaFilas.get(clave);

      if (colsRD && colsRD.size > 0) {
        colsRD.forEach(h => {
          let valor = row[h] ?? "";
          if (h.toLowerCase().replace(/\s+/g, "").includes("matrimonio")) valor = normalizarTipoMatrimonio(valor);
          if (h.toLowerCase().includes("fecha") || h.toLowerCase().includes("f.") ||
            h.toLowerCase().includes("consejeria") || h.toLowerCase().includes("laboratorio") ||
            h.toLowerCase().includes("consulta") || h.toLowerCase().includes("recibo")) valor = soloFecha(valor);
          if (typeof valor === "string") valor = valor.trim();
          filaObj[h] = valor;
        });
      }
    });
  }

  for (let hoja in columnasSeleccionadas) {
    if (hoja === hojaRD) continue;
    const cols = columnasSeleccionadas[hoja];
    if (!cols || cols.size === 0) continue;

    const dataFiltrada = datosFiltradosPorHoja[hoja] || [];
    const headersHoja = headersPorHoja[hoja] || [];
    const campoOrdenHoja = headersHoja.find(h => esCampoOrden(h));

    dataFiltrada.forEach((row, index) => {
      const orden = campoOrdenHoja ? String(row[campoOrdenHoja] || "").trim() : String(index);
      if (!mapaFilas.has(orden)) return;
      const filaObj = mapaFilas.get(orden);

      cols.forEach(h => {
        let valor = row[h] ?? "";
        if (h.toLowerCase().replace(/\s+/g, "").includes("matrimonio")) valor = normalizarTipoMatrimonio(valor);
        if (h.toLowerCase().includes("fecha") || h.toLowerCase().includes("f.") ||
          h.toLowerCase().includes("consejeria") || h.toLowerCase().includes("laboratorio") ||
          h.toLowerCase().includes("consulta") || h.toLowerCase().includes("recibo")) valor = soloFecha(valor);
        if (typeof valor === "string") valor = valor.trim();
        if (!filaObj[h] || filaObj[h].toString().trim() === "") filaObj[h] = valor;
      });
    });
  }

  const clavesOrdenadas = [...mapaFilas.keys()].sort((a, b) => Number(a) - Number(b));

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

  let descripcionFiltro = "";
  if (filtroGlobal.nombre) descripcionFiltro += ` | Nombre: ${filtroGlobal.nombre.toUpperCase()}`;
  if (filtroGlobal.dni) descripcionFiltro += ` | DNI: ${filtroGlobal.dni}`;
  if (filtroGlobal.tipoMatrimonio) descripcionFiltro += ` | Tipo: ${filtroGlobal.tipoMatrimonio}`;
  if (filtroGlobal.desde) descripcionFiltro += ` | Desde: ${soloFecha(filtroGlobal.desde)}`;
  if (filtroGlobal.hasta) descripcionFiltro += ` | Hasta: ${soloFecha(filtroGlobal.hasta)}`;
  if (!descripcionFiltro) descripcionFiltro = " | Sin filtros (todos los registros)";

  const headersFormateados = headersGlobalesOrdenados.map(h => {
    let palabras = h.split(" ");
    if (palabras.length >= 2) {
      let mitad = Math.ceil(palabras.length / 2);
      return palabras.slice(0, mitad).join(" ") + "\n" + palabras.slice(mitad).join(" ");
    }
    return h;
  });

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

  pdf.autoTable({
    head: [
      [{
        content: "Base de datos de atención a contrayentes(Consejería en ITS) para la emisión de certificado médico prenupcial - 2026",
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


// ════════════════════════════════════════════════════════
// 🔥 CAPTURA HD con leyendas dibujadas manualmente
// Síncrono, rápido y confiable
// ════════════════════════════════════════════════════════
function capturarChartConLeyenda(chartInstance, titulo, leyendas, anchoHD) {
  // leyendas: [{ label, color, pct }]
  if (!chartInstance) return null;

  const escala   = 2;
  const srcCanvas = chartInstance.canvas;
  const srcW     = srcCanvas.width  || 400;
  const srcH     = srcCanvas.height || 300;

  // Área extra para título + leyenda encima del gráfico
  const paddingTop    = 52 * escala;   // título + leyenda
  const paddingLados  = 16 * escala;
  const paddingBottom = 10 * escala;

  const totalW = anchoHD * escala;
  const chartW = totalW - paddingLados * 2;
  const chartH = Math.round(chartW * (srcH / srcW));
  const totalH = paddingTop + chartH + paddingBottom;

  const out = document.createElement("canvas");
  out.width  = totalW;
  out.height = totalH;
  const ctx  = out.getContext("2d");

  // Fondo
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, 0, totalW, totalH);

  // Borde redondeado simulado (rect simple)
  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth   = 2;
  ctx.strokeRect(1, 1, totalW - 2, totalH - 2);

  // ── Título ──
  ctx.fillStyle  = "#1e293b";
  ctx.font       = `bold ${13 * escala}px Segoe UI, Arial, sans-serif`;
  ctx.textAlign  = "left";
  ctx.textBaseline = "top";
  ctx.fillText(titulo, paddingLados, 10 * escala);

  // ── Leyendas ──
  let lx = paddingLados;
  const ly = 28 * escala;
  const cuadrado = 10 * escala;

  leyendas.forEach(l => {
    // cuadradito de color
    ctx.fillStyle = l.color;
    ctx.fillRect(lx, ly, cuadrado, cuadrado);

    // texto
    ctx.fillStyle    = "#64748b";
    ctx.font         = `${11 * escala}px Segoe UI, Arial, sans-serif`;
    ctx.textAlign    = "left";
    ctx.textBaseline = "top";
    const txt = `${l.label}  ${l.pct}`;
    ctx.fillText(txt, lx + cuadrado + 5 * escala, ly);
    lx += ctx.measureText(txt).width + cuadrado + 18 * escala;
  });

  // ── Gráfico Chart.js ──
  ctx.drawImage(srcCanvas, paddingLados, paddingTop, chartW, chartH);

  const ratio = out.height / out.width;
  return { img: out.toDataURL("image/png", 1.0), w: out.width, h: out.height, ratio };
}


function exportarDashboardPDF() {

  const canvasBarra     = document.getElementById("graficoBarras");
  const canvasPie       = document.getElementById("graficoTorta");
  const canvasTendencia = document.getElementById("graficoTendencia");

  if (!canvasBarra || !canvasPie) {
    mostrarAlerta("No hay gráficos disponibles. Genera el dashboard primero.", "danger");
    return;
  }
  if (!window.graficoBarra || !window.graficoPie) {
    mostrarAlerta("Genera el dashboard antes de exportar.", "warning");
    return;
  }

  const { jsPDF } = window.jspdf;
  const pdf        = new jsPDF("landscape", "mm", "a4");
  const pageWidth  = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  const desde = document.getElementById("filtroFechaDesdeDashboard")?.value || "";
  const hasta  = document.getElementById("filtroFechaHastaDashboard")?.value || "";

  const data     = datosPorHoja["REPORTE DIARIO"] || [];
  const headerRD = headersPorHoja["REPORTE DIARIO"] || [];

  const campoTipoFijo = headerRD.find(h =>
    h.toLowerCase().replace(/\s+/g,"")
      .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
      .includes("matrimonio")
  );
  const campoFechaFijo = headerRD.find(h =>
    h.toLowerCase().includes("fecha") || h.toLowerCase().includes("f.")
  );

  const nombresMeses = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  let conteo = {}, totalMatrimonios = 0, tendenciaMesesTotal = {};

  data.forEach(row => {
    let tipo = normalizarTipoMatrimonio(row[campoTipoFijo] || "");
    if (!tipo || tipo.trim() === "") return;
    let valorFecha = row[campoFechaFijo] || "";
    if (!valorFecha || valorFecha.toString().trim() === "") return;
    let fechaISO = fechaAISO(valorFecha.toString().trim());
    if (!fechaISO) return;

    let mes = parseInt(fechaISO.split("-")[1], 10) - 1;
    let nombreMes = nombresMeses[mes];
    if (!tendenciaMesesTotal[nombreMes]) tendenciaMesesTotal[nombreMes] = 0;
    tendenciaMesesTotal[nombreMes]++;

    if (desde && fechaISO < desde) return;
    if (hasta  && fechaISO > hasta) return;
    totalMatrimonios++;
    if (!conteo[tipo]) conteo[tipo] = 0;
    conteo[tipo]++;
  });

  const labels  = Object.keys(conteo);
  const valores = Object.values(conteo);

  let textoPeriodo = "Todos los registros";
  if (desde && hasta) textoPeriodo = `${soloFecha(desde)} al ${soloFecha(hasta)}`;
  else if (desde)     textoPeriodo = `Desde ${soloFecha(desde)}`;
  else if (hasta)     textoPeriodo = `Hasta ${soloFecha(hasta)}`;

  // ── HELPERS ──
  function hexToRgb(hex) {
    return [
      parseInt(hex.substring(1,3),16),
      parseInt(hex.substring(3,5),16),
      parseInt(hex.substring(5,7),16)
    ];
  }

  function colorPorTipo(tipo, i) {
    if (tipo === "PAGADO") return "#2563eb";
    if (tipo === "MASIVO") return "#06b6d4";
    return ["#6f42c1","#198754","#f97316","#dc3545"][i % 4];
  }

  function tarjeta(x, y, w, h, hex, titulo, valor, subtitulo) {
    const [r,g,b] = hexToRgb(hex);
    pdf.setFillColor(r, g, b);
    pdf.roundedRect(x, y, w, h, 3, 3, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(22);
    let vs = valor.toString();
    pdf.text(vs, x + w/2 - pdf.getTextWidth(vs)/2, y + h * 0.45);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.5);
    pdf.text(titulo, x + w/2 - pdf.getTextWidth(titulo)/2, y + h * 0.65);
    if (subtitulo && subtitulo.trim() !== "") {
      pdf.setFontSize(6.5);
      pdf.setTextColor(255, 255, 255);
      pdf.text(subtitulo, x + w/2 - pdf.getTextWidth(subtitulo)/2, y + h * 0.83);
    }
  }

  function lineaDivisora(y) {
    pdf.setDrawColor(220,220,220);
    pdf.setLineWidth(0.25);
    pdf.line(14, y, pageWidth - 14, y);
  }

  function encabezado(titulo, subtitulo) {
    pdf.setFillColor(37,99,235);
    pdf.rect(0, 0, pageWidth, 18, "F");
    pdf.setFillColor(29,78,216);
    pdf.rect(0, 13, pageWidth, 5, "F");

    pdf.setFillColor(255,255,255);
    pdf.roundedRect(9, 4, 9, 9, 1.5, 1.5, "F");
    pdf.setFontSize(5.5);
    pdf.setTextColor(37,99,235);
    pdf.setFont("helvetica","bold");
    pdf.text("MPT", 10.2, 10);

    pdf.setTextColor(255,255,255);
    pdf.setFont("helvetica","bold");
    pdf.setFontSize(9);
    pdf.text(titulo, 21, 9);
    pdf.setFont("helvetica","normal");
    pdf.setFontSize(7);
    pdf.text(subtitulo, 21, 15);
    pdf.setFontSize(7);
    pdf.setTextColor(196,213,255);
    let fechaHoy = new Date().toLocaleDateString("es-PE",{day:"2-digit",month:"2-digit",year:"numeric"});
    pdf.text(`Generado: ${fechaHoy}`, pageWidth - 14 - pdf.getTextWidth(`Generado: ${fechaHoy}`), 15);
  }

  function footer(pagina, total) {
    pdf.setFillColor(241,245,249);
    pdf.rect(0, pageHeight - 9, pageWidth, 9, "F");
    pdf.setDrawColor(220,220,220);
    pdf.setLineWidth(0.2);
    pdf.line(0, pageHeight - 9, pageWidth, pageHeight - 9);
    pdf.setFontSize(6.5);
    pdf.setTextColor(148,163,184);
    pdf.text("SUBGERENCIA DE SALUD – OBSTETRICIA", 14, pageHeight - 3.5);
    let pag = `Página ${pagina} de ${total}`;
    pdf.text(pag, pageWidth/2 - pdf.getTextWidth(pag)/2, pageHeight - 3.5);
    let fechaHoy = new Date().toLocaleDateString("es-PE",{day:"2-digit",month:"2-digit",year:"numeric"});
    pdf.text(`Generado: ${fechaHoy}`, pageWidth - 14 - pdf.getTextWidth(`Generado: ${fechaHoy}`), pageHeight - 3.5);
  }

  const totalPaginas = (canvasTendencia && window.graficoLinea) ? 2 : 1;

  // ════════════════════════════════════════════════════════
  // ✅ CAPTURA CORREGIDA — usa capturarChartConLeyenda
  // ════════════════════════════════════════════════════════
  const leyendasBarra = labels.map((tipo, i) => ({
    label: tipo,
    color: colorPorTipo(tipo, i),
    pct: totalMatrimonios > 0 ? ((valores[i] / totalMatrimonios) * 100).toFixed(1) + "%" : "0%"
  }));
  const capBarra = capturarChartConLeyenda(
    window.graficoBarra,
    "Frecuencia por tipo de matrimonio",
    leyendasBarra,
    600
  );

  const leyendasPie = labels.map((tipo, i) => ({
    label: tipo,
    color: colorPorTipo(tipo, i),
    pct: totalMatrimonios > 0 ? ((valores[i] / totalMatrimonios) * 100).toFixed(1) + "%" : "0%"
  }));
  const capPie = capturarChartConLeyenda(
    window.graficoPie,
    "Porcentaje por tipo de matrimonio",
    leyendasPie,
    600
  );

  const capTendencia = (canvasTendencia && window.graficoLinea)
    ? capturarChartConLeyenda(
        window.graficoLinea,
        "Tendencia mensual de atenciones",
        [{ label: "Total por mes", color: "#2563eb", pct: "" }],
        600
      )
    : null;

  // ════════════════════════════════════════════════════════
  // PÁGINA 1 — Barras + Torta
  // ════════════════════════════════════════════════════════
  encabezado(
    "Gráfico de frecuencia y porcentual – Atención a contrayentes en Consejería ITS según tipo de matrimonio",
    "SUBGERENCIA DE SALUD  ·  OBSTETRICIA  ·  2026"
  );

  pdf.setFillColor(241,245,249);
  pdf.rect(0, 18, pageWidth, 8, "F");
  pdf.setFont("helvetica","bold");
  pdf.setFontSize(7.5);
  pdf.setTextColor(71,85,105);
  pdf.text("PERÍODO:", 14, 23.5);
  pdf.setFont("helvetica","normal");
  pdf.text(textoPeriodo, 14 + pdf.getTextWidth("PERÍODO:") + 3, 23.5);
  let totalTexto = `TOTAL: ${totalMatrimonios} matrimonios`;
  pdf.setFont("helvetica","bold");
  pdf.text(totalTexto, pageWidth - 14 - pdf.getTextWidth(totalTexto), 23.5);

  lineaDivisora(26);

  const tarjY  = 29;
  const tarjH  = 18;
  const tarjW  = 48;
  const gap    = 5;
  const totalT = 1 + labels.length;
  const grupoW = totalT * tarjW + (totalT - 1) * gap;
  let tarjX    = (pageWidth - grupoW) / 2;

  tarjeta(tarjX, tarjY, tarjW, tarjH, "#f97316", "TOTAL MATRIMONIOS", totalMatrimonios, "");
  tarjX += tarjW + gap;
  labels.forEach((tipo, i) => {
    let pct = totalMatrimonios > 0
      ? ((valores[i] / totalMatrimonios) * 100).toFixed(1) + "% del total"
      : "0%";
    tarjeta(tarjX, tarjY, tarjW, tarjH, colorPorTipo(tipo, i), tipo, valores[i], pct);
    tarjX += tarjW + gap;
  });

  lineaDivisora(tarjY + tarjH + 4);

  const grafY    = tarjY + tarjH + 8;
  const grafH    = pageHeight - grafY - 14;
  const gapPanel = 6;
  const panelW   = (pageWidth - 28 - gapPanel) / 2;
  const panel1X  = 14;
  const panel2X  = panel1X + panelW + gapPanel;

  // Panel BARRAS
  pdf.setFillColor(248,250,252);
  pdf.roundedRect(panel1X, grafY, panelW, grafH, 3, 3, "F");
  pdf.setDrawColor(226,232,240);
  pdf.setLineWidth(0.3);
  pdf.roundedRect(panel1X, grafY, panelW, grafH, 3, 3, "S");

  if (capBarra) {
    const margin = 4;
    const imgW = panelW - margin * 2;
    const imgH = imgW * capBarra.ratio;
    const imgX = panel1X + margin;
    const imgY = grafY + (grafH - Math.min(imgH, grafH - margin * 2)) / 2;
    pdf.addImage(capBarra.img, "PNG", imgX, imgY, imgW, Math.min(imgH, grafH - margin * 2), "", "FAST");
  }

  // Panel TORTA
  pdf.setFillColor(248,250,252);
  pdf.roundedRect(panel2X, grafY, panelW, grafH, 3, 3, "F");
  pdf.setDrawColor(226,232,240);
  pdf.setLineWidth(0.3);
  pdf.roundedRect(panel2X, grafY, panelW, grafH, 3, 3, "S");

  if (capPie) {
    const margin = 4;
    const imgW = panelW - margin * 2;
    const imgH = imgW * capPie.ratio;
    const imgX = panel2X + margin;
    const imgY = grafY + (grafH - Math.min(imgH, grafH - margin * 2)) / 2;
    pdf.addImage(capPie.img, "PNG", imgX, imgY, imgW, Math.min(imgH, grafH - margin * 2), "", "FAST");
  }

  footer(1, totalPaginas);

  // ════════════════════════════════════════════════════════
  // PÁGINA 2 — Tendencia mensual
  // ════════════════════════════════════════════════════════
  if (capTendencia) {
    pdf.addPage();

    encabezado(
      "Tendencia mensual de atención a contrayentes – Consejería ITS  2026",
      "Evolución histórica de todos los registros por mes  ·  Sin filtro de fecha"
    );

    pdf.setFillColor(241,245,249);
    pdf.rect(0, 18, pageWidth, 8, "F");
    pdf.setFont("helvetica","bold");
    pdf.setFontSize(7.5);
    pdf.setTextColor(71,85,105);
    pdf.text("NOTA:", 14, 23.5);
    pdf.setFont("helvetica","normal");
    pdf.text("Este gráfico muestra la evolución completa sin filtro de fecha aplicado.", 14 + pdf.getTextWidth("NOTA:") + 3, 23.5);

    lineaDivisora(26);

    const mesesOrdenados = nombresMeses.filter(m => tendenciaMesesTotal[m]);
    const maxVal  = Math.max(...Object.values(tendenciaMesesTotal));
    const totalM  = mesesOrdenados.length;
    const mAncho  = Math.min(22, (pageWidth - 28 - (totalM - 1) * 2) / totalM);
    const mAlto   = 18;
    const grupoMW = totalM * mAncho + (totalM - 1) * 2;
    let mx        = (pageWidth - grupoMW) / 2;
    const my      = 29;

    mesesOrdenados.forEach(mes => {
      let v     = tendenciaMesesTotal[mes];
      let ratio = v / maxVal;
      pdf.setFillColor(249, Math.round(115 + ratio * 50), 22);
      pdf.roundedRect(mx, my, mAncho, mAlto, 2, 2, "F");
      pdf.setTextColor(255,255,255);
      pdf.setFont("helvetica","bold");
      pdf.setFontSize(10);
      let vs = v.toString();
      pdf.text(vs, mx + mAncho/2 - pdf.getTextWidth(vs)/2, my + mAlto * 0.54);
      pdf.setFont("helvetica","normal");
      pdf.setFontSize(5.5);
      pdf.text(mes.toUpperCase(), mx + mAncho/2 - pdf.getTextWidth(mes.toUpperCase())/2, my + mAlto * 0.85);
      mx += mAncho + 2;
    });

    lineaDivisora(my + mAlto + 4);

    const tendY      = my + mAlto + 8;
    const tendH      = pageHeight - tendY - 14;
    const tendPanelW = pageWidth - 28;

    pdf.setFillColor(248,250,252);
    pdf.roundedRect(14, tendY, tendPanelW, tendH, 3, 3, "F");
    pdf.setDrawColor(226,232,240);
    pdf.setLineWidth(0.3);
    pdf.roundedRect(14, tendY, tendPanelW, tendH, 3, 3, "S");

    const margin = 4;
    const tImgW = tendPanelW - margin * 2;
    const tImgH = tImgW * capTendencia.ratio;
    const tImgX = 14 + margin;
    const tImgY = tendY + (tendH - Math.min(tImgH, tendH - margin * 2)) / 2;
    pdf.addImage(capTendencia.img, "PNG", tImgX, tImgY, tImgW, Math.min(tImgH, tendH - margin * 2), "", "FAST");

    footer(2, totalPaginas);
  }

  pdf.save("Dashboard_Matrimonios_MPT_2026.pdf");
}