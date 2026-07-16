import type { CcoLibroFila } from '@/lib/contabilidad/cco/types';
import type { CcoProveedorContratos } from '@/lib/contabilidad/cco/types';
import type { CcoPresupuestoFila } from '@/lib/contabilidad/cco/cargarPresupuestos';

function escXml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function cell(v: string | number, type: 'String' | 'Number' = 'String'): string {
  if (type === 'Number') {
    const n = Number(v);
    return `<Cell><Data ss:Type="Number">${Number.isFinite(n) ? n : 0}</Data></Cell>`;
  }
  return `<Cell><Data ss:Type="String">${escXml(String(v))}</Data></Cell>`;
}

function sheet(name: string, headers: string[], rows: (string | number)[][]): string {
  const headerRow = `<Row>${headers.map((h) => cell(h)).join('')}</Row>`;
  const body = rows
    .map(
      (r) =>
        `<Row>${r
          .map((v, i) => cell(v, typeof headers[i] === 'string' && /USD|MONTO|HONOR|TOTAL|ESTIM|EJEC|SALDO|BASE/i.test(headers[i]) && typeof v === 'number' ? 'Number' : typeof v === 'number' ? 'Number' : 'String'))
          .join('')}</Row>`,
    )
    .join('');
  return `<Worksheet ss:Name="${escXml(name)}"><Table>${headerRow}${body}</Table></Worksheet>`;
}

/** Genera XML SpreadsheetML (.xls) multi-hoja compatible con Excel. */
export function generarExcelMaestroXml(opts: {
  obra: string;
  libro: CcoLibroFila[];
  contratos: CcoProveedorContratos[];
  presupuestos: CcoPresupuestoFila[];
}): string {
  const gastos = opts.libro.filter((f) => f.clase === 'GASTO');
  const ingresos = opts.libro.filter((f) => f.clase === 'INGRESO');
  const contratosFlat = opts.contratos.flatMap((p) =>
    p.contratos.map((c) => [
      p.proveedor,
      c.descripcion,
      c.fecha ?? '',
      c.monto_base_usd,
      c.honorarios_usd,
      c.costo_total_usd,
      c.monto_pagado_usd,
      c.saldo_usd,
      c.pct_avance,
      c.estado,
    ]),
  );

  const sheets = [
    sheet(
      'Gastos',
      ['FECHA', 'PROVEEDOR', 'TIPO', 'CAPITULO', 'SUBCAPITULO', 'DESCRIPCION', 'BASE_USD', 'HONORARIOS', 'TOTAL', 'ESTADO'],
      gastos.map((f) => [
        f.fecha ?? '',
        f.proveedor,
        f.tipo,
        f.capitulo,
        f.subcapitulo,
        f.descripcion,
        f.monto_base_usd,
        f.honorarios_usd,
        f.costo_total_usd,
        f.estado,
      ]),
    ),
    sheet(
      'Ingresos',
      ['FECHA', 'PROVEEDOR', 'DESCRIPCION', 'MONTO_USD', 'MONEDA', 'ESTADO'],
      ingresos.map((f) => [
        f.fecha ?? '',
        f.proveedor,
        f.descripcion,
        f.monto_base_usd,
        f.moneda,
        f.estado,
      ]),
    ),
    sheet(
      'Contratos',
      [
        'PROVEEDOR',
        'DESCRIPCION',
        'FECHA',
        'BASE_USD',
        'HONORARIOS',
        'COSTO_TOTAL',
        'PAGADO',
        'SALDO',
        'AVANCE_%',
        'ESTADO',
      ],
      contratosFlat,
    ),
    sheet(
      'Presupuestos',
      ['CAPITULO', 'SUBCAPITULO', 'DESCRIPCION', 'ESTIMADO_USD', 'EJECUTADO_USD', 'SALDO', 'PCT'],
      opts.presupuestos.map((p) => [
        p.capitulo,
        p.subcapitulo ?? '',
        p.descripcion ?? '',
        p.estimado_usd,
        p.ejecutado_usd,
        p.saldo_usd,
        p.pct_ejecutado,
      ]),
    ),
  ];

  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
  <Title>CCO Maestro ${escXml(opts.obra)}</Title>
  <Author>Casa Inteligente</Author>
</DocumentProperties>
${sheets.join('\n')}
</Workbook>`;
}
