const COLORES_GRAFICOS = [
  "#0d6efd", "#198754", "#ffc107", "#dc3545",
  "#6f42c1", "#20c997", "#fd7e14", "#0dcaf0"
];
let modoFiltrado = false;
let datosPorHoja = {};
let headersPorHoja = {};
let hojaActual = "";
let headersGlobales = [];

// 🔥 NUEVO
let camposCompartidos = {};
let contadorOrden = 1;

// PAGINACIÓN
let paginaActual = 1;
const filasPorPagina = 50;

// HOJA OCULTA
const HOJA_OCULTA = "tipo de matrimonio";

// =====================
// DETECTAR CAMPO ORDEN
// =====================
function esCampoOrden(nombre) {
  if (!nombre) return false;

  nombre = nombre.toLowerCase().replace(/\s+/g, "");

  return (
    nombre === "n°" ||
    nombre === "nº" ||
    nombre === "no" ||
    nombre.includes("orden") ||
    nombre.includes("n°") ||
    nombre.includes("nº") ||
    nombre.includes("numero")
  );
}

// =====================
// CARGAR DATOS GUARDADOS
// =====================
window.onload = function () {
  const datosGuardados = localStorage.getItem("datosExcel");
  const headersGuardados = localStorage.getItem("headersExcel");
  const ordenGuardado = localStorage.getItem("contadorOrden");

  if (ordenGuardado) {
    contadorOrden = parseInt(ordenGuardado);
  }

  if (datosGuardados && headersGuardados) {
    datosPorHoja = JSON.parse(datosGuardados);
    headersPorHoja = JSON.parse(headersGuardados);

    headersGlobales = Object.values(headersPorHoja).flat();

    detectarCamposCompartidos();

    hojaActual = Object.keys(datosPorHoja)[0];

    generarFormulario();
    cargarSelector();

    document.getElementById("contenedorTabla").style.display = "block";
    mostrarTablaPaginada(datosPorHoja[hojaActual]);
    cargarTiposMatrimonio();
  }
};

// =====================
// DETECTAR CAMPOS COMPARTIDOS
// =====================
function detectarCamposCompartidos() {
  camposCompartidos = {};

  headersGlobales.forEach(h => {
    let count = 0;

    for (let hoja in headersPorHoja) {
      if (headersPorHoja[hoja].includes(h)) {
        count++;
      }
    }

    if (count > 1) {
      camposCompartidos[h] = true;
    }
  });
}

function normalizarTipoMatrimonio(valor) {
  if (!valor) return "";

  let v = valor.toString().trim().toLowerCase();

  if (v === "p") return "PAGADO";
  if (v === "m") return "MASIVO";

  return valor.toString().toUpperCase();
}

// =====================
// LEER EXCEL
// =====================
document.getElementById("fileInput").addEventListener("change", handleFile);

function handleFile(e) {
  const file = e.target.files[0];
  const reader = new FileReader();

  reader.readAsArrayBuffer(file);

  reader.onload = function (e) {
    const data = new Uint8Array(e.target.result);
    const workbook = XLSX.read(data, { type: "array" });

    datosPorHoja = {};
    headersPorHoja = {};
    headersGlobales = [];

    workbook.SheetNames.forEach(nombreHoja => {

      const hoja = nombreHoja.toLowerCase();
      const esOculta = hoja === HOJA_OCULTA;

      const sheet = workbook.Sheets[nombreHoja];

      // 🔥 NORMALIZAR HEADERS
      let headers = (XLSX.utils.sheet_to_json(sheet, { header: 1 })[0] || [])
        .map(h => h ? h.toString().trim() : "");

      // 🔥 ASEGURAR QUE EXISTA N°
      if (!headers.some(h => esCampoOrden(h))) {
        headers.unshift("N°");
      }

      let jsonData = XLSX.utils.sheet_to_json(sheet, { raw: true });

      // 🔥 ELIMINAR COLUMNAS VACÍAS
      headers = headers.filter(h => {
        if (!h || h.trim() === "") return false;

        return jsonData.some(row => row[h] !== undefined && row[h] !== "");
      });

      // 🔥 👉 AGREGA ESTO AQUÍ 👇
      jsonData = jsonData.map(row => {
        let nuevo = {};
        headers.forEach(h => {
          nuevo[h] = row[h] ?? "";
        });
        return nuevo;
      });

      // 🔥 ASEGURAR QUE EXISTA N°
      if (!headers.some(h => esCampoOrden(h))) {
        headers.unshift("N°");
      }

      // 🔥 GUARDAR
      headersPorHoja[hoja] = headers;


      jsonData.forEach(row => {
        for (let key in row) {
          let valor = row[key];
          let nombreCampo = key.toLowerCase();

          // 🔥 FORMATEAR FECHAS
          if (typeof valor === "number" && valor > 30000 && valor < 60000) {
            row[key] = soloFecha(valor);
          } else if (nombreCampo.includes("fecha")) {
            row[key] = soloFecha(valor);
          }

          // 🔥 NORMALIZAR TIPO MATRIMONIO
          if (nombreCampo.replace(/\s+/g, "").includes("matrimonio")) {
            row[key] = normalizarTipoMatrimonio(valor);
          }
        }
      });

      datosPorHoja[hoja] = jsonData;
      headersGlobales = [...new Set([...headersGlobales, ...headers])];
    });


    detectarCamposCompartidos();

    hojaActual = Object.keys(datosPorHoja)[0];

    localStorage.setItem("datosExcel", JSON.stringify(datosPorHoja));
    localStorage.setItem("headersExcel", JSON.stringify(headersPorHoja));

    generarFormulario();
    cargarSelector();
    cargarTiposMatrimonio();
  };
}

// =====================
// FORMATO FECHA
// =====================
function soloFecha(valor) {
  if (!valor) return "";

  let fecha;

  if (typeof valor === "number") {
    fecha = new Date((valor - 25569) * 86400 * 1000);
  } else {
    fecha = new Date(valor);
  }

  if (isNaN(fecha)) return valor;

  return `${fecha.getDate().toString().padStart(2, "0")}/${(fecha.getMonth() + 1).toString().padStart(2, "0")
    }/${fecha.getFullYear()}`;
}

// =====================
// FORMULARIO
// =====================
function generarFormulario() {
  const contenedor = document.getElementById("formularioDinamico");
  contenedor.innerHTML = "";

  let inputsCreados = {};

  for (let hoja in headersPorHoja) {

    if (hoja === HOJA_OCULTA) continue;

    contenedor.innerHTML += `
      <div class="col-12 mt-4">
        <h5 class="bg-primary text-white p-2 rounded">${hoja.toUpperCase()}</h5>
      </div>
    `;

    headersPorHoja[hoja].forEach(h => {

      let nombre = h.toLowerCase();

      // 🔥 OCULTAR N°
      if (esCampoOrden(nombre)) return;

      let tipo = "text";

      // 🔥 detectar fechas mejorado
      if (
        nombre.includes("fecha") ||
        nombre.includes("f.") ||
        nombre.includes("consejeria") ||
        nombre.includes("laboratorio") ||
        nombre.includes("consulta")
      ) {
        tipo = "date";
      }

      if (camposCompartidos[h]) {

        if (!inputsCreados[h]) {
          contenedor.innerHTML += `
            <div class="col-md-4">
              <label>${h} (global)</label>
              <input type="${tipo}" id="global_${h}" class="form-control">
            </div>
          `;
          inputsCreados[h] = true;
        }

      } else {
        contenedor.innerHTML += `
          <div class="col-md-4">
            <label>${h}</label>
            <input type="${tipo}" id="${hoja}_${h}" class="form-control">
          </div>
        `;
      }

    });
  }
}

// =====================
// SELECTOR
// =====================
function cargarSelector() {
  const selector = document.getElementById("selectorHoja");
  selector.innerHTML = "";

  Object.keys(datosPorHoja).forEach(h => {
    if (h === HOJA_OCULTA) return;
    selector.innerHTML += `<option value="${h}">${h}</option>`;
  });

  selector.onchange = () => {
    hojaActual = selector.value;
    paginaActual = 1;
    mostrarTablaPaginada(datosPorHoja[hojaActual]);
  };
}

function cargarTiposMatrimonio() {
  const select = document.getElementById("filtroTipoMatrimonio");
  select.innerHTML = `<option value="">Tipo de matrimonio</option>`;

  let hoja = datosPorHoja[HOJA_OCULTA];

  if (!hoja || hoja.length === 0) {
    console.log("⚠️ No hay datos en hoja tipo de matrimonio");
    return;
  }

  // 🔥 agarrar la primera columna REAL (por header)
  const headers = headersPorHoja[HOJA_OCULTA];
  const primeraColumna = headers[0];

  let valoresUnicos = [...new Set(
    hoja.map(r => (r[primeraColumna] || "").toString().trim())
  )];

  valoresUnicos.forEach(v => {
    if (v) {
      select.innerHTML += `<option value="${v}">${v}</option>`;
    }
  });

  console.log("✅ Tipos cargados:", valoresUnicos);
}

// =====================
// TABLA
// =====================
function mostrarTabla(data) {
  const thead = document.getElementById("thead");
  const tbody = document.getElementById("tbody");

  if (!data || data.length === 0) return;

  const headers = headersPorHoja[hojaActual];

  thead.innerHTML = `<tr>${headers.map(h => `<th>${h}</th>`).join("")}</tr>`;

  let filas = "";

  data.forEach((row, index) => {
    filas += "<tr>";

    headers.forEach(h => {

      if (esCampoOrden(h)) {
        // 🔥 SI VIENE DEL EXCEL, USARLO
        let valorExcel = row[h];

        if (valorExcel !== undefined && valorExcel !== "") {
          filas += `<td>${valorExcel}</td>`;
        } else {
          // 🔥 SI NO EXISTE, GENERAR AUTOMÁTICO
          filas += `<td>${(paginaActual - 1) * filasPorPagina + index + 1}</td>`;
        }

      } else {
        let valor = row[h] ?? "";

        // 🔥 NORMALIZAR MATRIMONIO EN TABLA
        if (h.toLowerCase().replace(/\s+/g, "").includes("matrimonio")) {
          valor = normalizarTipoMatrimonio(valor);
        }

        filas += `<td>${valor}</td>`;
      }

    });

    filas += "</tr>";
  });

  tbody.innerHTML = filas;
}

// =====================
// PAGINACIÓN
// =====================
function mostrarTablaPaginada(data) {
  const inicio = (paginaActual - 1) * filasPorPagina;
  const fin = inicio + filasPorPagina;

  mostrarTabla(data.slice(inicio, fin));
}

function siguientePagina() {
  if (modoFiltrado) return;
  paginaActual++;
  mostrarTablaPaginada(datosPorHoja[hojaActual]);
}

function anteriorPagina() {
  if (modoFiltrado) return;
  if (paginaActual > 1) {
    paginaActual--;
    mostrarTablaPaginada(datosPorHoja[hojaActual]);
  }
}

// =====================
// MOSTRAR TABLA
// =====================
function mostrarTablaManual() {
  document.getElementById("contenedorTabla").style.display = "block";
  paginaActual = 1;
  mostrarTablaPaginada(datosPorHoja[hojaActual]);
}

// =====================
// FILTROS
// =====================
function aplicarFiltros() {

  modoFiltrado = true; // 🔥 ACTIVAR MODO FILTRO

  let data = datosPorHoja[hojaActual];
  if (!data || data.length === 0) return;

  let nombre = document.getElementById("filtroNombre").value.toLowerCase();
  let desde = document.getElementById("filtroFechaDesde").value;
  let hasta = document.getElementById("filtroFechaHasta").value;

  const campoFecha = Object.keys(data[0]).find(k => k.toLowerCase().includes("fecha"));
  const campoNombre = Object.keys(data[0]).find(k => k.toLowerCase().includes("nombre"));

  let filtrado = data.filter(row => {

    let ok = true;

    if (nombre && campoNombre) {
      ok = row[campoNombre]?.toLowerCase().includes(nombre);
    }

    if (ok && campoFecha && (desde || hasta)) {

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

      if (desde && f < new Date(desde)) ok = false;
      if (hasta && f > new Date(hasta)) ok = false;
    }

    return ok;
  });

  document.getElementById("contenedorTabla").style.display = "block";

  // 🔥 MOSTRAR TODO (SIN PAGINACIÓN)
  mostrarTabla(filtrado);

  // 🔥 OCULTAR BOTONES
  document.getElementById("paginacion").style.display = "none";
}

// =====================
// LIMPIAR
// =====================
function limpiarFiltros() {

  modoFiltrado = false; // 🔥 DESACTIVAR FILTRO

  document.getElementById("filtroNombre").value = "";
  document.getElementById("filtroFechaDesde").value = "";
  document.getElementById("filtroFechaHasta").value = "";

  document.getElementById("contenedorTabla").style.display = "block";

  // 🔥 VOLVER A PAGINACIÓN NORMAL
  paginaActual = 1;
  mostrarTablaPaginada(datosPorHoja[hojaActual]);

  // 🔥 MOSTRAR BOTONES
  document.getElementById("paginacion").style.display = "block";
}

// =====================
// AGREGAR DATO
// =====================
function agregarDato() {

  for (let hoja in headersPorHoja) {

    if (hoja === HOJA_OCULTA) continue;

    let nuevo = {};

    headersPorHoja[hoja].forEach(h => {

      let nombre = h.toLowerCase();

      // 🔥 ORDEN AUTOMÁTICO
      if (esCampoOrden(nombre)) {
        nuevo[h] = contadorOrden;
        return;
      }

      let input = camposCompartidos[h]
        ? document.getElementById(`global_${h}`)
        : document.getElementById(`${hoja}_${h}`);

      let valor = input?.value || "";

      if (h.toLowerCase().includes("matrimonio")) {
        valor = normalizarTipoMatrimonio(valor);
      }

      nuevo[h] = valor;

      if (!camposCompartidos[h] && input) {
        input.value = "";
      }
    });

    datosPorHoja[hoja].push(nuevo);
  }

  for (let h in camposCompartidos) {
    let input = document.getElementById(`global_${h}`);
    if (input) input.value = "";
  }

  contadorOrden++;
  localStorage.setItem("contadorOrden", contadorOrden);
  localStorage.setItem("datosExcel", JSON.stringify(datosPorHoja));

  mostrarTablaPaginada(datosPorHoja[hojaActual]);
}
// =====================
// ABRIR MODAL
// =====================
function abrirModalColumnas() {

  const contenedor = document.getElementById("listaColumnas");
  contenedor.innerHTML = "";

  const headers = headersPorHoja[hojaActual];

  headers.forEach(h => {
    contenedor.innerHTML += `
      <div class="col-md-4">
        <div class="form-check">
          <input class="form-check-input columnaCheck" type="checkbox" value="${h}" checked>
          <label class="form-check-label">${h}</label>
        </div>
      </div>
    `;
  });

  const modal = new bootstrap.Modal(document.getElementById('modalColumnas'));
  modal.show();
}

// =====================
// SELECCIONAR / DESELECCIONAR
// =====================
function seleccionarTodo(valor) {
  document.querySelectorAll(".columnaCheck").forEach(c => c.checked = valor);
}

function generarDashboard() {

  const contenedor = document.getElementById("dashboardMatrimonio");
  contenedor.innerHTML = "";

  let filtroMes = document.getElementById("filtroMesDashboard").value;

  // 🔥 VALIDACIÓN OBLIGATORIA
  if (!filtroMes) {
    contenedor.innerHTML = `
      <div class="alert alert-danger text-center">
        ⚠️ Debe seleccionar un mes antes de generar el dashboard
      </div>
    `;
    return;
  }

  

  let data = datosPorHoja[hojaActual];
  if (!data || data.length === 0) return;

  const headers = headersPorHoja[hojaActual];

  let campoTipo = headers.find(h =>
    h.toLowerCase().replace(/\s+/g, "").includes("matrimonio")
  );

  let campoFecha = headers.find(h =>
    h.toLowerCase().includes("fecha")
  );

  if (!campoTipo) {
    contenedor.innerHTML = "<p>Seleccione una fecha por favor</p>";
    return;
  }

 

  let conteo = {};
  let totalMatrimonios = 0;

  data.forEach(row => {

    let pasaFiltroMes = true;

    // ======================
    // 🔥 FILTRO POR MES
    // ======================
    if (filtroMes && campoFecha) {
      let fecha = row[campoFecha];

      if (!fecha) return;

      if (typeof fecha === "string" && fecha.includes("/")) {
        let partes = fecha.split("/");
        let formato = `${partes[2]}-${partes[1]}`; // yyyy-mm

        if (formato !== filtroMes) {
          pasaFiltroMes = false;
        }
      } else {
        let f = new Date(fecha);
        if (isNaN(f)) return;

        let formato = `${f.getFullYear()}-${(f.getMonth() + 1).toString().padStart(2, "0")}`;

        if (formato !== filtroMes) {
          pasaFiltroMes = false;
        }
      }
    }

    if (!pasaFiltroMes) return;

    // ======================
    // 🔥 CONTAR TOTAL (YA FILTRADO POR MES)
    // ======================
    totalMatrimonios++;

    // ======================
    // 🔥 CONTAR POR TIPO
    // ======================
    let tipo = normalizarTipoMatrimonio(row[campoTipo]);
    if (!tipo) return;

    if (!conteo[tipo]) conteo[tipo] = 0;
    conteo[tipo]++;
  });

  // ======================
  // 🔥 TARJETA TOTAL (POR MES)
  // ======================
  contenedor.innerHTML += `
    <div class="col-md-3">
      <div class="card text-center shadow"
           style="background:black; color:white;">
        <div class="card-body">
          <h3>${totalMatrimonios}</h3>
          <p> Matrimonios ${filtroMes ? `` : ""}</p>
        </div>
      </div>
    </div>
  `;

  // ======================
  // 🔥 TARJETAS POR TIPO
  // ======================
  Object.keys(conteo).forEach((tipo, i) => {

    let color = COLORES_GRAFICOS[i % COLORES_GRAFICOS.length];

    contenedor.innerHTML += `
      <div class="col-md-3">
        <div class="card text-center shadow"
             style="cursor:pointer; background:${color}; color:white;"
             onclick="filtrarPorTipo('${tipo}')">
          <div class="card-body">
            <h3>${conteo[tipo]}</h3>
            <p> ${tipo}</p>
          </div>
        </div>
      </div>
    `;
  });

  // ======================
  // 📊 DATOS PARA GRÁFICOS
  // ======================
  let labels = Object.keys(conteo);
  let valores = Object.values(conteo);

  // 🔥 DESTRUIR GRÁFICOS ANTERIORES
  if (window.graficoBarra) window.graficoBarra.destroy();
  if (window.graficoPie) window.graficoPie.destroy();

  // ======================
  // 📊 GRÁFICO DE BARRAS
  // ======================
  const ctxBarra = document.getElementById("graficoBarras");

  window.graficoBarra = new Chart(ctxBarra, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [{
        label: "Matrimonios",
        data: valores,
        backgroundColor: COLORES_GRAFICOS
      }]
    },
    options: {
      responsive: true
    }
  });

  // ======================
  // 🥧 GRÁFICO DE TORTA
  // ======================
  const ctxPie = document.getElementById("graficoTorta");

  window.graficoPie = new Chart(ctxPie, {
    type: "pie",
    data: {
      labels: labels,
      datasets: [{
        data: valores,
        backgroundColor: COLORES_GRAFICOS
      }]
    },
    options: {
      responsive: true
    }
  });
};
function filtrarPorTipo(tipo) {

  let data = datosPorHoja[hojaActual];

  const headers = headersPorHoja[hojaActual];

  let campoTipo = headers.find(h =>
    h.toLowerCase().replace(/\s+/g, "").includes("matrimonio")
  );

  let filtrado = data.filter(row => {
    let valor = (row[campoTipo] || "").toString().trim().toUpperCase();
    return valor === tipo;
  });


  paginaActual = 1;
  mostrarTablaPaginada(filtrado);
}