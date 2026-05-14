const COLORES_GRAFICOS = [
  "#0d6efd", "#198754", "#ffc107", "#dc3545",
  "#6f42c1", "#20c997", "#fd7e14", "#0dcaf0"
];
const COLECCIONES = {
  "REPORTE DIARIO": "reporte_diario",
  "REGISTRO DE ATENCION": "registro_atencion",
  "RESULTADOS DE LABORATORIO": "resultados_laboratorio"
};
let indexSeleccionado = null;
let filaSeleccionada = null;
let hojaSeleccionada = null;
let registroSeleccionado = null;

let filtroGlobal = {
  nombre: "",
  dni: "",
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
let camposCompartidos = {};
let contadorOrden = 1;

let paginaActual = 1;
const filasPorPagina = 50;
const HOJA_OCULTA = "tipo de matrimonio";

function obtenerSiguienteOrden(hoja, campoOrden) {

  let max = 0;

  datosPorHoja[hoja].forEach(r => {
    let val = Number(r[campoOrden]);
    if (!isNaN(val) && val > max) {
      max = val;
    }
  });

  return max + 1;
}

function obtenerCampoOrden(headers) {
  return headers.find(h =>
    h.toLowerCase().includes("n°") ||
    h.toLowerCase().includes("nº") ||
    h.toLowerCase().includes("numero") ||
    h.toLowerCase().includes("orden")
  );
}

function seleccionarFila(tr, hoja, index) {

  document.querySelectorAll(".fila-seleccionada").forEach(f => {
    f.classList.remove("fila-seleccionada");
  });

  tr.classList.add("fila-seleccionada");

  filaSeleccionada = tr;
  hojaSeleccionada = hoja;
  indexSeleccionado = index; // 🔥 ESTA LÍNEA FALTABA

  registroSeleccionado = datosPorHoja[hoja][index];
}

// 🔥 NUEVA FUNCIÓN: renumera localmente y actualiza Firebase
async function renumerarHoja(hoja) {
  const campoOrden = headersPorHoja[hoja]?.find(h => esCampoOrden(h));
  if (!campoOrden) return;

  // Ordenar por el número actual antes de renumerar
  datosPorHoja[hoja].sort((a, b) =>
    Number(a[campoOrden] || 0) - Number(b[campoOrden] || 0)
  );

  let promesas = [];

  datosPorHoja[hoja].forEach((row, i) => {
    const nuevoNumero = i + 1;
    const numeroActual = Number(row[campoOrden]);

    // Solo actualizar si el número cambió
    if (numeroActual !== nuevoNumero) {
      row[campoOrden] = nuevoNumero; // actualizar local

      // Actualizar en Firebase si tiene _id
      if (row._id) {
        const claveFirebase = limpiarClave(campoOrden);
        const promesa = fb.updateDoc(
          fb.doc(db, COLECCIONES[hoja], row._id),
          { [claveFirebase]: nuevoNumero }
        );
        promesas.push(promesa);
      }
    }
  });

  if (promesas.length > 0) {
    await Promise.all(promesas);
    console.log(`✅ Renumerados ${promesas.length} registros en "${hoja}"`);
  }
}

// 🔥 FUNCIÓN CORREGIDA: eliminarFila con renumeración
async function eliminarFila() {

  if (!registroSeleccionado) {
    mostrarToast("Selecciona una fila primero ⚠️", "error");
    return;
  }

  if (!confirm("¿Seguro que deseas eliminar?")) return;

  try {

    if (registroSeleccionado._id) {
      await fb.deleteDoc(
        fb.doc(db, COLECCIONES[hojaSeleccionada], registroSeleccionado._id)
      );
    }

    datosPorHoja[hojaSeleccionada] =
      datosPorHoja[hojaSeleccionada].filter(
        r => r._id !== registroSeleccionado._id
      );

    // 🔥 RENUMERAR todas las hojas después de eliminar
    mostrarToast("Renumerando registros...", "success");
    for (let hoja in datosPorHoja) {
      await renumerarHoja(hoja);
    }

    mostrarToast("Eliminado y renumerado correctamente ✅");

    const hojaAntes = hojaSeleccionada;

    filaSeleccionada = null;
    indexSeleccionado = null;
    registroSeleccionado = null;
    hojaSeleccionada = null;

    if (hojaAntes) {
      mostrarSoloHoja(hojaAntes);
    } else {
      mostrarTodasLasTablas();
    }

  } catch (e) {
    console.error(e);
    mostrarToast("Error al eliminar ❌", "error");
  }
}
function editarFila() {

  if (indexSeleccionado === null || !filaSeleccionada) {
    mostrarToast("Selecciona una fila primero ⚠️", "error");
    return;
  }

  let celdas = filaSeleccionada.querySelectorAll("td");

  celdas.forEach(td => {
    let texto = td.innerText.trim();
    td.style.padding = "2px";
    td.style.verticalAlign = "middle";
    td.innerHTML = `
      <input 
        type="text" 
        value="${texto}" 
        class="form-control form-control-sm"
        oniput="this.value = this.value.toUpperCase()"
        style="
          border-radius: 0 !important;
          min-width: 80px;
          width: 100%;
          box-sizing: border-box;
          margin: 0;
          padding: 3px 6px;
          height: auto;
        "
      >
    `;
  });

  mostrarToast("Editando en tabla ✏️");
}

// 🔥 función para limpiar claves inválidas para Firebase
function limpiarClave(clave) {
  return clave
    .replace(/\//g, "_")   // / → _
    .replace(/~/g, "_")    // ~ → _
    .replace(/\*/g, "_")   // * → _
    .replace(/\[/g, "_")   // [ → _
    .replace(/\]/g, "_");  // ] → _
}

async function guardarEdicion() {

  if (!registroSeleccionado || !filaSeleccionada) {
    mostrarToast("Selecciona una fila primero ⚠️", "error");
    return;
  }

  try {

    let todosLosHeaders = headersPorHoja[hojaSeleccionada];

    let headersVisibles = todosLosHeaders.filter(h => {
      return datosPorHoja[hojaSeleccionada].some(row => {
        let valor = row[h];
        return valor !== null && valor !== undefined && valor.toString().trim() !== "";
      });
    });

    let celdas = filaSeleccionada.querySelectorAll("td");

    let actualizado = {};
    let actualizadoFirebase = {}; // 🔥 claves limpias para Firebase

    celdas.forEach((td, i) => {
      let input = td.querySelector("input");
      if (!input) return;

      let h = headersVisibles[i];
      if (!h) return;

      let valor = input.value.toUpperCase();

      if (h.toLowerCase().includes("matrimonio")) {
        valor = normalizarTipoMatrimonio(valor);
      }

      actualizado[h] = valor; // clave original para local
      actualizadoFirebase[limpiarClave(h)] = valor; // 🔥 clave limpia para Firebase
    });

    // 🔥 actualizar en Firebase con claves saneadas
    if (registroSeleccionado._id) {
      await fb.updateDoc(
        fb.doc(db, COLECCIONES[hojaSeleccionada], registroSeleccionado._id),
        actualizadoFirebase
      );
    }

    // 🔥 actualizar local con claves originales
    datosPorHoja[hojaSeleccionada] =
      datosPorHoja[hojaSeleccionada].map(r => {
        if (registroSeleccionado._id) {
          return r._id === registroSeleccionado._id ? { ...r, ...actualizado } : r;
        } else {
          return r === registroSeleccionado ? { ...r, ...actualizado } : r;
        }
      });

    mostrarToast("Actualizado correctamente ✅");

    const hojaAntes = hojaSeleccionada;

    filaSeleccionada = null;
    indexSeleccionado = null;
    registroSeleccionado = null;
    hojaSeleccionada = null;

    if (hojaAntes) {
      mostrarSoloHoja(hojaAntes);
    } else {
      mostrarTodasLasTablas();
    }

  } catch (error) {
    console.error("❌ Error completo:", error);
    mostrarToast("Error al actualizar: " + error.message + " ❌", "error");
  }
}

window.onload = async function () {

  // 🔥 Mostrar formulario inmediatamente sin esperar la carga
  mostrarSeccion('formulario');

  // 🔥 Mostrar indicador de carga en el formulario
  const contenedorForm = document.getElementById("formularioDinamico");
  contenedorForm.innerHTML = `
    <div class="col-12 text-center py-4">
      <div class="spinner-border text-primary" role="status"></div>
      <p class="mt-2 text-muted">Cargando datos...</p>
    </div>
  `;

  await cargarDesdeSheets();
  await cargarDesdeFirebase();

  cargarSelector();
  generarFormulario();      // 🔥 esto reemplaza el spinner con el form real
  cargarTiposMatrimonio();

  hojaActual = Object.keys(datosPorHoja)[0];
  mostrarTodasLasTablas();

  // 🔥 activar drag
  const botones = document.querySelector(".botones-flotantes");
  if (botones) {
    botones.style.cursor = "grab";
    hacerArrastrable(botones);
  }
};

function esCampoOrden(nombre) {
  if (!nombre) return false;

  nombre = nombre.toLowerCase().trim();

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

      .filter(row => {
        let valores = Object.values(row);
        let llenos = valores.filter(v => v && v.toString().trim() !== "");

        return llenos.length > 1;
      });

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
}

function mostrarTodasLasTablas() {

  const contenedor = document.getElementById("contenedorTabla");
  contenedor.innerHTML = "";

  for (let hoja in datosPorHoja) {

    let data = datosPorHoja[hoja];

    let dataFiltradaLocal = modoFiltrado ? aplicarFiltroAData(data, hoja) : data;

    // 🔥 ordenar según si tiene campo de orden numérico o no
    const campoOrden = headersPorHoja[hoja].find(h =>
      h.toLowerCase().includes("n°") ||
      h.toLowerCase().includes("nº") ||
      h.toLowerCase().includes("numero") ||
      h.toLowerCase().includes("orden")
    );

    if (campoOrden) {
      // tiene campo numérico → ordenar por él
      dataFiltradaLocal = [...dataFiltradaLocal].sort((a, b) => {
        return Number(a[campoOrden] || 0) - Number(b[campoOrden] || 0);
      });
    } else {
      // 🔥 sin campo de orden → respetar _orden de llegada
      dataFiltradaLocal = [...dataFiltradaLocal].sort((a, b) => {
        return (a._orden || 0) - (b._orden || 0);
      });
    }

    if (!dataFiltradaLocal || dataFiltradaLocal.length === 0) continue;

    let headers = headersPorHoja[hoja];

    let headersVisibles = headers.filter(h => {
      return dataFiltradaLocal.some(row => {
        let valor = row[h];
        return valor !== null && valor !== undefined && valor.toString().trim() !== "";
      });
    });

    // En mostrarTodasLasTablas() — reemplaza el bloque let html = `...`
    let html = `
  <div class="mb-5">

    <div class="tabla-header-sticky">
      <h3 class="bg-dark text-white p-2 rounded mb-0">
        ${hoja}
      </h3>
      <div class="scroll-superior">
        <div class="scroll-bar"></div>
      </div>
    </div>

    <div class="tabla-scroll">
      <table class="table table-bordered table-striped">
        <thead class="table-dark">
          <tr>
            ${headersVisibles.map(h => `<th>${h}</th>`).join("")}
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
`;

    dataFiltradaLocal.forEach((row) => {
      let indexReal = datosPorHoja[hoja].findIndex(r => r === row);
      html += `<tr onclick="seleccionarFila(this, '${hoja}', ${indexReal})">`;

      headersVisibles.forEach(h => {
        let valor = row[h] ?? "";

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

      let headers = (XLSX.utils.sheet_to_json(sheet, { header: 1 })[0] || [])
        .map(h => h ? h.toString().trim() : "");

      if (!headers.some(h => esCampoOrden(h))) {
        headers.unshift("N°");
      }

      let jsonData = XLSX.utils.sheet_to_json(sheet, { raw: true });

      headers = headers.filter(h => h && h.trim() !== "");

      jsonData = jsonData.map(row => {
        let nuevo = {};
        headers.forEach(h => {
          nuevo[h] = row[h] ?? "";
        });
        return nuevo;
      });

      if (!headers.some(h => esCampoOrden(h))) {
        headers.unshift("N°");
      }

      headersPorHoja[hoja] = headers;


      jsonData.forEach(row => {
        for (let key in row) {
          let valor = row[key];
          let nombreCampo = key.toLowerCase();

          if (typeof valor === "number" && valor > 30000 && valor < 60000) {
            row[key] = soloFecha(valor);
          } else if (nombreCampo.includes("fecha")) {
            row[key] = soloFecha(valor);
          }
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

function soloFecha(valor) {
  if (!valor) return "";

  let v = valor.toString().trim();

  // 🔥 Si viene con "/" → detectar si es MM/DD/YY (Sheets) o DD/MM/YYYY (peruano)
  if (v.includes("/")) {
    let partes = v.split("/");
    if (partes.length === 3) {
      let p0 = partes[0].trim();
      let p1 = partes[1].trim();
      let p2 = partes[2].trim();

      // Si el año tiene 2 dígitos → completar a 4
      if (p2.length === 2) p2 = "20" + p2;

      let posibleMes = parseInt(p0);
      let posibleDia = parseInt(p1);

      // Si p1 > 12, no puede ser MM → es MM/DD/YYYY de Sheets → convertir a DD/MM/YYYY
      if (posibleMes <= 12 && posibleDia > 12) {
        return `${p1.padStart(2, "0")}/${p0.padStart(2, "0")}/${p2}`;
      }

      // Si ambos ≤ 12, asumir formato peruano DD/MM/YYYY → dejar igual
      return `${p0.padStart(2, "0")}/${p1.padStart(2, "0")}/${p2}`;
    }
  }

  // Si es número serial de Excel
  if (typeof valor === "number") {
    let fecha = new Date((valor - 25569) * 86400 * 1000);
    if (!isNaN(fecha)) {
      return `${fecha.getDate().toString().padStart(2, "0")}/${(fecha.getMonth() + 1).toString().padStart(2, "0")}/${fecha.getFullYear()}`;
    }
  }

  // Si es string tipo YYYY-MM-DD (de input date)
  if (v.includes("-")) {
    let partes = v.split("-");
    if (partes.length === 3 && partes[0].length === 4) {
      return `${partes[2]}/${partes[1]}/${partes[0]}`; // YYYY-MM-DD → DD/MM/YYYY
    }
  }

  return v;
}

// 🔥 Convierte DD/MM/YYYY → YYYY-MM-DD para comparar con input type="date"
function fechaAISO(valor) {
  if (!valor) return "";
  let v = valor.toString().trim();

  // 🔥 Limpiar caracteres raros que vienen del CSV
  v = v.replace(/\r/g, "").replace(/\n/g, "").trim();

  // Formato DD/MM/YYYY o D/M/YYYY
  if (v.includes("/")) {
    let partes = v.split("/");
    if (partes.length === 3) {
      let d = partes[0].trim().padStart(2, "0");
      let m = partes[1].trim().padStart(2, "0");
      let a = partes[2].trim();
      // Si el año tiene solo 2 dígitos
      if (a.length === 2) a = "20" + a;
      let iso = `${a}-${m}-${d}`;
      if (!isNaN(new Date(iso))) return iso;
    }
  }

  // Formato YYYY-MM-DD
  if (v.includes("-")) {
    let partes = v.split("-");
    if (partes.length === 3 && partes[0].trim().length === 4) {
      return v; // ya es YYYY-MM-DD
    }
    // Formato DD-MM-YYYY
    if (partes.length === 3 && partes[2].trim().length === 4) {
      let d = partes[0].trim().padStart(2, "0");
      let m = partes[1].trim().padStart(2, "0");
      let a = partes[2].trim();
      let iso = `${a}-${m}-${d}`;
      if (!isNaN(new Date(iso))) return iso;
    }
  }

  // Intentar parsear directamente como último recurso
  let intento = new Date(v);
  if (!isNaN(intento)) {
    return intento.toISOString().split("T")[0];
  }

  return "";
}

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


      if (esCampoOrden(nombre)) return;


      if (
        (nombre.includes("nombre") || nombre.includes("apellidos")) &&
        hoja !== "REPORTE DIARIO"
      ) {
        return;
      }

      let tipo = "text";


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

          let requerido = "";
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

function cargarSelector() {
  const selector = document.getElementById("selectorHoja");
  selector.innerHTML = "";

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
      dni: "",        // 🔥 faltaba
      desde: "",
      hasta: "",
      tipoMatrimonio: ""
    };

    document.getElementById("filtroNombre").value = "";
    document.getElementById("filtroDni").value = "";  // 🔥 faltaba
    document.getElementById("filtroFechaDesde").value = "";
    document.getElementById("filtroFechaHasta").value = "";
    document.getElementById("filtroTipoMatrimonio").value = "";

    if (!hojaActual) {
      mostrarTodasLasTablas();
      return;
    }
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
        let valorExcel = row[h];

        if (valorExcel !== undefined && valorExcel !== "") {
          filas += `<td>${valorExcel}</td>`;
        } else {
          O
          filas += `<td>${(paginaActual - 1) * filasPorPagina + index + 1}</td>`;
        }

      } else {
        let valor = row[h] ?? "";
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

// 🔥 Primero, función que obtiene los N° de orden filtrados de REPORTE DIARIO
function obtenerOrdenesFiltradasPorFecha() {
  const data = datosPorHoja["REPORTE DIARIO"] || [];
  const headers = headersPorHoja["REPORTE DIARIO"] || [];

  const campoOrden = headers.find(h => esCampoOrden(h));
  const campoFecha = headers.find(k =>
    k.toLowerCase().includes("fecha") || k.toLowerCase().includes("f.")
  );

  const desde = filtroGlobal.desde;
  const hasta = filtroGlobal.hasta;

  const ordenesFiltradas = new Set();

  data.forEach(row => {
    // Filtrar por nombre si aplica
    if (filtroGlobal.nombre) {
      let encontrado = Object.values(row).some(v =>
        v && v.toString().toLowerCase().includes(filtroGlobal.nombre)
      );
      if (!encontrado) return;
    }

    // Filtrar por DNI si aplica
    if (filtroGlobal.dni) {
      const campoDni = Object.keys(row).find(k =>
        k.toLowerCase().replace(/\s+/g, "").includes("dni") ||
        k.toLowerCase().replace(/\s+/g, "").includes("ce")
      );
      let valorDni = campoDni ? (row[campoDni] || "").toString().toLowerCase() : "";
      if (!valorDni.includes(filtroGlobal.dni)) return;
    }

    // Filtrar por tipo matrimonio si aplica
    if (filtroGlobal.tipoMatrimonio) {
      const campoTipo = Object.keys(row).find(k =>
        k.toLowerCase().replace(/\s+/g, "").includes("matrimonio")
      );
      let valor = campoTipo ? normalizarTipoMatrimonio(row[campoTipo]) : "";
      if (valor !== filtroGlobal.tipoMatrimonio.toUpperCase()) return;
    }

    // Filtrar por fecha
    if ((desde || hasta) && campoFecha) {
      let valorFecha = row[campoFecha];
      if (!valorFecha) return;
      let fechaISO = fechaAISO(valorFecha.toString().trim());
      if (!fechaISO) return;
      if (desde && fechaISO < desde) return;
      if (hasta && fechaISO > hasta) return;
    }

    // Si pasó todos los filtros, guardar su N° de orden
    if (campoOrden && row[campoOrden] !== undefined && row[campoOrden] !== "") {
      ordenesFiltradas.add(String(row[campoOrden]).trim());
    }
  });

  return ordenesFiltradas;
}

// 🔥 Reemplaza tu aplicarFiltroAData existente con esta versión
function aplicarFiltroAData(data, hoja) {

  const esReporteDiario = hoja === "REPORTE DIARIO";

  // ── REPORTE DIARIO: filtrar por todos los campos normalmente ──
  if (esReporteDiario) {
    let nombre = filtroGlobal.nombre;
    let dni = filtroGlobal.dni;
    let desde = filtroGlobal.desde;
    let hasta = filtroGlobal.hasta;
    let tipoMatrimonio = filtroGlobal.tipoMatrimonio;

    return data.filter(row => {
      if (nombre) {
        let encontrado = Object.values(row).some(valor =>
          valor && valor.toString().toLowerCase().includes(nombre)
        );
        if (!encontrado) return false;
      }

      if (dni) {
        const campoDni = Object.keys(row).find(k =>
          k.toLowerCase().replace(/\s+/g, "").includes("dni") ||
          k.toLowerCase().replace(/\s+/g, "").includes("ce")
        );
        let valorDni = campoDni ? (row[campoDni] || "").toString().toLowerCase() : "";
        if (!valorDni.includes(dni)) return false;
      }

      if (tipoMatrimonio) {
        const campoTipo = Object.keys(row).find(k =>
          k.toLowerCase().replace(/\s+/g, "").includes("matrimonio")
        );
        let valor = campoTipo ? normalizarTipoMatrimonio(row[campoTipo]) : "";
        if (valor !== tipoMatrimonio.toUpperCase()) return false;
      }

      const campoFecha = Object.keys(row).find(k =>
        k.toLowerCase().includes("fecha")
      );

      if ((desde || hasta) && campoFecha) {
        let valorFecha = row[campoFecha];
        if (!valorFecha) return false;
        let fechaISO = fechaAISO(valorFecha.toString().trim());
        if (!fechaISO) return false;
        if (desde && fechaISO < desde) return false;
        if (hasta && fechaISO > hasta) return false;
      }

      return true;
    });
  }

  // ── OTRAS TABLAS: filtrar por N° de orden que coincida con REPORTE DIARIO ──
  const ordenesFiltradas = obtenerOrdenesFiltradasPorFecha();

  // Si no hay filtros activos de fecha/nombre/dni, mostrar todo
  const hayFiltroActivo =
    filtroGlobal.nombre ||
    filtroGlobal.dni ||
    filtroGlobal.desde ||
    filtroGlobal.hasta ||
    filtroGlobal.tipoMatrimonio;

  if (!hayFiltroActivo) return data;

  const headers = headersPorHoja[hoja] || [];
  const campoOrden = headers.find(h => esCampoOrden(h));

  if (!campoOrden || ordenesFiltradas.size === 0) return [];

  return data.filter(row => {
    const orden = String(row[campoOrden] || "").trim();
    return ordenesFiltradas.has(orden);
  });
}

function aplicarFiltros() {

  modoFiltrado = true;

  filtroGlobal.nombre = document.getElementById("filtroNombre").value.toLowerCase();
  filtroGlobal.dni = document.getElementById("filtroDni").value.toLowerCase(); // 🔥 NUEVO
  filtroGlobal.desde = document.getElementById("filtroFechaDesde").value;
  filtroGlobal.hasta = document.getElementById("filtroFechaHasta").value;
  filtroGlobal.tipoMatrimonio = document.getElementById("filtroTipoMatrimonio").value;

  document.getElementById("contenedorTabla").style.display = "block";
  mostrarTodasLasTablas();

  document.getElementById("paginacion").style.display = "none";
}

function limpiarFiltros() {

  modoFiltrado = false;

  filtroGlobal = {
    nombre: "",
    dni: "",         // 🔥 NUEVO
    desde: "",
    hasta: "",
    tipoMatrimonio: ""
  };

  document.getElementById("filtroNombre").value = "";
  document.getElementById("filtroDni").value = "";  // 🔥 NUEVO
  document.getElementById("filtroFechaDesde").value = "";
  document.getElementById("filtroFechaHasta").value = "";
  document.getElementById("filtroTipoMatrimonio").value = "";

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

async function agregarDato() {

  let nombreGlobal = "";
  let apellidoGlobal = "";

  document.querySelectorAll("#formularioDinamico input").forEach(input => {
    let id = input.id.toLowerCase();

    if (id.includes("nombre")) nombreGlobal = input.value;
    if (id.includes("apellido")) apellidoGlobal = input.value;
  });

  let promesas = [];

  for (let hoja in headersPorHoja) {

    let nuevo = {};

    headersPorHoja[hoja].forEach(h => {

      if (esCampoOrden(h)) {
        nuevo[h] = obtenerSiguienteOrden(hoja, h);
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

    // 🔥 GUARDAR EN FIREBASE
    const promesa = fb.addDoc(
      fb.collection(db, COLECCIONES[hoja]),
      nuevo
    );

    promesas.push(promesa);

    // 🔥 guardar local con _orden de llegada
    const _ordenNuevo = datosPorHoja[hoja].length;
    datosPorHoja[hoja].push({ ...nuevo, _orden: _ordenNuevo });

    // 🔥 solo ordenar si tiene campo numérico de orden
    const campoOrden = headersPorHoja[hoja]?.find(h => esCampoOrden(h));
    if (campoOrden) {
      datosPorHoja[hoja].sort((a, b) => {
        return Number(a[campoOrden] || 0) - Number(b[campoOrden] || 0);
      });
    }
    // si NO tiene campoOrden → queda en orden de llegada ✅
  }

  try {
    await Promise.all(promesas);
    console.log("✅ Todo guardado en Firebase");
    mostrarToast("Datos guardados correctamente ✅", "success");
  } catch (error) {
    console.error("❌ ERROR:", error);
    mostrarToast("Error: " + error.message, "error");
  }

  // limpiar inputs
  document.querySelectorAll("#formularioDinamico input").forEach(i => i.value = "");

  // refrescar tabla
  mostrarTodasLasTablas();
}
// 🔥 Estado persistente de columnas seleccionadas por hoja
let columnasSeleccionadas = {}; // { "REPORTE DIARIO": Set(["col1","col2"]), ... }

function abrirModalColumnas() {

  const contenedor = document.getElementById("listaColumnas");
  contenedor.innerHTML = "";

  // Inicializar selecciones si no existen aún
  for (let hoja in datosPorHoja) {
    if (!columnasSeleccionadas[hoja]) {
      columnasSeleccionadas[hoja] = new Set();
    }
  }

  contenedor.innerHTML = `
    <div class="col-12 mb-3">
      <label class="fw-bold">Seleccionar sección a exportar:</label>
      <select id="selectorHojaPDF" class="form-select" onchange="guardarYActualizarColumnas()">
        <option value="">-- Elige una sección --</option>
        ${Object.keys(datosPorHoja).map(h => `<option value="${h}">${h}</option>`).join("")}
      </select>
    </div>
    <div id="columnasCheckbox" class="row w-100"></div>
  `;

  const modal = new bootstrap.Modal(document.getElementById('modalColumnas'));
  modal.show();
}

function guardarYActualizarColumnas() {

  // 1️⃣ Guardar selecciones actuales ANTES de cambiar la vista
  document.querySelectorAll(".columnaCheck").forEach(c => {
    // Buscar a qué hoja pertenece este checkbox (guardamos data-hoja en cada uno)
    const hoja = c.dataset.hoja;
    if (!hoja) return;
    if (!columnasSeleccionadas[hoja]) columnasSeleccionadas[hoja] = new Set();

    if (c.checked) {
      columnasSeleccionadas[hoja].add(c.value);
    } else {
      columnasSeleccionadas[hoja].delete(c.value);
    }
  });

  // 2️⃣ Renderizar columnas de la nueva hoja seleccionada
  actualizarColumnasPDF();
}

function actualizarColumnasPDF() {

  const hoja = document.getElementById("selectorHojaPDF").value;
  const contenedor = document.getElementById("columnasCheckbox");
  contenedor.innerHTML = "";

  if (!hoja || !headersPorHoja[hoja]) return;

  if (!columnasSeleccionadas[hoja]) {
    columnasSeleccionadas[hoja] = new Set();
  }

  // Detectar campos que ya fueron mostrados en OTRAS secciones seleccionadas
  // para no repetirlos
  const camposYaMostrados = new Set();
  for (let otraHoja in columnasSeleccionadas) {
    if (otraHoja === hoja) continue;
    if (!headersPorHoja[otraHoja]) continue;
    headersPorHoja[otraHoja].forEach(h => camposYaMostrados.add(h));
  }

  headersPorHoja[hoja]?.forEach(h => {
    const esRepetido = camposYaMostrados.has(h);
    const estabaMarcado = columnasSeleccionadas[hoja].has(h);

    contenedor.innerHTML += `
      <div class="col-md-4">
        <div class="form-check">
          <input 
            class="form-check-input columnaCheck" 
            type="checkbox" 
            value="${h}" 
            data-hoja="${hoja}"
            ${estabaMarcado ? "checked" : ""}
            ${esRepetido ? 'title="Este campo ya existe en otra sección" style="opacity:0.5"' : ""}
          >
          <label class="form-check-label ${esRepetido ? "text-muted" : ""}">
            ${h}${esRepetido ? " <small>(en otra sección)</small>" : ""}
          </label>
        </div>
      </div>
    `;
  });

  // 3️⃣ Escuchar cambios en tiempo real para guardar al instante
  document.querySelectorAll(".columnaCheck").forEach(c => {
    c.addEventListener("change", () => {
      const h = c.dataset.hoja;
      if (!columnasSeleccionadas[h]) columnasSeleccionadas[h] = new Set();
      if (c.checked) {
        columnasSeleccionadas[h].add(c.value);
      } else {
        columnasSeleccionadas[h].delete(c.value);
      }
    });
  });
}

function seleccionarTodo(valor) {
  const hoja = document.getElementById("selectorHojaPDF")?.value;
  document.querySelectorAll(".columnaCheck").forEach(c => {
    c.checked = valor;
    if (!hoja) return;
    if (!columnasSeleccionadas[hoja]) columnasSeleccionadas[hoja] = new Set();
    if (valor) {
      columnasSeleccionadas[hoja].add(c.value);
    } else {
      columnasSeleccionadas[hoja].delete(c.value);
    }
  });
}

function generarDashboard() {

  const contenedor = document.getElementById("dashboardMatrimonio");
  contenedor.innerHTML = "";

  let desde = document.getElementById("filtroFechaDesdeDashboard").value;
  let hasta = document.getElementById("filtroFechaHastaDashboard").value;

  if (!desde && !hasta) {
    contenedor.innerHTML = `
      <div class="alert alert-danger text-center">
        ⚠️ Debe seleccionar al menos una fecha (desde o hasta)
      </div>
    `;
    return;
  }

  let totalMatrimonios = 0;
  let conteo = {};

  const data = datosPorHoja["REPORTE DIARIO"] || [];

  // 🔥 Detectar el campo matrimonio UNA SOLA VEZ desde los headers
  const headerRD = headersPorHoja["REPORTE DIARIO"] || [];
  const campoTipoFijo = headerRD.find(h =>
    h.toLowerCase().replace(/\s+/g, "")
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .includes("matrimonio")
  );

  // 🔥 Detectar el campo fecha UNA SOLA VEZ
  const campoFechaFijo = headerRD.find(h =>
    h.toLowerCase().includes("fecha") ||
    h.toLowerCase().includes("f.")
  );

  // Debug — puedes quitarlo después
  console.log("Campo tipo matrimonio detectado:", campoTipoFijo);
  console.log("Campo fecha detectado:", campoFechaFijo);
  console.log("Total filas REPORTE DIARIO:", data.length);

  if (!campoTipoFijo || !campoFechaFijo) {
    contenedor.innerHTML = `
      <div class="alert alert-warning text-center">
        ⚠️ No se encontró el campo de tipo matrimonio o fecha en REPORTE DIARIO
      </div>
    `;
    return;
  }
  data.forEach(row => {

    let tipo = normalizarTipoMatrimonio(row[campoTipoFijo]);
    if (!tipo || tipo.trim() === "") return;

    let valorFecha = row[campoFechaFijo];
    if (!valorFecha || valorFecha.toString().trim() === "") return;

    // 🔥 Usar fechaAISO que ya sabe que el formato es DD/MM/YYYY
    let fechaISO = fechaAISO(valorFecha.toString().trim());
    if (!fechaISO) return;

    if (desde && fechaISO < desde) return;
    if (hasta && fechaISO > hasta) return;

    totalMatrimonios++;
    if (!conteo[tipo]) conteo[tipo] = 0;
    conteo[tipo]++;
  });
  // 🔥 Pon esto ANTES del data.forEach, no dentro
  console.log("Ejemplo fecha guardada:", data[0]?.[campoFechaFijo]);

  console.log("Total contado:", totalMatrimonios, "| Por tipo:", conteo);

  // 🔥 TARJETA TOTAL
  contenedor.innerHTML += `
    <div class="col-md-3">
      <div class="card text-center shadow" style="background:#FFA500; color:white;">
        <div class="card-body">
          <h3>${totalMatrimonios}</h3>
          <p>Matrimonios</p>
        </div>
      </div>
    </div>
  `;

  // 🔥 TARJETAS POR TIPO
  Object.keys(conteo).forEach((tipo, i) => {

    let color;
    if (tipo === "MASIVO") {
      color = "#51D1F6";
    } else if (tipo === "PAGADO") {
      color = "#0d6efd";
    } else {
      color = COLORES_GRAFICOS[i % COLORES_GRAFICOS.length];
    }

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

  let labels = Object.keys(conteo);
  let valores = Object.values(conteo);

  if (window.graficoBarra) window.graficoBarra.destroy();
  if (window.graficoPie) window.graficoPie.destroy();

  const ctxBarra = document.getElementById("graficoBarras");
  if (ctxBarra) {
    window.graficoBarra = new Chart(ctxBarra, {
      type: "bar",
      data: {
        labels,
        datasets: [{
          label: "Matrimonios",
          data: valores,
          backgroundColor: labels.map(t =>
            t === "MASIVO" ? "#51D1F6" : t === "PAGADO" ? "#0d6efd" : COLORES_GRAFICOS[0]
          )
        }]
      },
      options: {
        responsive: true,
        plugins: {
          tooltip: {
            callbacks: {
              label: function (context) {
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const valor = context.parsed.y;
                const porcentaje = ((valor / total) * 100).toFixed(1);
                return ` ${valor} (${porcentaje}%)`;
              }
            }
          },
          datalabels: {
            display: false  // no usar datalabels en barras, usamos el plugin nativo
          }
        }
      },
      plugins: [{
        id: 'porcentajeBarras',
        afterDatasetsDraw(chart) {
          const { ctx, data } = chart;
          const total = data.datasets[0].data.reduce((a, b) => a + b, 0);

          chart.getDatasetMeta(0).data.forEach((bar, i) => {
            const valor = data.datasets[0].data[i];
            const porcentaje = ((valor / total) * 100).toFixed(1) + "%";

            ctx.save();
            ctx.font = "bold 13px Segoe UI";
            ctx.fillStyle = "#1e293b";
            ctx.textAlign = "center";
            ctx.textBaseline = "bottom";
            ctx.fillText(porcentaje, bar.x, bar.y - 4);
            ctx.restore();
          });
        }
      }]
    });
  }

  const ctxPie = document.getElementById("graficoTorta");
  if (ctxPie) {
    window.graficoPie = new Chart(ctxPie, {
      type: "pie",
      data: {
        labels,
        datasets: [{
          data: valores,
          backgroundColor: labels.map(t =>
            t === "MASIVO" ? "#51D1F6" : t === "PAGADO" ? "#0d6efd" : COLORES_GRAFICOS[0]
          )
        }]
      },
      options: {
        responsive: true,
        plugins: {
          tooltip: {
            callbacks: {
              label: function (context) {
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const valor = context.parsed;
                const porcentaje = ((valor / total) * 100).toFixed(1);
                return ` ${context.label}: ${valor} (${porcentaje}%)`;
              }
            }
          },
          legend: {
            position: 'bottom'
          }
        }
      },
      plugins: [{
        id: 'porcentajePie',
        afterDatasetsDraw(chart) {
          const { ctx, data } = chart;
          const total = data.datasets[0].data.reduce((a, b) => a + b, 0);
          const meta = chart.getDatasetMeta(0);

          meta.data.forEach((arc, i) => {
            const valor = data.datasets[0].data[i];
            const porcentaje = ((valor / total) * 100).toFixed(1) + "%";

            const angle = (arc.startAngle + arc.endAngle) / 2;
            const radius = (arc.innerRadius + arc.outerRadius) / 2;
            const x = arc.x + Math.cos(angle) * radius;
            const y = arc.y + Math.sin(angle) * radius;

            ctx.save();
            ctx.font = "bold 13px Segoe UI";
            ctx.fillStyle = "#ffffff";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(porcentaje, x, y);
            ctx.restore();
          });
        }
      }]
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

  let data = modoFiltrado ? aplicarFiltroAData(datosPorHoja[hoja], hoja) : datosPorHoja[hoja];


  if (!data) return;

  let headers = headersPorHoja[hoja];

  let headersVisibles = headers.filter(h => {
    return data.some(row => {
      let valor = row[h];
      return valor !== null && valor !== undefined && valor.toString().trim() !== "";
    });
  });

  // En mostrarSoloHoja() — reemplaza el bloque let html = `...`
  let html = `
  <div class="mb-5">

    <div class="tabla-header-sticky">
      <h3 class="bg-dark text-white p-2 rounded mb-0">${hoja}</h3>
      <div class="scroll-superior">
        <div class="scroll-bar"></div>
      </div>
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

  data.forEach((row, index) => {
    html += `<tr onclick="seleccionarFila(this, '${hoja}', ${index})">`;

    headersVisibles.forEach(h => {
      let valor = row[h] ?? "";

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

  Object.keys(contador).forEach(campo => {
    let n = campo.toLowerCase();
    if (n.includes("nombre") || n.includes("apellidos")) {
      camposCompartidos[campo] = true;
    }
  });
}

async function cargarDesdeFirebase() {


  const COLECCIONES = {
    "REPORTE DIARIO": "reporte_diario",
    "REGISTRO DE ATENCION": "registro_atencion",
    "RESULTADOS DE LABORATORIO": "resultados_laboratorio"
  };

  for (let hoja in COLECCIONES) {

    const snapshot = await fb.getDocs(
      fb.collection(db, COLECCIONES[hoja])
    );

    // 🔥 Obtener los N° de orden ya existentes en Sheets para no duplicar
    const campoOrden = headersPorHoja[hoja]?.find(h => esCampoOrden(h));
    const ordenesExistentes = new Set(
      datosPorHoja[hoja]
        .filter(r => !r._id) // solo los de Sheets
        .map(r => campoOrden ? String(r[campoOrden]).trim() : null)
        .filter(Boolean)
    );

    let contador = datosPorHoja[hoja]?.length || 0;

    snapshot.forEach(doc => {
      const docData = doc.data();

      // 🔥 Si el N° ya existe en Sheets, no agregar (es duplicado)
      if (campoOrden) {
        const ordenDoc = String(docData[campoOrden] || "").trim();
        if (ordenesExistentes.has(ordenDoc)) return; // 🔥 SKIP duplicado
      }

      datosPorHoja[hoja].push({
        ...docData,
        _id: doc.id,
        _orden: contador++
      });
    });

    if (campoOrden) {
      datosPorHoja[hoja].sort((a, b) =>
        Number(a[campoOrden] || 0) - Number(b[campoOrden] || 0)
      );
    } else {
      datosPorHoja[hoja].sort((a, b) =>
        (a._orden || 0) - (b._orden || 0)
      );
    }
  }

  console.log("🔥 Firebase cargado. REPORTE DIARIO total:", datosPorHoja["REPORTE DIARIO"]?.length);
}

function mostrarToast(mensaje, tipo = "success") {

  const container = document.getElementById("toastContainer");

  const toast = document.createElement("div");
  toast.className = `toast ${tipo}`;
  toast.innerText = mensaje;

  container.appendChild(toast);

  // animar entrada
  setTimeout(() => toast.classList.add("show"), 50);

  // eliminar después
  setTimeout(() => {
    toast.classList.remove("show");

    setTimeout(() => {
      toast.remove();
    }, 400);
  }, 3000);
}

function controlarBotonesFlotantes(seccion) {
  const botones = document.querySelector(".botones-flotantes");
  if (!botones) return;

  if (seccion === "tabla") {
    botones.style.display = "flex";
  } else {
    botones.style.display = "none";
  }
}
function hacerArrastrable(el) {

  let offsetX = 0;
  let offsetY = 0;
  let moviendo = false;

  el.addEventListener("mousedown", (e) => {
    moviendo = true;
    offsetX = e.clientX - el.offsetLeft;
    offsetY = e.clientY - el.offsetTop;
    el.style.cursor = "grabbing";
  });

  document.addEventListener("mousemove", (e) => {
    if (!moviendo) return;

    el.style.left = (e.clientX - offsetX) + "px";
    el.style.top = (e.clientY - offsetY) + "px";
  });

  document.addEventListener("mouseup", () => {
    moviendo = false;
    el.style.cursor = "grab";
  });
}
function mostrarSeccion(id) {
  document.querySelectorAll('.seccion').forEach(s => s.classList.remove('activa'));
  document.getElementById(id).classList.add('activa');
  controlarBotonesFlotantes(id);

  // 🔥 Marca el botón activo
  document.querySelectorAll('.sidebar button:not(.btn-cerrar)').forEach(b => b.classList.remove('active'));
  const btn = [...document.querySelectorAll('.sidebar button')].find(b => b.onclick?.toString().includes(id));
  if (btn) btn.classList.add('active');

  if (window.innerWidth <= 768) {
    document.getElementById('sidebar').classList.remove('activa');
    document.getElementById('sidebarOverlay').classList.remove('activa');
  }
}

// ========================= ESTRELLAS SIDEBAR =========================
(function() {
    const canvas = document.getElementById("starCanvas");
    if (!canvas) return;
    const sidebar = canvas.parentElement;
    const ctx = canvas.getContext("2d");

    function resize() {
        canvas.width = sidebar.offsetWidth;
        canvas.height = sidebar.offsetHeight;
    }
    resize();
    window.addEventListener("resize", resize);

    const STAR_COUNT = 90;
    const stars = Array.from({ length: STAR_COUNT }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 1.4 + 0.3,
        alpha: Math.random() * 0.6 + 0.15,
        alphaDir: Math.random() > 0.5 ? 1 : -1,
        alphaSpeed: Math.random() * 0.004 + 0.001,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.08,
        color: Math.random() > 0.85
            ? "rgba(129,140,248,"
            : Math.random() > 0.7
                ? "rgba(16,185,129,"
                : "rgba(255,255,255,"
    }));

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const W = canvas.width, H = canvas.height;

        stars.forEach(s => {
            s.x += s.vx;
            s.y += s.vy;
            if (s.x < 0) s.x = W;
            if (s.x > W) s.x = 0;
            if (s.y < 0) s.y = H;
            if (s.y > H) s.y = 0;

            s.alpha += s.alphaSpeed * s.alphaDir;
            if (s.alpha > 0.85 || s.alpha < 0.08) s.alphaDir *= -1;

            ctx.beginPath();
            ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
            ctx.fillStyle = s.color + s.alpha.toFixed(2) + ")";
            ctx.fill();
        });

        requestAnimationFrame(draw);
    }
    draw();
})();