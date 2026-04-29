const COLORES_GRAFICOS = [
  "#0d6efd", "#198754", "#ffc107", "#dc3545",
  "#6f42c1", "#20c997", "#fd7e14", "#0dcaf0"
];

let filtroGlobal = {
  nombre: "",
  desde: "",
  hasta: "",
  tipoMatrimonio: ""
};
let dataFiltrada = [];
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


window.onload = async function () {

  await cargarDesdeSheets();

  cargarSelector();
  generarFormulario();
  activarFiltrosEnTiempoReal();
  cargarTiposMatrimonio();

  hojaActual = Object.keys(datosPorHoja)[0];
  mostrarTodasLasTablas();
};
// =====================
// DETECTAR CAMPO ORDEN
// =====================
function esCampoOrden(nombre) {
  if (!nombre) return false;

  nombre = nombre.toLowerCase().trim();

  // 🔥 SOLO CAMPOS EXACTOS
  return (
    nombre === "n°" ||
    nombre === "nº" ||
    nombre === "no" ||
    nombre === "numero" ||
    nombre === "orden"
  );
}


function normalizarTipoMatrimonio(valor) {
  if (!valor) return "";

  let v = valor.toString().trim().toLowerCase();

  if (v === "p") return "PAGADO";
  if (v === "m") return "MASIVO";

  return valor.toString().toUpperCase();
}



// =====================
async function cargarDesdeSheets() {

  const hojas = {
    "REPORTE DIARIO": "https://docs.google.com/spreadsheets/d/e/2PACX-1vT4ItOkP5Z2GkjwRQBttEnw8ad9b4rhLEK9BSHl8GQfCwU2h2biYHwhxPSltF6IceFcNrD1YIdCueuZ/pub?gid=498321705&single=true&output=csv",

    "REGISTRO DE ATENCION": "https://docs.google.com/spreadsheets/d/e/2PACX-1vT4ItOkP5Z2GkjwRQBttEnw8ad9b4rhLEK9BSHl8GQfCwU2h2biYHwhxPSltF6IceFcNrD1YIdCueuZ/pub?gid=2003543030&single=true&output=csv",

    "RESULTADOS DE LABORATORIO": "https://docs.google.com/spreadsheets/d/e/2PACX-1vT4ItOkP5Z2GkjwRQBttEnw8ad9b4rhLEK9BSHl8GQfCwU2h2biYHwhxPSltF6IceFcNrD1YIdCueuZ/pub?gid=861222356&single=true&output=csv"
  };

  datosPorHoja = {};
  headersPorHoja = {};

  for (let nombre in hojas) {

    const res = await fetch(hojas[nombre]);
    const texto = await res.text();

    const filas = texto.split("\n").map(f =>
      f.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
    );

    const headers = filas[0].map(h => h.replace(/"/g, "").trim());

    const data = filas.slice(1).map(fila => {
      let obj = {};

      headers.forEach((h, i) => {
        let valor = fila[i] || "";
        valor = valor.replace(/"/g, "").trim();

        if (
          h.toLowerCase().includes("fecha") ||
          h.toLowerCase().includes("f.")
        ) {
          valor = soloFecha(valor);
        }

        obj[h] = valor;
      });

      return obj;
    })

      // 🔥 ELIMINAR FILAS VACÍAS (solo tienen N° o todo vacío)
      .filter(row => {
        let valores = Object.values(row);

        // contar campos con datos reales
        let llenos = valores.filter(v => v && v.toString().trim() !== "");

        // 🔥 mínimo 2 campos (ej: N° + nombre)
        return llenos.length > 1;
      });

    // 🔥 AGREGAR N° SI NO EXISTE EN LOS DATOS
    data.forEach((row, index) => {
      let campoOrden = headers.find(h => esCampoOrden(h));

      if (campoOrden && (!row[campoOrden] || row[campoOrden] === "")) {
        row[campoOrden] = index + 1;
      }
    });

    datosPorHoja[nombre] = data;
    headersPorHoja[nombre] = headers;
  }
  setTimeout(() => {
    cargarTiposMatrimonio();
  }, 500);

  hojaActual = Object.keys(datosPorHoja)[0];

  mostrarTodasLasTablas();
  cargarSelector();
  generarFormulario();
  cargarTiposMatrimonio();

  console.log("🔥 TODAS LAS HOJAS CARGADAS:", datosPorHoja);
  // 🔥 ASEGURAR QUE EXISTA N° EN TODAS LAS HOJAS
  


}

function mostrarTodasLasTablas() {

  const contenedor = document.getElementById("contenedorTabla");
  contenedor.innerHTML = "";

  for (let hoja in datosPorHoja) {

    let data = datosPorHoja[hoja];

    // 🔥 APLICAR FILTROS
    let dataFiltradaLocal = modoFiltrado
      ? aplicarFiltroAData(data)
      : data;
    console.log("👉 DATA FINAL:", datosPorHoja);
    console.log("👉 HEADERS:", headersPorHoja);

    // 🔥 SI NO HAY RESULTADOS → NO MOSTRAR SECCIÓN
    if (!dataFiltradaLocal || dataFiltradaLocal.length === 0) continue;

    let headers = headersPorHoja[hoja];

    // ============================
    // 🔥 DETECTAR COLUMNAS CON DATOS
    // ============================
    let headersVisibles = headers.filter(h => {
      return dataFiltradaLocal.some(row => {
        let valor = row[h];
        return valor !== null && valor !== undefined && valor.toString().trim() !== "";
      });
    });

    let html = `
      <div class="mb-5">
    <h3 class="bg-dark text-white p-2 rounded">
      ${hoja}
    </h3>

    <div class="scroll-superior">
      <div class="scroll-bar"></div>
    </div>

    <div class="tabla-scroll">
      <table class="table table-bordered table-striped">
            <thead class="table-dark">
              <tr>
                ${headersVisibles.map(h => `<th>${h}</th>`).join("")}
              </tr>
            </thead>
            <tbody>
    `;

    dataFiltradaLocal.forEach(row => {
      html += "<tr>";

      headersVisibles.forEach(h => {
        let valor = row[h] ?? "";

        // 🔥 FORZAR FORMATO DE FECHA AL MOSTRAR
        if (
          h.toLowerCase().includes("fecha") ||
          h.toLowerCase().includes("f.")
        ) {
          valor = soloFecha(valor);
        }

        // 🔥 NORMALIZAR MATRIMONIO
        if (h.toLowerCase().includes("matrimonio")) {
          valor = normalizarTipoMatrimonio(valor);
        }

        html += `<td>${(valor || "").toString().toUpperCase()}</td>`;
      });

      html += "</tr>";
    });

    html += `
            </tbody>
          </table>
        </div>
      </div>
    `;

    contenedor.innerHTML += html;
  }

  document.getElementById("contenedorTabla").style.display = "block";

  setTimeout(() => {
    activarScrollSuperior();
  }, 100);
}

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
      headers = headers.filter(h => h && h.trim() !== "");

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

  // 🔥 SI ES STRING CON "/"
  if (typeof valor === "string" && valor.includes("/")) {
    let partes = valor.split("/");

    if (partes.length === 3) {
      let p1 = parseInt(partes[0]); // posible mes
      let p2 = parseInt(partes[1]); // posible día
      let anio = partes[2];

      // 🔥 SI EL PRIMER NÚMERO ES <= 12 → probablemente es MM/DD/YYYY
      if (p1 <= 12 && p2 <= 31) {
        return `${p2.toString().padStart(2, "0")}/${p1.toString().padStart(2, "0")}/${anio}`;
      }

      // 🔥 SI NO → YA ESTÁ EN DD/MM/YYYY
      return `${p1.toString().padStart(2, "0")}/${p2.toString().padStart(2, "0")}/${anio}`;
    }
  }

  let fecha;

  // 🔥 FECHA NUMÉRICA (EXCEL)
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

      let nombre = h.toLowerCase().trim();

      // 🔥 OCULTAR N° SIEMPRE
      if (esCampoOrden(nombre)) return;

      // 🔥 🔥 OCULTAR NOMBRE EN OTRAS SECCIONES
      if (
        (nombre.includes("nombre") || nombre.includes("apellidos")) &&
        hoja !== "REPORTE DIARIO"
      ) {
        return;
      }

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

        // 🔥 SOLO CREAR UNA VEZ
        if (!inputsCreados[h]) {

          let requerido = ""; // 🔥 TODO opcional
          contenedor.innerHTML += `
      <div class="col-md-4">
        <label>${h} (global)</label>
        <input type="${tipo}" id="global_${h}" class="form-control" ${requerido}>
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

  document.querySelectorAll("#formularioDinamico input").forEach(input => {
    input.addEventListener("input", function () {
      this.value = this.value.toUpperCase();
    });
  });
}

// =====================
// SELECTOR
// =====================
function cargarSelector() {
  const selector = document.getElementById("selectorHoja");
  selector.innerHTML = "";

  // 🔥 OPCIÓN GENERAL
  selector.innerHTML += `<option value="">Todas las secciones</option>`;

  const hojas = Object.keys(datosPorHoja);
  hojas.forEach(h => {
    if (h === HOJA_OCULTA) return;
    selector.innerHTML += `<option value="${h}">${h}</option>`;
  });

  selector.onchange = () => {

    hojaActual = selector.value;

    paginaActual = 1;
    modoFiltrado = false;

    filtroGlobal = {
      nombre: "",
      desde: "",
      hasta: "",
      tipoMatrimonio: ""
    };

    document.getElementById("filtroNombre").value = "";
    document.getElementById("filtroFechaDesde").value = "";
    document.getElementById("filtroFechaHasta").value = "";
    document.getElementById("filtroTipoMatrimonio").value = "";

    // 🔥 SI NO HAY SECCIÓN SELECCIONADA → MOSTRAR TODO
    if (!hojaActual) {
      mostrarTodasLasTablas();
      return;
    }

    // 🔥 SI HAY SECCIÓN → SOLO ESA
    mostrarSoloHoja(hojaActual);
  };
}

function cargarTiposMatrimonio() {

  const select = document.getElementById("filtroTipoMatrimonio");

  if (!select) return;

  select.innerHTML = `<option value="">Tipo de matrimonio</option>`;

  let valores = new Set();

  for (let hoja in datosPorHoja) {

    let data = datosPorHoja[hoja];
    let headers = headersPorHoja[hoja];

    if (!data || !headers) continue;

    let campo = headers.find(h =>
      h.toLowerCase().replace(/\s+/g, "").includes("matrimonio")
    );

    if (!campo) continue;

    data.forEach(row => {
      let valor = normalizarTipoMatrimonio(row[campo]);
      if (valor) valores.add(valor);
    });
  }

  if (valores.size === 0) {
    select.innerHTML += `<option disabled>No hay datos</option>`;
    return;
  }

  [...valores].sort().forEach(v => {
    select.innerHTML += `<option value="${v}">${v}</option>`;
  });
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

        filas += `<td>${(valor || "").toString().toUpperCase()}</td>`;
      }

    });

    filas += "</tr>";
  });

  tbody.innerHTML = filas;


  setTimeout(() => {
    activarScrollSuperior();
  }, 100);
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
  document.getElementById("paginacion").style.display = "block";

  hojaActual = document.getElementById("selectorHoja").value;

  paginaActual = 1;

  mostrarTablaPaginada(datosPorHoja[hojaActual]);

  setTimeout(() => {
    activarScrollSuperior();
  }, 100);
}

function aplicarFiltroAData(data) {

  let nombre = filtroGlobal.nombre;
  let desde = filtroGlobal.desde;
  let hasta = filtroGlobal.hasta;
  let tipoMatrimonio = filtroGlobal.tipoMatrimonio;

  return data.filter(row => {

    // 🔥 FILTRO NOMBRE
    if (nombre) {
      let encontrado = Object.values(row).some(valor =>
        valor &&
        valor.toString().toLowerCase().includes(nombre)
      );
      if (!encontrado) return false;
    }

    // 🔥 FILTRO TIPO MATRIMONIO
    if (tipoMatrimonio) {
      const campoTipo = Object.keys(row).find(k =>
        k.toLowerCase().replace(/\s+/g, "").includes("matrimonio")
      );

      let valor = campoTipo ? normalizarTipoMatrimonio(row[campoTipo]) : "";
      if (valor !== tipoMatrimonio.toUpperCase()) return false;
    }

    // 🔥 FILTRO FECHA
    const campoFecha = Object.keys(row).find(k =>
      k.toLowerCase().includes("fecha")
    );

    if ((desde || hasta) && campoFecha) {

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
}
// =====================
// FILTROS
// =====================
function aplicarFiltros() {

  modoFiltrado = true;

  filtroGlobal.nombre = document.getElementById("filtroNombre").value.toLowerCase();
  filtroGlobal.desde = document.getElementById("filtroFechaDesde").value;
  filtroGlobal.hasta = document.getElementById("filtroFechaHasta").value;
  filtroGlobal.tipoMatrimonio = document.getElementById("filtroTipoMatrimonio").value;

  document.getElementById("contenedorTabla").style.display = "block";

  // 🔥 MOSTRAR TODAS LAS SECCIONES FILTRADAS
  mostrarTodasLasTablas();

  // 🔥 OCULTAR PAGINACIÓN
  document.getElementById("paginacion").style.display = "none";
}

// =====================
// LIMPIAR
// =====================
function limpiarFiltros() {

  modoFiltrado = false;

  filtroGlobal = {
    nombre: "",
    desde: "",
    hasta: "",
    tipoMatrimonio: ""
  };

  document.getElementById("filtroNombre").value = "";
  document.getElementById("filtroFechaDesde").value = "";
  document.getElementById("filtroFechaHasta").value = "";
  document.getElementById("filtroTipoMatrimonio").value = "";

  // 🔥 VOLVER A MOSTRAR TODO
  mostrarTodasLasTablas();

  document.getElementById("paginacion").style.display = "block";
}

function mostrarTablaPaginadaGlobal() {

  let data = datosPorHoja[hojaActual];

  data = aplicarFiltroAData(data);

  const inicio = (paginaActual - 1) * filasPorPagina;
  const fin = inicio + filasPorPagina;

  mostrarTabla(data.slice(inicio, fin));
}

// =====================
// AGREGAR DATO
// =====================
async function agregarDato() {

  let nombreGlobal = "";
  let apellidoGlobal = "";

  document.querySelectorAll("#formularioDinamico input").forEach(input => {
    let id = input.id.toLowerCase();

    if (id.includes("nombre")) {
      nombreGlobal = input.value;
    }

    if (id.includes("apellido")) {
      apellidoGlobal = input.value;
    }
  });

  for (let hoja in headersPorHoja) {

    let nuevo = {};

    headersPorHoja[hoja].forEach(h => {

      if (esCampoOrden(h)) {
        let ultimo = datosPorHoja[hoja].length;
        nuevo[h] = ultimo + 1;
        return;
      }

      let nombreCampo = h.toLowerCase();
      let valor = "";

      if (nombreCampo.includes("nombre")) {
        valor = nombreGlobal;
      } else if (nombreCampo.includes("apellido")) {
        valor = apellidoGlobal;
      } else {
        let input = camposCompartidos[h]
          ? document.getElementById(`global_${h}`)
          : document.getElementById(`${hoja}_${h}`);

        valor = (input?.value || "").toUpperCase();
      }

      if (nombreCampo.includes("matrimonio")) {
        valor = normalizarTipoMatrimonio(valor);
      }

      nuevo[h] = valor;
    });

    // 👉 Guardar en memoria
    datosPorHoja[hoja].push(nuevo);

    // 👉 Guardar en Firebase por hoja
    
  }

  document.querySelectorAll("#formularioDinamico input").forEach(i => i.value = "");

  mostrarTodasLasTablas();
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

  if (!filtroMes) {
    contenedor.innerHTML = `
      <div class="alert alert-danger text-center">
        ⚠️ Debe seleccionar un mes antes de generar el dashboard
      </div>
    `;
    return;
  }

  let data = [];

  // 🔥 SIEMPRE USAR TODAS LAS HOJAS
  for (let hoja in datosPorHoja) {
    data = data.concat(datosPorHoja[hoja]);
  }

  if (!data || data.length === 0) return;

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

    let formato = `${f.getFullYear()}-${(f.getMonth() + 1).toString().padStart(2, "0")}`;

    if (formato !== filtroMes) return;

    // ✅ CONTAR
    totalMatrimonios++;

    let tipo = normalizarTipoMatrimonio(row[campoTipo]);
    if (!tipo) return;

    if (!conteo[tipo]) conteo[tipo] = 0;
    conteo[tipo]++;
  });

  // 🔥 TARJETA TOTAL
  contenedor.innerHTML += `
    <div class="col-md-3">
      <div class="card text-center shadow" style="background:black; color:white;">
        <div class="card-body">
          <h3>${totalMatrimonios}</h3>
          <p>Matrimonios</p>
        </div>
      </div>
    </div>
  `;

  // 🔥 TARJETAS POR TIPO
  Object.keys(conteo).forEach((tipo, i) => {

    let color = COLORES_GRAFICOS[i % COLORES_GRAFICOS.length];

    contenedor.innerHTML += `
      <div class="col-md-3">
        <div class="card text-center shadow"
             style="cursor:pointer; background:${color}; color:white;"
             onclick="filtrarPorTipo('${tipo}')">
          <div class="card-body">
            <h3>${conteo[tipo]}</h3>
            <p>${tipo}</p>
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

  if (ctxBarra) {
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
  }

  // ======================
  // 🥧 GRÁFICO DE TORTA
  // ======================
  const ctxPie = document.getElementById("graficoTorta");

  if (ctxPie) {
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
  }
}
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



function mostrarSoloHoja(hoja) {

  const contenedor = document.getElementById("contenedorTabla");
  contenedor.innerHTML = "";

  let data = modoFiltrado
    ? aplicarFiltroAData(datosPorHoja[hoja])
    : datosPorHoja[hoja];

  if (!data) return;

  let headers = headersPorHoja[hoja];

  // 🔥 FILTRAR COLUMNAS VACÍAS (igual que en todas)
  let headersVisibles = headers.filter(h => {
    return data.some(row => {
      let valor = row[h];
      return valor !== null && valor !== undefined && valor.toString().trim() !== "";
    });
  });

  let html = `
    <div class="mb-5">
      <h3 class="bg-dark text-white p-2 rounded">${hoja}</h3>

      <!-- 🔥 SCROLL SUPERIOR (AQUÍ ESTABA EL ERROR) -->
      <div class="scroll-superior">
        <div class="scroll-bar"></div>
      </div>

      <div class="tabla-scroll">
        <table class="table table-bordered table-striped">
          <thead class="table-dark">
            <tr>
              ${headersVisibles.map(h => `<th>${h}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
  `;

  data.forEach(row => {
    html += "<tr>";

    headersVisibles.forEach(h => {
      let valor = row[h] ?? "";

      // 🔥 FORZAR FORMATO DE FECHA
      if (
        h.toLowerCase().includes("fecha") ||
        h.toLowerCase().includes("f.")
      ) {
        valor = soloFecha(valor);
      }

      if (h.toLowerCase().includes("matrimonio")) {
        valor = normalizarTipoMatrimonio(valor);
      }

      html += `<td>${(valor || "").toString().toUpperCase()}</td>`;
    });

    html += "</tr>";
  });

  html += `
          </tbody>
        </table>
      </div>
    </div>
  `;

  contenedor.innerHTML = html;
  contenedor.style.display = "block";

  setTimeout(() => {
    activarScrollSuperior();
  }, 100);
}
function detectarCamposCompartidos() {
  camposCompartidos = {};

  let contador = {};

  for (let hoja in headersPorHoja) {
    headersPorHoja[hoja].forEach(h => {
      contador[h] = (contador[h] || 0) + 1;
    });
  }

  for (let campo in contador) {
    if (contador[campo] > 1) {
      camposCompartidos[campo] = true;
    }
  }

  // 🔥 FORZAR NOMBRE COMO GLOBAL
  Object.keys(contador).forEach(campo => {
    let n = campo.toLowerCase();
    if (n.includes("nombre") || n.includes("apellidos")) {
      camposCompartidos[campo] = true;
    }
  });
}

