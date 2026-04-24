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
      if (hoja === HOJA_OCULTA) return;

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

          if (typeof valor === "number" && valor > 30000 && valor < 60000) {
            row[key] = soloFecha(valor);
          } else if (key.toLowerCase().includes("fecha")) {
            row[key] = soloFecha(valor);
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
      if (nombre.includes("fecha")) tipo = "date";

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
  paginaActual++;
  mostrarTablaPaginada(datosPorHoja[hojaActual]);
}

function anteriorPagina() {
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

  paginaActual = 1;
  mostrarTablaPaginada(filtrado);
}

// =====================
// LIMPIAR
// =====================
function limpiarFiltros() {
  document.getElementById("filtroNombre").value = "";
  document.getElementById("filtroFechaDesde").value = "";
  document.getElementById("filtroFechaHasta").value = "";

  mostrarTablaPaginada(datosPorHoja[hojaActual]);
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

      nuevo[h] = input?.value || "";

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

