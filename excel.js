// =====================
// EXPORTAR
// =====================
function exportarExcel() {
  const wb = XLSX.utils.book_new();

  for (let hoja in datosPorHoja) {
    if (hoja === HOJA_OCULTA) continue;

    const ws = XLSX.utils.json_to_sheet(datosPorHoja[hoja]);
    XLSX.utils.book_append_sheet(wb, ws, hoja);
  }

  XLSX.writeFile(wb, "reporte.xlsx");
}
