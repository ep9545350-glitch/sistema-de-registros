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