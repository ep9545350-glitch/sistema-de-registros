function generarPDFSeleccionado() {

  // 🔥 tomar la hoja elegida en el modal
  const selectorHojaPDF = document.getElementById("selectorHojaPDF");
  const hojaParaPDF = selectorHojaPDF ? selectorHojaPDF.value : hojaActual;

  if (!hojaParaPDF) {
    mostrarAlerta("Selecciona una sección antes de exportar", "warning");
    return;
  }

  let data = datosPorHoja[hojaParaPDF];
  if (!data || data.length === 0) {
    mostrarAlerta("No hay datos para exportar", "danger");
    return;
  }

  const checks = document.querySelectorAll(".columnaCheck:checked");

  if (checks.length === 0) {
    mostrarAlerta("Selecciona al menos una columna", "warning");
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
  // FILAS
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

      if (h.toLowerCase().replace(/\s+/g, "").includes("matrimonio")) {
        valor = normalizarTipoMatrimonio(valor);
      }

      if (hojaParaPDF.toLowerCase().includes("registro")) {
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

  // =====================
  // ANCHO DE COLUMNAS
  // =====================
  let columnStyles = {};

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

  const pageWidth = pdf.internal.pageSize.getWidth() - 20;
  const scale = pageWidth / totalWidth;

  Object.keys(columnStyles).forEach(i => {
    columnStyles[i].cellWidth *= scale;
  });

  // =====================
  // TABLA
  // =====================
  pdf.autoTable({
    head: [headers],
    body: filas,

    startY: 20,
    margin: { left: 10, right: 10 },

    tableWidth: "wrap",
    horizontalPageBreak: false,

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
      // 🔥 título con el nombre de la sección
      pdf.text(`REPORTE - ${hojaParaPDF.toUpperCase()}`, 14, 10);
    }
  });

  pdf.save(`reporte_${hojaParaPDF.toLowerCase().replace(/ /g, "_")}.pdf`);
}
function exportarDashboardPDF() {

  let filtroMes = document.getElementById("filtroMesDashboard").value;

  // 🔥 VALIDACIÓN
  if (!filtroMes) {
    mostrarAlerta("Debes seleccionar un mes antes de exportar", "warning");
    return;
  }

  const canvasBarra = document.getElementById("graficoBarras");
  const canvasPie = document.getElementById("graficoTorta");

  if (!canvasBarra || !canvasPie) {
    mostrarAlerta("No hay gráficos disponibles", "danger");
    return;
  }

  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF("landscape", "mm", "a4");

  const pageWidth = pdf.internal.pageSize.getWidth();

  // =====================
  // 📊 DATOS
  // =====================
  let data = [];

  // 🔥 UNIFICAR TODAS LAS HOJAS
  for (let hoja in datosPorHoja) {
    data = data.concat(datosPorHoja[hoja]);
  }

  let conteo = {};
  let totalMatrimonios = 0;

  data.forEach(row => {

    let campoTipo = Object.keys(row).find(k =>
      k.toLowerCase().replace(/\s+/g, "").includes("matrimonio")
    );

    let campoFecha = Object.keys(row).find(k =>
      k.toLowerCase().includes("fecha") ||
      k.toLowerCase().includes("f.")
    );

    if (!campoTipo) return;
    if (!campoFecha) return;

    let fecha = row[campoFecha];
    if (!fecha) return;

    let f;

    if (typeof fecha === "string" && fecha.includes("/")) {
      let partes = fecha.split("/");
      f = new Date(`${partes[2]}-${partes[1]}-${partes[0]}`);
    } else {
      f = new Date(fecha);
    }

    if (isNaN(f)) return;

    let formato = `${f.getFullYear()}-${(f.getMonth() + 1)
      .toString()
      .padStart(2, "0")}`;

    if (formato !== filtroMes) return;

    // ✅ CONTAR
    totalMatrimonios++;

    let tipo = normalizarTipoMatrimonio(row[campoTipo]);
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
  // 🎯 HEADER BONITO
  // =====================
  pdf.setFillColor(13, 110, 253);
  pdf.rect(0, 0, pageWidth, 20, "F");

  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(16);
  pdf.text("REPORTE DE MATRIMONIOS", 14, 12);

  pdf.setFontSize(10);
  let fechaActual = new Date().toLocaleDateString();
  pdf.text(`Fecha: ${fechaActual}`, pageWidth - 50, 12);

  // =====================
  // 📅 SUBTÍTULO
  // =====================
  pdf.setTextColor(0, 0, 0);
  pdf.setFontSize(12);

  let textoFecha = "Resumen General";
  if (filtroMes) {
    const partes = filtroMes.split("-");
    textoFecha = `Mes: ${partes[1]}/${partes[0]}`;
  }

  pdf.text(textoFecha, 14, 28);

  // =====================
  // 🟫 TARJETA TOTAL DESTACADA
  // =====================
  pdf.setFillColor(33, 37, 41);
  pdf.roundedRect(14, 32, 60, 30, 4, 4, "F");

  pdf.setTextColor(255, 255, 255);

  pdf.setFontSize(18);
  pdf.text(
    totalMatrimonios.toString(),
    14 + 30 - pdf.getTextWidth(totalMatrimonios.toString()) / 2,
    45
  );

  pdf.setFontSize(10);
  pdf.text(
    "TOTAL MATRIMONIOS",
    14 + 30 - pdf.getTextWidth("TOTAL MATRIMONIOS") / 2,
    55
  );

  // =====================
  // 🟦 TARJETAS POR TIPO
  // =====================
  let x = 80;
  let y = 32;
  let ancho = 45;
  let alto = 30;
  let espacio = 8;

  labels.forEach((tipo, i) => {

    let colorHex = colores[i % colores.length];

    let r = parseInt(colorHex.substring(1, 3), 16);
    let g = parseInt(colorHex.substring(3, 5), 16);
    let b = parseInt(colorHex.substring(5, 7), 16);

    // sombra simulada
    pdf.setFillColor(200, 200, 200);
    pdf.roundedRect(x + 1, y + 1, ancho, alto, 4, 4, "F");

    // tarjeta
    pdf.setFillColor(r, g, b);
    pdf.roundedRect(x, y, ancho, alto, 4, 4, "F");

    pdf.setTextColor(255, 255, 255);

    pdf.setFontSize(16);
    let val = valores[i].toString();
    pdf.text(
      val,
      x + (ancho / 2) - (pdf.getTextWidth(val) / 2),
      y + 12
    );

    pdf.setFontSize(10);
    pdf.text(
      tipo,
      x + (ancho / 2) - (pdf.getTextWidth(tipo) / 2),
      y + 22
    );

    x += ancho + espacio;

    if (x + ancho > pageWidth) {
      x = 80;
      y += alto + espacio;
    }
  });

  // =====================
  // 📊 GRÁFICOS
  // =====================
  const imgBarra = canvasBarra.toDataURL("image/png", 1.0);
  const imgPie = canvasPie.toDataURL("image/png", 1.0);

  let inicioY = y + alto + 15;

  const imgWidth = pageWidth / 2 - 20;

  // barras
  pdf.addImage(imgBarra, "PNG", 14, inicioY, imgWidth, 80);

  // torta (cuadrado perfecto)
  pdf.addImage(imgPie, "PNG", pageWidth / 2 + 5, inicioY, 80, 80);

  // =====================
  // 📌 FOOTER
  // =====================
  pdf.setFontSize(9);
  pdf.setTextColor(120);
  pdf.text(
    "Reporte generado automáticamente",
    14,
    pdf.internal.pageSize.getHeight() - 5
  );

  pdf.save("dashboard_matrimonios_pro.pdf");
}

function normalizarTipoMatrimonio(valor) {
  if (!valor) return "";

  let v = valor.toString().trim().toLowerCase();

  if (v === "p") return "PAGADO";
  if (v === "m") return "MASIVO";

  return valor.toString().toUpperCase();
}
function mostrarAlerta(mensaje, tipo = "danger") {
  const contenedor = document.getElementById("alertas");

  if (!contenedor) return;

  contenedor.innerHTML = `
    <div class="alert alert-${tipo} alert-dismissible fade show shadow" role="alert"
         style="border-left: 5px solid ${tipo === "danger" ? "#dc3545" : "#ffc107"};">
      <strong>${tipo === "danger" ? "❌ Error:" : "⚠️ Atención:"}</strong> ${mensaje}
      <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    </div>
  `;

  setTimeout(() => {
    contenedor.innerHTML = "";
  }, 4000);
}