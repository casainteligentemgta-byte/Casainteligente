import type { FilaMovimientoInventario } from '@/lib/almacen/listarMovimientosInventario';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function labelTipo(tipo: FilaMovimientoInventario['tipo']): string {
  switch (tipo) {
    case 'ingreso':
      return 'ING';
    case 'despacho':
      return 'SAL';
    default:
      return 'STOCK';
  }
}

function etiquetaAlmacen(f: FilaMovimientoInventario): string {
  if (f.tipo === 'despacho') return f.origen ?? f.destino ?? '—';
  return f.destino ?? f.origen ?? '—';
}

export type MovimientosCuadroPrintInput = {
  titulo?: string;
  subtitulo: string;
  filas: FilaMovimientoInventario[];
  resumen?: { ingresado: number; despachado: number; almacenado: number };
  autoPrint?: boolean;
};

export function buildMovimientosCuadroPrintHtml(input: MovimientosCuadroPrintInput): string {
  const titulo = input.titulo ?? 'Movimientos de almacén';
  const filasHtml = input.filas
    .map((f) => {
      const ruta =
        f.origen && f.destino
          ? `${f.origen} → ${f.destino}`
          : f.destino ?? f.origen ?? '—';
      const cantidad = f.cantidad > 0 ? `${f.cantidad} ${f.unidad}` : '—';
      const fechaHora = f.hora
        ? `${f.fecha || '—'}<br/><span class="muted">${escapeHtml(f.hora)}</span>`
        : escapeHtml(f.fecha || '—');
      return `<tr>
        <td class="mono">${escapeHtml(labelTipo(f.tipo))}</td>
        <td class="nowrap">${fechaHora}</td>
        <td>${escapeHtml(f.proveedor ?? '—')}</td>
        <td>${escapeHtml(f.material_nombre)}${f.material_codigo ? `<br/><span class="muted">${escapeHtml(f.material_codigo)}</span>` : ''}${etiquetaAlmacen(f) !== '—' ? `<br/><span class="muted">${escapeHtml(etiquetaAlmacen(f))}</span>` : ''}</td>
        <td class="num">${escapeHtml(cantidad)}</td>
        <td>${escapeHtml(ruta)}</td>
        <td>${escapeHtml(f.capitulo ?? '—')}</td>
        <td class="mono">${escapeHtml(f.referencia ?? '—')}</td>
      </tr>`;
    })
    .join('');

  const resumen = input.resumen;
  const resumenHtml = resumen
    ? `<div class="totals">
        <div><strong>Ingresos</strong><span class="ing">${resumen.ingresado}</span></div>
        <div><strong>Salidas</strong><span class="sal">${resumen.despachado}</span></div>
        <div><strong>Stock</strong><span class="stk">${resumen.almacenado}</span></div>
        <div><strong>Filas</strong><span>${input.filas.length}</span></div>
      </div>`
    : '';

  const autoPrintScript = input.autoPrint
    ? `<script>window.addEventListener('load',function(){setTimeout(function(){window.print()},400)});</script>`
    : '';

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(titulo)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, Segoe UI, sans-serif; margin: 0; color: #111; background: #f1f5f9; }
    .toolbar { max-width: 297mm; margin: 0 auto; padding: 16px 20px; display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
    .toolbar button { font-size: 14px; font-weight: 600; padding: 10px 16px; border-radius: 8px; border: none; cursor: pointer; }
    .btn-print { background: #0f172a; color: #fff; }
    .btn-hint { background: #6d28d9; color: #fff; }
    .sheet { max-width: 297mm; margin: 0 auto 32px; padding: 24px 28px; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
    h1 { font-size: 20px; margin: 0 0 4px; }
    .sub { color: #64748b; font-size: 13px; margin-bottom: 16px; line-height: 1.45; }
    .totals { display: flex; flex-wrap: wrap; gap: 24px; margin-bottom: 20px; font-size: 14px; }
    .totals strong { display: block; font-size: 11px; text-transform: uppercase; letter-spacing: .05em; color: #64748b; margin-bottom: 4px; }
    .totals .ing { color: #059669; font-size: 18px; font-weight: 700; }
    .totals .sal { color: #dc2626; font-size: 18px; font-weight: 700; }
    .totals .stk { color: #0284c7; font-size: 18px; font-weight: 700; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th, td { border: 1px solid #e2e8f0; padding: 6px 8px; text-align: left; vertical-align: top; }
    th { background: #f1f5f9; font-size: 10px; text-transform: uppercase; letter-spacing: .04em; color: #475569; white-space: nowrap; }
    td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
    td.mono { font-family: ui-monospace, monospace; font-size: 10px; }
    td.nowrap { white-space: nowrap; }
    .muted { color: #94a3b8; font-size: 10px; }
    .brand { font-size: 11px; color: #94a3b8; margin-top: 20px; text-align: center; }
    @media print {
      body { background: #fff; }
      .toolbar { display: none !important; }
      .sheet { box-shadow: none; margin: 0; max-width: none; padding: 10mm 12mm; }
      table { font-size: 9px; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <button type="button" class="btn-print" onclick="window.print()">Imprimir</button>
    <button type="button" class="btn-hint" onclick="alert('En el diálogo de impresión elija «Guardar como PDF» o «Microsoft Print to PDF».')">Guardar como PDF</button>
  </div>
  <main class="sheet">
    <h1>${escapeHtml(titulo)}</h1>
    <p class="sub">${escapeHtml(input.subtitulo)}</p>
    ${resumenHtml}
    <table>
      <thead>
        <tr>
          <th>Tipo</th>
          <th>Fecha</th>
          <th>Proveedor</th>
          <th>Material</th>
          <th class="num">Cant.</th>
          <th>Origen / Destino</th>
          <th>Capítulo</th>
          <th>Ref.</th>
        </tr>
      </thead>
      <tbody>${filasHtml || '<tr><td colspan="8">Sin movimientos</td></tr>'}</tbody>
    </table>
    <p class="brand">Casa Inteligente · ${escapeHtml(new Date().toLocaleString('es-VE'))}</p>
  </main>
  ${autoPrintScript}
</body>
</html>`;
}

export function abrirMovimientosCuadroVentana(input: MovimientosCuadroPrintInput): void {
  const html = buildMovimientosCuadroPrintHtml(input);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const w = window.open(url, '_blank', 'noopener,noreferrer');
  if (!w) {
    URL.revokeObjectURL(url);
    throw new Error('El navegador bloqueó la ventana emergente. Permita pop-ups para ver el PDF.');
  }
  w.addEventListener('load', () => URL.revokeObjectURL(url), { once: true });
}
