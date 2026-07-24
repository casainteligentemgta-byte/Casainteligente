import { descargarTextoComoArchivo } from '@/lib/almacen/inventarioExportShare';
import type { FilaMovimientoInventario } from '@/lib/almacen/listarMovimientosInventario';

export type MovimientosExportScope = 'filtrado' | 'seleccionado';

const CSV_HEADERS = [
  'Tipo',
  'Fecha',
  'Hora',
  'Proveedor',
  'Material',
  'Código',
  'Almacén',
  'Cantidad',
  'Unidad',
  'Origen',
  'Destino',
  'Capítulo',
  'Referencia',
  'Notas',
] as const;

function labelTipoExport(tipo: FilaMovimientoInventario['tipo']): string {
  switch (tipo) {
    case 'ingreso':
      return 'ING';
    case 'despacho':
      return 'SAL';
    default:
      return 'STOCK';
  }
}

function etiquetaAlmacenExport(f: FilaMovimientoInventario): string {
  if (f.tipo === 'despacho') return f.origen ?? f.destino ?? '';
  return f.destino ?? f.origen ?? '';
}

function escapeCsvCell(value: string | number): string {
  const s = String(value ?? '');
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function filaMovimientoAValores(f: FilaMovimientoInventario): (string | number)[] {
  return [
    labelTipoExport(f.tipo),
    f.fecha,
    f.hora ?? '',
    f.proveedor ?? '',
    f.material_nombre,
    f.material_codigo ?? '',
    etiquetaAlmacenExport(f),
    f.cantidad > 0 ? f.cantidad : '',
    f.unidad,
    f.origen ?? '',
    f.destino ?? '',
    f.capitulo ?? '',
    f.referencia ?? '',
    f.notas ?? '',
  ];
}

function filaMovimientoACeldas(f: FilaMovimientoInventario): string[] {
  return filaMovimientoAValores(f).map((v) => String(v ?? ''));
}

export function movimientosFilasAoa(filas: FilaMovimientoInventario[]): (string | number)[][] {
  return [[...CSV_HEADERS], ...filas.map(filaMovimientoAValores)];
}

export function movimientosFilasACsv(filas: FilaMovimientoInventario[]): string {
  const lines = [
    CSV_HEADERS.join(','),
    ...filas.map((f) => filaMovimientoACeldas(f).map(escapeCsvCell).join(',')),
  ];
  return `\uFEFF${lines.join('\r\n')}`;
}

export function movimientosFilasATsv(filas: FilaMovimientoInventario[]): string {
  const lines = [
    CSV_HEADERS.join('\t'),
    ...filas.map((f) => filaMovimientoACeldas(f).join('\t')),
  ];
  return lines.join('\r\n');
}

function escapeXmlExcel(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function celdaSpreadsheetMl(value: string | number, header = false): string {
  const tag = header ? 'Cell ss:StyleID="Header"' : 'Cell';
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `<${tag}><Data ss:Type="Number">${value}</Data></Cell>`;
  }
  return `<${tag}><Data ss:Type="String">${escapeXmlExcel(String(value ?? ''))}</Data></Cell>`;
}

function movimientosSpreadsheetMl(filas: FilaMovimientoInventario[]): string {
  const rows = movimientosFilasAoa(filas);
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
 <Worksheet ss:Name="Movimientos">
  <Table>${filasXml}</Table>
 </Worksheet>
</Workbook>`;
}

export function nombreArchivoMovimientosExcel(scope: MovimientosExportScope): string {
  const fecha = new Date().toISOString().slice(0, 10);
  return scope === 'filtrado'
    ? `movimientos-almacen-filtrado-${fecha}.xls`
    : `movimientos-almacen-seleccionados-${fecha}.xls`;
}

export function exportarMovimientosCuadroExcel(
  filas: FilaMovimientoInventario[],
  scope: MovimientosExportScope,
): boolean {
  if (!filas.length) return false;
  descargarTextoComoArchivo(
    `\uFEFF${movimientosSpreadsheetMl(filas)}`,
    nombreArchivoMovimientosExcel(scope),
    'application/vnd.ms-excel;charset=utf-8',
  );
  return true;
}
