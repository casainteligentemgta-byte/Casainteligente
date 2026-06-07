import { descargarTextoComoArchivo } from '@/lib/almacen/inventarioExportShare';
import type { FilaTrazabilidadEstrategica } from '@/lib/almacen/listarTrazabilidadEstrategica';

const CSV_HEADERS = [
  'Fecha/Hora',
  'Material',
  'Código',
  'Unidad',
  'Origen / Documento',
  'Tipo de movimiento',
  'Cantidad',
  'Destino / Responsable',
  'Stock resultante',
  'Ubicación',
  'Obra / Proyecto',
  'Notas',
] as const;

function escapeCsvCell(value: string | number): string {
  const s = String(value ?? '');
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function formatearFechaHora(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('es-VE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function filaACeldas(f: FilaTrazabilidadEstrategica): string[] {
  return [
    formatearFechaHora(f.fechaHora),
    f.materialNombre,
    f.materialCodigo ?? '',
    f.unidad,
    f.origenDocumento,
    f.tipoEtiqueta,
    String(f.cantidad),
    f.destinoResponsable,
    String(f.stockResultante),
    f.ubicacionNombre,
    f.proyectoNombre ?? '',
    f.notas ?? '',
  ];
}

export function trazabilidadFilasACsv(filas: FilaTrazabilidadEstrategica[]): string {
  const lines = [
    CSV_HEADERS.join(','),
    ...filas.map((f) => filaACeldas(f).map(escapeCsvCell).join(',')),
  ];
  return `\uFEFF${lines.join('\r\n')}`;
}

function celdaSpreadsheetMl(value: string | number, esHeader: boolean): string {
  const type = typeof value === 'number' ? 'Number' : 'String';
  const style = esHeader ? ' ss:StyleID="Header"' : '';
  const escaped = String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return `<Cell${style}><Data ss:Type="${type}">${escaped}</Data></Cell>`;
}

function trazabilidadSpreadsheetMl(filas: FilaTrazabilidadEstrategica[]): string {
  const rows = [Array.from(CSV_HEADERS), ...filas.map(filaACeldas)];
  const filasXml = rows
    .map(
      (row, idx) =>
        `<Row>${row.map((cell) => celdaSpreadsheetMl(cell, idx === 0)).join('')}</Row>`,
    )
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="Header"><Font ss:Bold="1"/></Style>
 </Styles>
 <Worksheet ss:Name="Trazabilidad">
  <Table>${filasXml}</Table>
 </Worksheet>
</Workbook>`;
}

function nombreArchivoTrazabilidad(ext: 'csv' | 'xls'): string {
  const stamp = new Date().toISOString().slice(0, 10);
  return `trazabilidad-estrategica-${stamp}.${ext}`;
}

export function exportarTrazabilidadCsv(filas: FilaTrazabilidadEstrategica[]): boolean {
  if (!filas.length) return false;
  descargarTextoComoArchivo(trazabilidadFilasACsv(filas), nombreArchivoTrazabilidad('csv'));
  return true;
}

export function exportarTrazabilidadExcel(filas: FilaTrazabilidadEstrategica[]): boolean {
  if (!filas.length) return false;
  descargarTextoComoArchivo(
    `\uFEFF${trazabilidadSpreadsheetMl(filas)}`,
    nombreArchivoTrazabilidad('xls'),
    'application/vnd.ms-excel;charset=utf-8',
  );
  return true;
}
