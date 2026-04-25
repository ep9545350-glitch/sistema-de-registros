function generarPDFSeleccionado() {

  let data = datosPorHoja[hojaActual];
  if (!data || data.length === 0) {
    alert("No hay datos");
    return;
  }

  const checks = document.querySelectorAll(".columnaCheck:checked");

  if (checks.length === 0) {
    alert("Selecciona al menos una columna");
    return;
  }

  const headersSeleccionados = Array.from(checks).map(c => c.value);

  const campoFecha = Object.keys(data[0]).find(k => k.toLowerCase().includes("fecha"));
  const campoNombre = Object.keys(data[0]).find(k => k.toLowerCase().includes("nombre"));

  let desde = document.getElementById("filtroFechaDesde").value;
  let hasta = document.getElementById("filtroFechaHasta").value;

  // =====================
  // FILTRAR DATOS
  // =====================
  let dataFiltrada = data.filter(row => {

    if (campoNombre && (!row[campoNombre] || row[campoNombre].trim() === "")) {
      return false;
    }

    if (campoFecha && (desde || hasta)) {

      let valorFecha = row[campoFecha];
      if (!valorFecha) return false;

      let f;

      if (typeof valorFecha === "string" && valorFecha.includes("/")) {
        let partes = valorFecha.split("/");
        f = new Date(`${partes[2]}-${partes[1]}-${partes[0]}`);
      } else {
        f = new Date(valorFecha);
      }

      if (isNaN(f)) return false;

      if (desde && f < new Date(desde)) return false;
      if (hasta && f > new Date(hasta)) return false;
    }

    return true;
  });

  // =====================
  // HEADERS
  // =====================
  const headers = headersSeleccionados.map(h => {
    let palabras = h.split(" ");
    if (palabras.length >= 2) {
      let mitad = Math.ceil(palabras.length / 2);
      return palabras.slice(0, mitad).join(" ") + "\n" +
             palabras.slice(mitad).join(" ");
    }
    return h;
  });

  // =====================
  // FILAS (SIN ESPACIOS)
  // =====================
  const filas = dataFiltrada.map((row, index) => {
    return headersSeleccionados.map(h => {

      let valor;

      if (esCampoOrden(h)) {
        let valorExcel = row[h];
        valor = (valorExcel !== undefined && valorExcel !== "") ? valorExcel : index + 1;
      } else {
        valor = row[h] ?? "";
      }

      // 🔥 limpiar espacios SOLO en registro
      if (hojaActual.toLowerCase().includes("registro")) {
        if (typeof valor === "string") {
          valor = valor.trim();
        }
      }

      return valor;
    });
  });

  const { jsPDF } = window.jspdf;

  const pdf = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4"
  });

  const esRegistroAtencion = hojaActual.toLowerCase().includes("registro");

  // =====================
  // ANCHO REAL DE COLUMNAS
  // =====================
  let columnStyles = {};

  if (esRegistroAtencion) {

    pdf.setFontSize(7);

    let totalWidth = 0;

    headersSeleccionados.forEach((h, i) => {

      let maxWidth = pdf.getTextWidth(h);

      filas.forEach(f => {
        let texto = (f[i] || "").toString().trim();
        let w = pdf.getTextWidth(texto);
        if (w > maxWidth) maxWidth = w;
      });

      maxWidth += 4;
      maxWidth = Math.max(6, Math.min(maxWidth, 60));

      columnStyles[i] = { cellWidth: maxWidth };
      totalWidth += maxWidth;
    });

    // 🔥 ajustar a todo el ancho de la hoja
    const pageWidth = pdf.internal.pageSize.getWidth() - 20;
    const scale = pageWidth / totalWidth;

    Object.keys(columnStyles).forEach(i => {
      columnStyles[i].cellWidth *= scale;
    });
  }

  const esResultadosLaboratorio = hojaActual.toLowerCase().includes("laboratorio");

if (esResultadosLaboratorio) {

  pdf.setFontSize(7);

  let totalWidth = 0;

  headersSeleccionados.forEach((h, i) => {

    let maxWidth = pdf.getTextWidth(h);

    filas.forEach(f => {
      let texto = (f[i] || "").toString().trim();
      let w = pdf.getTextWidth(texto);
      if (w > maxWidth) maxWidth = w;
    });

    maxWidth += 4; // padding

    // límites para que no se desborde feo
    maxWidth = Math.max(10, Math.min(maxWidth, 80));

    columnStyles[i] = { cellWidth: maxWidth };
    totalWidth += maxWidth;
  });

  // 🔥 ajustar todo al ancho de la hoja
  const pageWidth = pdf.internal.pageSize.getWidth() - 20;
  const scale = pageWidth / totalWidth;

  Object.keys(columnStyles).forEach(i => {
    columnStyles[i].cellWidth *= scale;
  });
}

  // =====================
  // TABLA (TODO EN UNA HOJA)
  // =====================
  pdf.autoTable({
    head: [headers],
    body: filas,

    startY: 20,
    margin: { left: 10, right: 10 },

    tableWidth: "wrap", // 🔥 TODO en una sola hoja
    horizontalPageBreak: false, // 🔥 NO dividir

    columnStyles: columnStyles,

    styles: {
      fontSize: 7,
      cellPadding: 0.3,
      overflow: "linebreak",
      cellWidth: "wrap"
    },

    headStyles: {
      fillColor: [0, 0, 0],
      textColor: [255, 255, 255],
      halign: "center",
      fontStyle: "bold"
    },

    // =====================
    // CENTRADO INTELIGENTE
    // =====================
    didParseCell: function (data) {

      if (data.section === "body") {
        let texto = (data.cell.text[0] || "").toString().trim();

        let esNumero = /^\d+$/.test(texto);
        let esFecha = /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(texto);

        if (esNumero || esFecha) {
          data.cell.styles.halign = "center";
        } else {
          data.cell.styles.halign = "left";
        }
      }

      if (data.section === "head") {
        data.cell.styles.halign = "center";
      }
    },

    theme: "grid",

    didDrawPage: function () {
      pdf.setFontSize(12);
      pdf.text("REPORTE GENERAL", 14, 10);
    }
  });

  pdf.save("reporte.pdf");
}
function exportarDashboardPDF() {

  const canvasBarra = document.getElementById("graficoBarras");
  const canvasPie = document.getElementById("graficoTorta");

  if (!canvasBarra || !canvasPie) {
    alert("No hay gráficos");
    return;
  }

  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF("landscape", "mm", "a4");

  const pageWidth = pdf.internal.pageSize.getWidth();

  // =====================
  // 📊 DATOS
  // =====================
  let data = datosPorHoja[hojaActual];
  const headers = headersPorHoja[hojaActual];

  let campoTipo = headers.find(h =>
    h.toLowerCase().replace(/\s+/g, "").includes("matrimonio")
  );

  let campoFecha = headers.find(h =>
    h.toLowerCase().includes("fecha")
  );

  let filtroMes = document.getElementById("filtroMesDashboard").value;

  let conteo = {};

  data.forEach(row => {

    if (filtroMes && campoFecha) {
      let fecha = row[campoFecha];

      if (fecha && fecha.includes("/")) {
        let partes = fecha.split("/");
        let formato = `${partes[2]}-${partes[1]}`;
        if (formato !== filtroMes) return;
      }
    }

    let tipo = (row[campoTipo] || "").toString().trim().toUpperCase();
    if (!tipo) return;

    if (!conteo[tipo]) conteo[tipo] = 0;
    conteo[tipo]++;
  });

  const labels = Object.keys(conteo);
  const valores = Object.values(conteo);

  // =====================
  // 🎨 COLORES
  // =====================
  const colores = [
    "#0d6efd", "#198754", "#ffc107", "#dc3545",
    "#6f42c1", "#20c997", "#fd7e14", "#0dcaf0"
  ];

  // =====================
  // 📅 TÍTULO
  // =====================
  let textoFecha = "REPORTE GENERAL";

  if (filtroMes) {
    const partes = filtroMes.split("-");
    textoFecha = `REPORTE DEL MES: ${partes[1]}/${partes[0]}`;
  }

  pdf.setFontSize(16);
  pdf.text(textoFecha, 14, 15);

  // =====================
  // 🟦 TARJETAS CENTRADAS
  // =====================
  let x = 10;
  let y = 25;
  let ancho = 40;
  let alto = 25;
  let espacio = 5;

  labels.forEach((tipo, i) => {

    let colorHex = colores[i % colores.length];

    let r = parseInt(colorHex.substring(1, 3), 16);
    let g = parseInt(colorHex.substring(3, 5), 16);
    let b = parseInt(colorHex.substring(5, 7), 16);

    pdf.setFillColor(r, g, b);
    pdf.roundedRect(x, y, ancho, alto, 3, 3, "F");

    pdf.setTextColor(255, 255, 255);

    // 🔥 CENTRAR VALOR
    pdf.setFontSize(14);
    let textoValor = valores[i].toString();
    let textWidthValor = pdf.getTextWidth(textoValor);
    let centroX = x + (ancho / 2) - (textWidthValor / 2);

    pdf.text(textoValor, centroX, y + 10);

    // 🔥 CENTRAR TIPO
    pdf.setFontSize(9);
    let textWidthTipo = pdf.getTextWidth(tipo);
    let centroTipo = x + (ancho / 2) - (textWidthTipo / 2);

    pdf.text(tipo, centroTipo, y + 18);

    x += ancho + espacio;

    if (x + ancho > pageWidth) {
      x = 10;
      y += alto + espacio;
    }
  });

  // =====================
  // 📊 GRÁFICOS
  // =====================
  const imgBarra = canvasBarra.toDataURL("image/png", 1.0);
  const imgPie = canvasPie.toDataURL("image/png", 1.0);

  let inicioY = y + alto + 10;

  const imgWidth = pageWidth / 2 - 20;

  // 📊 BARRAS (RECTANGULAR OK)
  pdf.addImage(imgBarra, "PNG", 10, inicioY, imgWidth, 80);

  // 🥧 TORTA (🔥 CUADRADO PARA NO DEFORMAR)
  const sizePie = 80; // mismo ancho y alto

  pdf.addImage(
    imgPie,
    "PNG",
    pageWidth / 2 + 5,
    inicioY,
    sizePie,
    sizePie
  );

  pdf.save("dashboard_pro.pdf");

  
}
