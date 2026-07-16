import type { FilaFacturaCanal } from '@/lib/contabilidad/filtrosFacturaCanal';
import {
  formatearBs,
  formatearTasaBcv,
  formatearUsd,
} from '@/lib/contabilidad/comprasMontos';
import {
  esLineaCompraUsd,
  formatearPrecioUnitarioLineaCompra,
  subtotalBsLineaCompra,
  subtotalUsdLineaCompra,
} from '@/lib/contabilidad/monedaCompra';
import { etiquetaColumnaOrden, type ColumnaOrdenCompras, type DireccionOrden } from '@/lib/contabilidad/ordenarLineasCompras';
import {
  buildDocumentoPrintToolbarHtml,
  documentoPrintToolbarStyles,
  type DocumentoPrintShare,
} from '@/lib/contabilidad/documentoPrintShare';
import { COMPRAS_CUADRO_HEADERS } from '@/lib/contabilidad/comprasCuadroColumnas';
import { etiquetaAlmacenIngresoCompra } from '@/lib/contabilidad/etiquetaAlmacenCompra';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function subtotalBs(row: FilaFacturaCanal): number {
  return subtotalBsLineaCompra(row);
}

function usdRow(row: FilaFacturaCanal, bs: number): number | null {
  void bs;
  return subtotalUsdLineaCompra(row);
}

export type ComprasCuadroPrintInput = {
  titulo?: string;
  subtitulo: string;
  filas: FilaFacturaCanal[];
  totalUsd: number;
  totalBs: number;
  sortColumn?: ColumnaOrdenCompras | null;
  sortDir?: DireccionOrden;
  autoPrint?: boolean;
  /** Enlace al cuadro filtrado en la app (WhatsApp / Telegram / email). */
  share?: DocumentoPrintShare | null;
};

export function buildComprasCuadroPrintHtml(input: ComprasCuadroPrintInput): string {
  const titulo = input.titulo ?? 'Cuadro de compras';
  const filasHtml = input.filas
    .map((row) => {
      const bs = subtotalBs(row);
      const usd = usdRow(row, bs);
      const rif =
        !row.rif || /^SIN[-_]?RIF$/i.test(row.rif.trim()) ? '—' : row.rif;
      const { texto: almacen } = etiquetaAlmacenIngresoCompra({
        ubicacionNombre: row.almacen,
        proyectoNombre: row.proyecto,
        yaIngresadoAlmacen: row.almacenIngresado,
        estadoLogistica: row.estadoLogistica,
      });
      return `<tr>
        <td>${escapeHtml(row.fecha || '—')}</td>
        <td class="mono">${escapeHtml(row.factura || '—')}</td>
        <td>${escapeHtml(row.proveedor)}</td>
        <td>${escapeHtml(rif)}</td>
        <td>${escapeHtml(almacen)}</td>
        <td>${row.esLinea ? escapeHtml(row.articulo) : '<span class="muted">(cabecera)</span>'}</td>
        <td class="mono">${row.esLinea ? escapeHtml(row.codigo || '—') : '—'}</td>
        <td class="num">${row.esLinea ? row.cantidad : '—'}</td>
        <td class="num${row.esLinea && esLineaCompraUsd(row) ? ' usd' : ''}">${row.esLinea ? escapeHtml(formatearPrecioUnitarioLineaCompra(row) ?? '—') : '—'}</td>
        <td class="num">${escapeHtml(formatearBs(bs))}</td>
        <td class="num usd">${usd != null ? escapeHtml(formatearUsd(usd)) : '—'}</td>
        <td class="num">${row.tasaBcv != null && row.tasaBcv > 0 ? escapeHtml(formatearTasaBcv(row.tasaBcv)) : '—'}</td>
        <td>${escapeHtml(row.entidad || '—')}</td>
        <td>${escapeHtml(row.proyecto || '—')}</td>
      </tr>`;
    })
    .join('');

  const sortNote =
    input.sortColumn != null
      ? ` · Orden: ${etiquetaColumnaOrden(input.sortColumn)} (${input.sortDir === 'desc' ? '↓' : '↑'})`
      : '';

  const autoPrintScript = input.autoPrint
    ? `<script>window.addEventListener('load',function(){setTimeout(function(){window.print()},400)});</script>`
    : '';

  const toolbarHtml = buildDocumentoPrintToolbarHtml(input.share);

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(titulo)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, Segoe UI, sans-serif; margin: 0; color: #111; background: #f1f5f9; }
    ${documentoPrintToolbarStyles()}
    .sheet { max-width: 297mm; margin: 0 auto 32px; padding: 24px 28px; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
    h1 { font-size: 20px; margin: 0 0 4px; }
    .sub { color: #64748b; font-size: 13px; margin-bottom: 16px; line-height: 1.45; }
    .totals { display: flex; flex-wrap: wrap; gap: 24px; margin-bottom: 20px; font-size: 14px; }
    .totals strong { display: block; font-size: 11px; text-transform: uppercase; letter-spacing: .05em; color: #64748b; margin-bottom: 4px; }
    .totals .usd { color: #dc2626; font-size: 18px; }
    .totals .bs { color: #ca8a04; font-size: 18px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th, td { border: 1px solid #e2e8f0; padding: 6px 8px; text-align: left; vertical-align: top; }
    th { background: #f1f5f9; font-size: 10px; text-transform: uppercase; letter-spacing: .04em; color: #475569; white-space: nowrap; }
    td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
    td.mono { font-family: ui-monospace, monospace; font-size: 10px; }
    td.usd { color: #dc2626; font-weight: 600; }
    .muted { color: #94a3b8; font-style: italic; }
    .brand { font-size: 11px; color: #94a3b8; margin-top: 20px; text-align: center; }
    @media print {
      body { background: #fff; }
      .sheet { box-shadow: none; margin: 0; max-width: none; padding: 10mm 12mm; }
      table { font-size: 9px; }
    }
  </style>
</head>
<body>
  ${toolbarHtml}
  <main class="sheet">
    <h1>${escapeHtml(titulo)}</h1>
    <p class="sub">${escapeHtml(input.subtitulo)}${escapeHtml(sortNote)}</p>
    <div class="totals">
      <div><strong>Total USD</strong><span class="usd">${escapeHtml(formatearUsd(input.totalUsd))}</span></div>
      <div><strong>Total Bs</strong><span class="bs">${escapeHtml(formatearBs(input.totalBs))}</span></div>
    </div>
    <table>
      <thead>
        <tr>
          ${COMPRAS_CUADRO_HEADERS.map((h) =>
            ['Cant.', 'P.U.', 'Subtotal (Bs)', 'USD', 'Tasa BCV'].includes(h)
              ? `<th class="num">${escapeHtml(h)}</th>`
              : `<th>${escapeHtml(h)}</th>`,
          ).join('')}
        </tr>
      </thead>
      <tbody>${filasHtml || `<tr><td colspan="${COMPRAS_CUADRO_HEADERS.length}">Sin líneas</td></tr>`}</tbody>
    </table>
    <p class="brand">Casa Inteligente · ${escapeHtml(new Date().toLocaleString('es-VE'))}</p>
  </main>
  ${autoPrintScript}
</body>
</html>`;
}

export function abrirComprasCuadroVentana(input: ComprasCuadroPrintInput): void {
  const html = buildComprasCuadroPrintHtml(input);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const w = window.open(url, '_blank', 'noopener,noreferrer');
  if (!w) {
    URL.revokeObjectURL(url);
    throw new Error('El navegador bloqueó la ventana emergente. Permita pop-ups para ver el PDF.');
  }
  w.addEventListener('load', () => URL.revokeObjectURL(url), { once: true });
}
