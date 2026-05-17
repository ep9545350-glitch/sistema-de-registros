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

    // 🔥 ELIMINADO: ya no se renumera nada, cada registro conserva su N° original

    mostrarToast("Eliminado correctamente ✅");

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

    const COLUMNAS_SIEMPRE_VISIBLES = ["CMP ANULADO", "MOTIVO DE ANULACION"];

let headersVisibles = headers.filter(h => {
  if (COLUMNAS_SIEMPRE_VISIBLES.includes(h.trim().toUpperCase())) return true;
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

// ═══════════════════════════════════════════════════════════════
// 📋 FORMULARIO MEJORADO — reemplaza tu función generarFormulario()
// ═══════════════════════════════════════════════════════════════

function generarFormulario() {
  const contenedor = document.getElementById("formularioDinamico");
  contenedor.innerHTML = "";

  let inputsCreados = {};
  let hojaIndex = 0;

  const iconosPorHoja = {
    "REPORTE DIARIO":            "ti-calendar-event",
    "REGISTRO DE ATENCION":      "ti-stethoscope",
    "RESULTADOS DE LABORATORIO": "ti-flask",
  };

  const coloresPorHoja = [
    { bg: "linear-gradient(135deg,#6366f1,#8b5cf6)", badge: "#6366f1" },
    { bg: "linear-gradient(135deg,#0ea5e9,#06b6d4)",  badge: "#0ea5e9" },
    { bg: "linear-gradient(135deg,#10b981,#34d399)",  badge: "#10b981" },
  ];

  for (let hoja in headersPorHoja) {
    if (hoja === HOJA_OCULTA) continue;

    const color  = coloresPorHoja[hojaIndex % coloresPorHoja.length];
    const icono  = iconosPorHoja[hoja] || "ti-forms";
    const campos = [];

    headersPorHoja[hoja].forEach(h => {
      const nombre = h.toLowerCase().trim();
      if (esCampoOrden(nombre)) return;
      if ((nombre.includes("nombre") || nombre.includes("apellidos")) && hoja !== "REPORTE DIARIO") return;

      let tipo = "text";
      if (
        nombre.includes("fecha") || nombre.includes("f.") ||
        nombre.includes("consejeria") || nombre.includes("laboratorio") ||
        nombre.includes("consulta")
      ) tipo = "date";

      // campo global ya renderizado → saltar
      if (camposCompartidos[h] && inputsCreados[h]) return;

      campos.push({ h, tipo, esGlobal: !!camposCompartidos[h] });
      if (camposCompartidos[h]) inputsCreados[h] = true;
    });

    // ── Encabezado de sección ──
    contenedor.innerHTML += `
      <div class="col-12 form-seccion-header" style="animation-delay:${hojaIndex * 0.08}s">
        <div class="form-seccion-pill" style="background:${color.bg}">
          <i class="ti ${icono}" style="font-size:18px;"></i>
          <span>${hoja}</span>
        </div>
        <div class="form-seccion-line" style="background:${color.badge}22"></div>
      </div>
    `;

    // ── Campos ──
    campos.forEach((campo, idx) => {
      const { h, tipo, esGlobal } = campo;
      const inputId = esGlobal ? `global_${h}` : `${hoja}_${h}`;
      const iconoCampo = obtenerIconoCampo(h);
      const delay = (hojaIndex * 0.08 + idx * 0.04).toFixed(2);

      contenedor.innerHTML += `
        <div class="col-md-4 col-sm-6 form-campo-wrap" style="animation-delay:${delay}s">
          <div class="form-campo-card ${tipo === 'date' ? 'es-fecha' : ''}">
            <div class="form-campo-icon" style="color:${color.badge}">
              <i class="ti ${iconoCampo}"></i>
            </div>
            <div class="form-campo-body">
              <label class="form-campo-label" for="${inputId}">
                ${h}${esGlobal ? ' <span class="form-badge-global">global</span>' : ''}
              </label>
              <input
                type="${tipo}"
                id="${inputId}"
                class="form-campo-input"
                placeholder="${tipo === 'date' ? '' : 'Ingrese ' + h.toLowerCase()}"
                autocomplete="off"
              >
            </div>
          </div>
        </div>
      `;
    });

    hojaIndex++;
  }

  // ── Evento: mayúsculas en tiempo real ──
  contenedor.querySelectorAll(".form-campo-input").forEach(input => {
    if (input.type !== "date") {
      input.addEventListener("input", function () {
        this.value = this.value.toUpperCase();
      });
    }
    // efecto focus
    input.addEventListener("focus", function () {
      this.closest(".form-campo-card").classList.add("focused");
    });
    input.addEventListener("blur", function () {
      this.closest(".form-campo-card").classList.remove("focused");
    });
  });
}

// ── Helper: icono según el nombre del campo ──
function obtenerIconoCampo(nombre) {
  const n = nombre.toLowerCase();
  if (n.includes("nombre") || n.includes("apellido")) return "ti-user";
  if (n.includes("dni") || n.includes("ce"))           return "ti-id";
  if (n.includes("fecha") || n.includes("f."))         return "ti-calendar";
  if (n.includes("matrimonio") || n.includes("tipo"))  return "ti-rings";
  if (n.includes("telefono") || n.includes("cel"))     return "ti-phone";
  if (n.includes("correo") || n.includes("email"))     return "ti-mail";
  if (n.includes("edad"))                              return "ti-number";
  if (n.includes("direccion") || n.includes("dir"))    return "ti-map-pin";
  if (n.includes("obs") || n.includes("nota"))         return "ti-notes";
  if (n.includes("resultado") || n.includes("lab"))    return "ti-flask";
  if (n.includes("cmp") || n.includes("medico"))       return "ti-stethoscope";
  if (n.includes("recibo") || n.includes("pago"))      return "ti-receipt";
  return "ti-pencil";
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
  const headerRD = headersPorHoja["REPORTE DIARIO"] || [];

  const campoTipoFijo = headerRD.find(h =>
    h.toLowerCase().replace(/\s+/g, "")
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .includes("matrimonio")
  );

  const campoFechaFijo = headerRD.find(h =>
    h.toLowerCase().includes("fecha") ||
    h.toLowerCase().includes("f.")
  );

  if (!campoTipoFijo || !campoFechaFijo) {
    contenedor.innerHTML = `
      <div class="alert alert-warning text-center">
        ⚠️ No se encontró el campo de tipo matrimonio o fecha en REPORTE DIARIO
      </div>
    `;
    return;
  }

  function colorPorTipo(tipo, i) {
    if (tipo === "PAGADO") return "#2563eb";
    if (tipo === "MASIVO") return "#06b6d4";
    return COLORES_GRAFICOS[i % COLORES_GRAFICOS.length];
  }

  const nombresMeses = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

  let tendenciaMesesFiltrada = {};

  data.forEach(row => {
    let tipo = normalizarTipoMatrimonio(row[campoTipoFijo]);
    if (!tipo || tipo.trim() === "") return;

    let valorFecha = row[campoFechaFijo];
    if (!valorFecha || valorFecha.toString().trim() === "") return;

    let fechaISO = fechaAISO(valorFecha.toString().trim());
    if (!fechaISO) return;

    if (desde && fechaISO < desde) return;
    if (hasta && fechaISO > hasta) return;

    totalMatrimonios++;
    if (!conteo[tipo]) conteo[tipo] = 0;
    conteo[tipo]++;

    let mes = parseInt(fechaISO.split("-")[1], 10) - 1;
    let nombreMes = nombresMeses[mes];
    if (!tendenciaMesesFiltrada[nombreMes]) tendenciaMesesFiltrada[nombreMes] = 0;
    tendenciaMesesFiltrada[nombreMes]++;
  });

  let tendenciaMesesTotal = {};

  data.forEach(row => {
    let tipo = normalizarTipoMatrimonio(row[campoTipoFijo]);
    if (!tipo || tipo.trim() === "") return;

    let valorFecha = row[campoFechaFijo];
    if (!valorFecha || valorFecha.toString().trim() === "") return;

    let fechaISO = fechaAISO(valorFecha.toString().trim());
    if (!fechaISO) return;

    let mes = parseInt(fechaISO.split("-")[1], 10) - 1;
    let nombreMes = nombresMeses[mes];
    if (!tendenciaMesesTotal[nombreMes]) tendenciaMesesTotal[nombreMes] = 0;
    tendenciaMesesTotal[nombreMes]++;
  });

  // ── TARJETA TOTAL ──
  contenedor.innerHTML += `
    <div class="col-auto mb-3">
      <div style="background:#f97316; border-radius:10px; padding:7px 14px; min-width:160px;">
        <div style="color:rgba(255,255,255,0.75); font-size:11px; margin-bottom:3px;">Total matrimonios</div>
        <div style="color:#fff; font-size:26px; font-weight:500; line-height:1;">${totalMatrimonios}</div>
        <div style="color:rgba(255,255,255,0.8); font-size:11px; margin-top:4px;">período seleccionado</div>
      </div>
    </div>
  `;

  // ── TARJETAS POR TIPO ──
  Object.keys(conteo).forEach((tipo, i) => {
    const color = colorPorTipo(tipo, i);
    const pct = totalMatrimonios > 0 ? ((conteo[tipo] / totalMatrimonios) * 100).toFixed(1) : 0;
    contenedor.innerHTML += `
      <div class="col-auto mb-3">
        <div style="background:${color}; border-radius:10px; padding:7px 14px; cursor:pointer; min-width:160px;"
             onclick="filtrarPorTipo('${tipo}')">
          <div style="color:rgba(255,255,255,0.75); font-size:11px; margin-bottom:3px;">${tipo}</div>
          <div style="color:#fff; font-size:26px; font-weight:500; line-height:1;">${conteo[tipo]}</div>
          <div style="color:rgba(255,255,255,0.8); font-size:11px; margin-top:4px;">${pct}% del total</div>
        </div>
      </div>
    `;
  });

  // ── GRÁFICOS: barras + torta arriba, tendencia abajo ──
  const mesesOrdenados = nombresMeses.filter(m => tendenciaMesesTotal[m]);
  const valoresTendencia = mesesOrdenados.map(m => tendenciaMesesTotal[m]);

  contenedor.innerHTML += `
    <div class="col-12 mb-3">
      <div class="row g-3">

        <div class="col-md-4">
          <div style="background:#f8fafc; border:0.5px solid #e2e8f0; border-radius:12px; padding:14px;">
            <div style="font-size:13px; font-weight:500; color:#1e293b; margin-bottom:2px;">Frecuencia</div>
            <div style="font-size:11px; color:#94a3b8; margin-bottom:8px;"></div>
            <div style="display:flex; flex-wrap:wrap; gap:10px; margin-bottom:8px;">
              ${Object.keys(conteo).map((tipo, i) => `
                <span style="display:flex; align-items:center; gap:5px; font-size:11px; color:#64748b;">
                  <span style="width:10px;height:10px;border-radius:2px;background:${colorPorTipo(tipo,i)};flex-shrink:0;"></span>
                  ${tipo} ${totalMatrimonios > 0 ? ((conteo[tipo]/totalMatrimonios)*100).toFixed(1) : 0}%
                </span>
              `).join("")}
            </div>
            <div style="position:relative; width:100%; height:190px;">
              <canvas id="graficoBarras" role="img" aria-label="Gráfico de barras de tipos de matrimonio"></canvas>
            </div>
          </div>
        </div>

        <div class="col-md-4">
          <div style="background:#f8fafc; border:0.5px solid #e2e8f0; border-radius:12px; padding:14px;">
            <div style="font-size:13px; font-weight:500; color:#1e293b; margin-bottom:2px;">Vista porcentual</div>
            <div style="font-size:11px; color:#94a3b8; margin-bottom:8px;"></div>
            <div style="display:flex; flex-wrap:wrap; gap:10px; margin-bottom:8px;">
              ${Object.keys(conteo).map((tipo, i) => `
                <span style="display:flex; align-items:center; gap:5px; font-size:11px; color:#64748b;">
                  <span style="width:10px;height:10px;border-radius:2px;background:${colorPorTipo(tipo,i)};flex-shrink:0;"></span>
                  ${tipo}
                </span>
              `).join("")}
            </div>
            <div style="position:relative; width:100%; height:190px;">
              <canvas id="graficoTorta" role="img" aria-label="Gráfico de torta de tipos de matrimonio"></canvas>
            </div>
          </div>
        </div>

      </div>
    </div>

    <div class="col-md-8 mb-3">
      <div style="background:#f8fafc; border:0.5px solid #e2e8f0; border-radius:12px; padding:14px;">
        <div style="font-size:13px; font-weight:500; color:#1e293b; margin-bottom:2px;">Tendencia mensual</div>
        <div style="font-size:11px; color:#94a3b8; margin-bottom:8px;">Evolución de todos los registros por mes</div>
        <div style="display:flex; gap:12px; margin-bottom:8px;">
          <span style="display:flex; align-items:center; gap:5px; font-size:11px; color:#64748b;">
            <span style="width:10px;height:10px;border-radius:2px;background:#f97316;flex-shrink:0;"></span>
            Total matrimonios
          </span>
        </div>
        <div style="position:relative; width:100%; height:170px;">
          <canvas id="graficoTendencia" role="img" aria-label="Gráfico de tendencia mensual de matrimonios"></canvas>
        </div>
      </div>
    </div>
  `;

  // ── Destruir gráficos anteriores ──
  if (window.graficoBarra) window.graficoBarra.destroy();
  if (window.graficoPie)   window.graficoPie.destroy();
  if (window.graficoLinea) window.graficoLinea.destroy();

  const labels  = Object.keys(conteo);
  const valores = Object.values(conteo);
  const colores = labels.map((t, i) => colorPorTipo(t, i));
  const gridC   = "rgba(0,0,0,0.06)";
  const tickC   = "#94a3b8";

  // ── Gráfico de barras ──
  const ctxBarra = document.getElementById("graficoBarras");
  if (ctxBarra) {
    window.graficoBarra = new Chart(ctxBarra, {
      type: "bar",
      data: {
        labels,
        datasets: [{
          label: "Matrimonios",
          data: valores,
          backgroundColor: colores,
          borderRadius: 6,
          borderSkipped: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { color: tickC, font: { size: 11 } } },
          y: { grid: { color: gridC },   ticks: { color: tickC, font: { size: 11 } } }
        }
      },
      plugins: [{
        id: "porcentajeBarras",
        afterDatasetsDraw(chart) {
          const { ctx, data } = chart;
          const total = data.datasets[0].data.reduce((a, b) => a + b, 0);
          chart.getDatasetMeta(0).data.forEach((bar, i) => {
            const valor = data.datasets[0].data[i];
            const pct = ((valor / total) * 100).toFixed(1) + "%";
            ctx.save();
            ctx.font = "bold 12px Segoe UI";
            ctx.fillStyle = "#1e293b";
            ctx.textAlign = "center";
            ctx.textBaseline = "bottom";
            ctx.fillText(pct, bar.x, bar.y - 4);
            ctx.restore();
          });
        }
      }]
    });
  }

  // ── Gráfico de torta ──
  const ctxPie = document.getElementById("graficoTorta");
  if (ctxPie) {
    window.graficoPie = new Chart(ctxPie, {
      type: "pie",
      data: {
        labels,
        datasets: [{
          data: valores,
          backgroundColor: colores,
          borderWidth: 2,
          borderColor: "#ffffff",
          hoverOffset: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                const pct = ((ctx.parsed / total) * 100).toFixed(1);
                return ` ${ctx.label}: ${ctx.parsed} (${pct}%)`;
              }
            }
          }
        }
      },
      plugins: [{
        id: "porcentajePie",
        afterDatasetsDraw(chart) {
          const { ctx, data } = chart;
          const total = data.datasets[0].data.reduce((a, b) => a + b, 0);
          chart.getDatasetMeta(0).data.forEach((arc, i) => {
            const valor = data.datasets[0].data[i];
            const pct = ((valor / total) * 100).toFixed(1) + "%";
            const angle = (arc.startAngle + arc.endAngle) / 2;
            const radius = (arc.innerRadius + arc.outerRadius) / 2;
            const x = arc.x + Math.cos(angle) * radius;
            const y = arc.y + Math.sin(angle) * radius;
            ctx.save();
            ctx.font = "bold 13px Segoe UI";
            ctx.fillStyle = "#ffffff";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(pct, x, y);
            ctx.restore();
          });
        }
      }]
    });
  }

  // ── Gráfico de tendencia mensual ──
  // ── Gráfico de tendencia mensual ──
  const ctxLinea = document.getElementById("graficoTendencia");
  if (ctxLinea && mesesOrdenados.length > 0) {
    window.graficoLinea = new Chart(ctxLinea, {
      type: "line",
      data: {
        labels: mesesOrdenados,
        datasets: [{
          label: "Matrimonios",
          data: valoresTendencia,
          borderColor: "#f97316",
          backgroundColor: "rgba(249,115,22,0.08)",
          fill: true,
          tension: 0.4,
          pointBackgroundColor: "#f97316",
          pointRadius: 5,
          pointHoverRadius: 7
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: tickC, font: { size: 11 } }
          },
          y: {
            grid: { color: gridC },
            ticks: { color: tickC, font: { size: 11 } },
            min: 0
          }
        }
      },
      // 🔥 NUEVO: etiquetas encima de cada punto
      plugins: [{
        id: "etiquetasPuntos",
        afterDatasetsDraw(chart) {
          const { ctx, data } = chart;
          chart.getDatasetMeta(0).data.forEach((punto, i) => {
            const valor = data.datasets[0].data[i];
            ctx.save();
            ctx.font = "bold 11px Segoe UI";
            ctx.fillStyle = "#f97316";
            ctx.textAlign = "center";
            ctx.textBaseline = "bottom";
            ctx.fillText(valor, punto.x, punto.y - 6);
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

  const COLUMNAS_SIEMPRE_VISIBLES = ["CMP ANULADO", "MOTIVO DE ANULACION"];

let headersVisibles = headers.filter(h => {
  if (COLUMNAS_SIEMPRE_VISIBLES.includes(h.trim().toUpperCase())) return true;
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

    const campoOrden = headersPorHoja[hoja]?.find(h => esCampoOrden(h));

    // 🔥 Máximo N° que ya existe en Sheets
    const maxEnSheets = datosPorHoja[hoja]
      .filter(r => !r._id)
      .reduce((max, r) => {
        const n = Number(r[campoOrden] || 0);
        return n > max ? n : max;
      }, 0);

    console.log(`📋 ${hoja}: Sheets tiene hasta N°${maxEnSheets}`);

    let contador = datosPorHoja[hoja].length;

    snapshot.forEach(doc => {
      const docData = doc.data();

      // Encontrar el valor del campo orden en el documento Firebase
      let ordenDoc = 0;
      if (campoOrden) {
        const claveEnDoc = Object.keys(docData).find(k => esCampoOrden(k));
        ordenDoc = claveEnDoc
          ? Number(docData[claveEnDoc] || 0)
          : Number(docData[limpiarClave(campoOrden)] || docData[campoOrden] || 0);
      }

      // 🔥 Solo agregar si su N° es MAYOR al máximo de Sheets
      if (ordenDoc <= maxEnSheets) {
        console.log(`⏭️ Saltando N°${ordenDoc} (ya está en Sheets)`);
        return;
      }

      datosPorHoja[hoja].push({
        ...docData,
        _id: doc.id,
        _orden: contador++
      });
    });

    // Ordenar todo por N° de orden
    if (campoOrden) {
      const claveL = limpiarClave(campoOrden);
      datosPorHoja[hoja].sort((a, b) => {
        const va = Number(a[campoOrden] || a[claveL] || 0);
        const vb = Number(b[campoOrden] || b[claveL] || 0);
        return va - vb;
      });
    } else {
      datosPorHoja[hoja].sort((a, b) => (a._orden || 0) - (b._orden || 0));
    }

    console.log(`✅ ${hoja}: ${datosPorHoja[hoja].length} registros totales`);
  }
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
    // 🔥 Si no tiene left definido, calcularlo desde getBoundingClientRect
    if (!el.style.left || el.style.left === "auto" || el.style.left === "") {
      const rect = el.getBoundingClientRect();
      el.style.left = rect.left + "px";
      el.style.top  = rect.top  + "px";
      el.style.right = "auto";
    }

    moviendo = true;
    offsetX = e.clientX - el.getBoundingClientRect().left;
    offsetY = e.clientY - el.getBoundingClientRect().top;
    el.style.cursor = "grabbing";
    e.preventDefault();
  });

  document.addEventListener("mousemove", (e) => {
    if (!moviendo) return;

    // 🔥 Limitar dentro de la ventana
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    let newLeft = e.clientX - offsetX;
    let newTop  = e.clientY - offsetY;

    newLeft = Math.max(0, Math.min(newLeft, window.innerWidth  - w));
    newTop  = Math.max(0, Math.min(newTop,  window.innerHeight - h));

    el.style.left = newLeft + "px";
    el.style.top  = newTop  + "px";
  });

  document.addEventListener("mouseup", () => {
    moviendo = false;
    el.style.cursor = "grab";
  });

  // 🔥 SOPORTE TÁCTIL (móvil)
  el.addEventListener("touchstart", (e) => {
    if (!el.style.left || el.style.left === "auto" || el.style.left === "") {
      const rect = el.getBoundingClientRect();
      el.style.left  = rect.left + "px";
      el.style.top   = rect.top  + "px";
      el.style.right = "auto";
    }
    const t = e.touches[0];
    offsetX = t.clientX - el.getBoundingClientRect().left;
    offsetY = t.clientY - el.getBoundingClientRect().top;
    moviendo = true;
    e.preventDefault();
  }, { passive: false });

  document.addEventListener("touchmove", (e) => {
    if (!moviendo) return;
    const t = e.touches[0];
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    let newLeft = t.clientX - offsetX;
    let newTop  = t.clientY - offsetY;

    newLeft = Math.max(0, Math.min(newLeft, window.innerWidth  - w));
    newTop  = Math.max(0, Math.min(newTop,  window.innerHeight - h));

    el.style.left = newLeft + "px";
    el.style.top  = newTop  + "px";
    e.preventDefault();
  }, { passive: false });

  document.addEventListener("touchend", () => {
    moviendo = false;
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