import type { CompraCuadroInput, CompraCuadroLineaInput } from '@/lib/contabilidad/comprasExportShare';
import { descargarTextoComoArchivo } from '@/lib/almacen/inventarioExportShare';
import { montoUsdCompra, montoVesCompra, tasaBcvCompra } from '@/lib/contabilidad/comprasMontos';
import type { ComprasExportScope } from '@/lib/contabilidad/comprasExportShare';

export const MAX_ARTICULOS_REPORTE_CLIENTE = 3;

export type ReporteClienteFila = {
  fecha: string;
  factura: string;
  proveedor: string;
  rif: string;
  /** Hasta 3 descripciones (una por línea en pantalla / exporte). */
  articulosLista: string[];
  /** Cantidad total de unidades (suma de cantidades por línea). */
  totalArticulos: number;
  montoTotalBs: number;
  montoUsd: number;
  tasaBcv: number | null;
};

export const REPORTE_CLIENTE_HEADERS = [
  'Fecha',
  'Factura',
  'Proveedor',
  'RIF',
  'Artículos',
  'Nº artículos',
  'Monto total (Bs)',
  'Monto USD',
  'Tasa BCV',
] as const;

function lineasDetalleCompra(c: CompraCuadroInput): CompraCuadroLineaInput[] {
  const nested = c.contabilidad_compra_lineas;
  if (!Array.isArray(nested) || !nested.length) return [];
  const first = nested[0];
  if (first && 'descripcion' in first) return nested as CompraCuadroLineaInput[];
  return [];
}

function etiquetaLinea(l: CompraCuadroLineaInput): string {
  const desc = String(l.descripcion ?? '').trim();
  if (desc) return desc;
  const code = l.item_code?.trim();
  return code || 'Artículo';
}

export function articulosReporteClienteTexto(fila: ReporteClienteFila): string {
  return fila.articulosLista.join('\n');
}

export function buildReporteClienteDesdeCompras<T extends CompraCuadroInput>(
  compras: T[],
  tasaResolver: (c: T) => number | null,
): ReporteClienteFila[] {
  const filas: ReporteClienteFila[] = compras.map((c) => {
    const lineas = lineasDetalleCompra(c);
    const nombres = lineas.map(etiquetaLinea).filter(Boolean);
    const articulosLista = nombres.slice(0, MAX_ARTICULOS_REPORTE_CLIENTE);
    const totalUnidades = lineas.reduce((acc, l) => acc + (Number(l.cantidad) || 0), 0);
    const totalArticulos = totalUnidades > 0 ? totalUnidades : lineas.length;

    const tasa = tasaResolver(c) ?? tasaBcvCompra(c);
    const montoTotalBs = montoVesCompra({
      total_amount: Number(c.total_amount) || 0,
      monto_ves: c.monto_ves,
    });
    const montoUsd = montoUsdCompra({
      total_amount: c.total_amount ?? montoTotalBs,
      monto_usd: c.monto_usd,
      total_amount_usd: c.total_amount_usd,
      tasa_bcv_ves_por_usd: tasa,
    });

    return {
      fecha: String(c.fecha ?? '').slice(0, 10),
      factura: String(c.invoice_number ?? 'S/N').trim(),
      proveedor: String(c.supplier_name ?? '').trim(),
      rif: String(c.supplier_rif ?? '').trim(),
      articulosLista,
      totalArticulos,
      montoTotalBs,
      montoUsd,
      tasaBcv: tasa,
    };
  });

  return filas.sort((a, b) => {
    const cmp = b.fecha.localeCompare(a.fecha);
    if (cmp !== 0) return cmp;
    return a.factura.localeCompare(b.factura, 'es');
  });
}

function filaAValores(row: ReporteClienteFila): (string | number)[] {
  return [
    row.fecha,
    row.factura,
    row.proveedor,
    row.rif,
    articulosReporteClienteTexto(row),
    row.totalArticulos,
    Math.round(row.montoTotalBs * 100) / 100,
    Math.round(row.montoUsd * 100) / 100,
    row.tasaBcv ?? '',
  ];
}

export function reporteClienteAoa(filas: ReporteClienteFila[]): (string | number)[][] {
  return [[...REPORTE_CLIENTE_HEADERS], ...filas.map(filaAValores)];
}

function escapeXmlExcel(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function celdaSpreadsheetMl(
  value: string | number,
  opts?: { header?: boolean; wrap?: boolean },
): string {
  const header = opts?.header ?? false;
  const wrap = opts?.wrap ?? false;
  const style =
    header ? ' ss:StyleID="Header"' : wrap ? ' ss:StyleID="Wrap"' : '';
  const tag = `Cell${style}`;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `<${tag}><Data ss:Type="Number">${value}</Data></Cell>`;
  }
  return `<${tag}><Data ss:Type="String">${escapeXmlExcel(String(value ?? ''))}</Data></Cell>`;
}

const COL_ARTICULOS_IDX = 4;

function reporteClienteSpreadsheetMl(filas: ReporteClienteFila[]): string {
  const headerRow = REPORTE_CLIENTE_HEADERS.map((h) => celdaSpreadsheetMl(h, { header: true }));
  const dataRows = filas.map((row) => {
    const vals = filaAValores(row);
    return vals
      .map((cell, idx) =>
        celdaSpreadsheetMl(cell, { wrap: idx === COL_ARTICULOS_IDX }),
      )
      .join('');
  });

  const filasXml =
    `<Row>${headerRow.join('')}</Row>` +
    dataRows.map((cells) => `<Row>${cells}</Row>`).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="Header"><Font ss:Bold="1"/></Style>
  <Style ss:ID="Wrap"><Alignment ss:Vertical="Top" ss:WrapText="1"/></Style>
 </Styles>
 <Worksheet ss:Name="Reporte Cliente">
  <Table>${filasXml}</Table>
 </Worksheet>
</Workbook>`;
}

export function nombreArchivoReporteCliente(
  scope: ComprasExportScope,
  ext: 'xls' | 'pdf' = 'xls',
): string {
  const fecha = new Date().toISOString().slice(0, 10);
  const base =
    scope === 'filtrado' ? `reporte-cliente-filtrado-${fecha}` : `reporte-cliente-completo-${fecha}`;
  return `${base}.${ext}`;
}

export function exportarReporteClienteExcel(
  filas: ReporteClienteFila[],
  scope: ComprasExportScope,
): boolean {
  if (!filas.length) return false;
  descargarTextoComoArchivo(
    `\uFEFF${reporteClienteSpreadsheetMl(filas)}`,
    nombreArchivoReporteCliente(scope, 'xls'),
    'application/vnd.ms-excel;charset=utf-8',
  );
  return true;
}
