function generarPDFSeleccionado() {

  // 🔥 Guardar checkboxes visibles actualmente
  document.querySelectorAll(".columnaCheck").forEach(c => {
    const hoja = c.dataset.hoja;
    if (!hoja) return;
    if (!columnasSeleccionadas[hoja]) columnasSeleccionadas[hoja] = new Set();
    if (c.checked) {
      columnasSeleccionadas[hoja].add(c.value);
    } else {
      columnasSeleccionadas[hoja].delete(c.value);
    }
  });

  // 🔥 Verificar que haya al menos una columna seleccionada
  const totalSeleccionado = Object.values(columnasSeleccionadas)
    .reduce((acc, set) => acc + set.size, 0);

  if (totalSeleccionado === 0) {
    mostrarAlerta("Selecciona al menos una columna", "warning");
    return;
  }

  let desde = document.getElementById("filtroFechaDesde").value;
  let hasta = document.getElementById("filtroFechaHasta").value;

  // ── Construir lista de headers globales sin duplicados ────────
  // Respeta el orden de aparición por hoja
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

  // ── Combinar filas de TODAS las hojas en una sola lista ───────
  // Los campos que no pertenecen a la hoja quedan vacíos ("")
  let mapaFilas = new Map();

  for (let hoja in columnasSeleccionadas) {
    const cols = columnasSeleccionadas[hoja];
    if (!cols || cols.size === 0) continue;

    let data = datosPorHoja[hoja];
    if (!data || data.length === 0) continue;

    const campoFecha = Object.keys(data[0]).find(k => k.toLowerCase().includes("fecha"));
    const campoNombre = Object.keys(data[0]).find(k => k.toLowerCase().includes("nombre"));

    let dataFiltrada = data.filter(row => {
      if (campoNombre && (!row[campoNombre] || row[campoNombre].toString().trim() === "")) {
        return false;
      }
      return true;
    });

    dataFiltrada.forEach((row, index) => {

      // 🔥 CLAVE ÚNICA (usa nombre o ID si tienes)
      let key = campoNombre ? row[campoNombre] : index;

      if (!mapaFilas.has(key)) {
        mapaFilas.set(key, {});
      }

      let filaObj = mapaFilas.get(key);

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

        if (typeof valor === "string") valor = valor.trim();

        filaObj[h] = valor;
      });

    });
  }

  let filasCombinadas = [];

  mapaFilas.forEach(obj => {
    let fila = headersGlobalesOrdenados.map(h => obj[h] || "");
    filasCombinadas.push(fila);
  });

  if (filasCombinadas.length === 0) {
    mostrarAlerta("No hay datos para exportar con los filtros aplicados", "warning");
    return;
  }

  // ── Headers formateados con salto de línea ────────────────────
  const headersFormateados = headersGlobalesOrdenados.map(h => {
    let palabras = h.split(" ");
    if (palabras.length >= 2) {
      let mitad = Math.ceil(palabras.length / 2);
      return palabras.slice(0, mitad).join(" ") + "\n" +
        palabras.slice(mitad).join(" ");
    }
    return h;
  });

  // ── Calcular anchos de columna ────────────────────────────────
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

  // ── Título: muestra las secciones combinadas ──────────────────
  const seccionesIncluidas = Object.entries(columnasSeleccionadas)
    .filter(([, set]) => set.size > 0)
    .map(([hoja]) => hoja)
    .join(" + ");

  // 🔥 LOGO
  const logo = new Image();
  logo.src = "ESCUDO_MPT_2.png"; // misma ruta que usas en HTML



  // ── Tabla única ───────────────────────────────────────────────
  pdf.autoTable({

    head: [
      [
        {
          content: "ATENCION A CONTRIBUYENTES",
          colSpan: headersFormateados.length,
          styles: {
            halign: "center",
            fillColor: [180, 180, 180],
            textColor: [0, 0, 0],
            fontStyle: "bold",
            fontSize: 10,
            lineWidth: 0.4,     // 🔥 borde fuerte
            lineColor: [0, 0, 0]
          }
        }
      ],
      headersFormateados
    ],

    body: filasCombinadas,

    startY: 25,
    margin: { left: 10, right: 10 },
    tableWidth: "wrap",
    columnStyles,

    styles: {
      fontSize: 7,
      cellPadding: 0.5,
      overflow: "linebreak",
      lineWidth: 0.2,
      lineColor: [0, 0, 0]
    },

    headStyles: {
      fillColor: [205, 205, 205],
      textColor: [0, 0, 0],
      halign: "center",
      fontStyle: "bold",
      lineWidth: 0.3,
      lineColor: [0, 0, 0]
    },

    didParseCell: function (data) {
      if (data.section === "body") {
        let texto = (data.cell.text[0] || "").toString().trim();
        let esNumero = /^\d+$/.test(texto);
        let esFecha = /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(texto);
        data.cell.styles.halign = (esNumero || esFecha) ? "center" : "left";
      }
    },

    // 🔥 👉 AQUÍ VA EXACTAMENTE 👇
    didDrawPage: function () {

      const logo = new Image();
      logo.src = "ESCUDO_MPT_2.png";

      pdf.addImage(logo, "PNG", 14, 8, 15, 15);

      pdf.setFontSize(11);
      pdf.text(seccionesIncluidas.toUpperCase(), 35, 15);

    },

    theme: "grid"
  });

  // ── Nombre del archivo ────────────────────────────────────────
  const nombreArchivo = Object.entries(columnasSeleccionadas)
    .filter(([, set]) => set.size > 0)
    .map(([hoja]) => hoja.toLowerCase().replace(/ /g, "_"))
    .join("_y_");

  pdf.save(`reporte_${nombreArchivo}.pdf`);
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