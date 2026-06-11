import {
  REPORTE_CLIENTE_HEADERS,
  type ReporteClienteFila,
} from '@/lib/contabilidad/reporteClienteCompras';
import { formatearBs, formatearTasaBcv, formatearUsd } from '@/lib/contabilidad/comprasMontos';
import {
  buildDocumentoPrintToolbarHtml,
  documentoPrintToolbarStyles,
  type DocumentoPrintShare,
} from '@/lib/contabilidad/documentoPrintShare';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function celdaArticulosHtml(fila: ReporteClienteFila): string {
  if (!fila.articulosLista.length) return '—';
  return fila.articulosLista.map((a) => `<div class="art-line">${escapeHtml(a)}</div>`).join('');
}

export type ReporteClientePrintInput = {
  subtitulo?: string;
  filas: ReporteClienteFila[];
  autoPrint?: boolean;
  share?: DocumentoPrintShare | null;
};

export function buildReporteClientePrintHtml(input: ReporteClientePrintInput): string {
  const filasHtml = input.filas
    .map(
      (row) => `<tr>
        <td>${escapeHtml(row.fecha || '—')}</td>
        <td class="mono">${escapeHtml(row.factura || '—')}</td>
        <td>${escapeHtml(row.proveedor || '—')}</td>
        <td class="mono">${escapeHtml(row.rif || '—')}</td>
        <td class="articulos">${celdaArticulosHtml(row)}</td>
        <td class="num">${row.totalArticulos.toLocaleString('es-VE')}</td>
        <td class="num">${escapeHtml(formatearBs(row.montoTotalBs))}</td>
        <td class="num usd">${escapeHtml(formatearUsd(row.montoUsd))}</td>
        <td class="num">${row.tasaBcv != null ? escapeHtml(formatearTasaBcv(row.tasaBcv)) : '—'}</td>
      </tr>`,
    )
    .join('');

  const headersHtml = REPORTE_CLIENTE_HEADERS.map((h) => `<th>${escapeHtml(h)}</th>`).join('');

  const autoPrintScript = input.autoPrint
    ? `<script>window.addEventListener('load',function(){setTimeout(function(){window.print()},400)});</script>`
    : '';

  const toolbarHtml = buildDocumentoPrintToolbarHtml(input.share);

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Reporte Cliente — Casa Inteligente</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: system-ui, Segoe UI, sans-serif; font-size: 11px; color: #111; margin: 0; background: #f1f5f9; }
    ${documentoPrintToolbarStyles()}
    .sheet { max-width: 297mm; margin: 0 auto 32px; padding: 24px 28px; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
    h1 { font-size: 18px; margin: 0 0 4px; }
    .sub { color: #555; margin: 0 0 16px; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #ccc; padding: 6px 8px; vertical-align: top; text-align: left; }
    th { background: #f0f0f0; font-size: 10px; text-transform: uppercase; }
    .num { text-align: right; white-space: nowrap; }
    .mono { font-family: ui-monospace, Consolas, monospace; font-size: 10px; }
    .usd { color: #0a6; }
    .articulos { min-width: 180px; max-width: 280px; }
    .art-line { line-height: 1.35; padding: 1px 0; }
    .art-line + .art-line { border-top: 1px dashed #ddd; margin-top: 2px; padding-top: 3px; }
    .brand { margin-top: 16px; font-size: 10px; color: #888; text-align: right; }
    @media print {
      body { background: #fff; }
      .sheet { box-shadow: none; margin: 0; max-width: none; padding: 10mm 12mm; }
      tr { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  ${toolbarHtml}
  <main class="sheet">
  <h1>Reporte Cliente</h1>
  ${input.subtitulo ? `<p class="sub">${escapeHtml(input.subtitulo)}</p>` : ''}
  <table>
    <thead><tr>${headersHtml}</tr></thead>
    <tbody>${filasHtml || '<tr><td colspan="9">Sin facturas</td></tr>'}</tbody>
  </table>
  <p class="brand">Casa Inteligente · ${escapeHtml(new Date().toLocaleString('es-VE'))}</p>
  </main>
  ${autoPrintScript}
</body>
</html>`;
}

export function abrirReporteClienteVentana(input: ReporteClientePrintInput): void {
  const html = buildReporteClientePrintHtml(input);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const w = window.open(url, '_blank', 'noopener,noreferrer');
  if (!w) {
    URL.revokeObjectURL(url);
    throw new Error('El navegador bloqueó la ventana emergente. Permita pop-ups para ver el PDF.');
  }
  w.addEventListener('load', () => URL.revokeObjectURL(url), { once: true });
}

/** Abre HTML listo para imprimir / guardar como PDF desde el diálogo del navegador. */
export function exportarReporteClientePdf(
  filas: ReporteClienteFila[],
  opts?: { subtitulo?: string; share?: DocumentoPrintShare | null },
): boolean {
  if (!filas.length) return false;
  abrirReporteClienteVentana({
    filas,
    subtitulo: opts?.subtitulo,
    share: opts?.share,
    autoPrint: false,
  });
  return true;
}
