import type { ResumenSolicitadosPayload } from '@/lib/rrhh/loadResumenSolicitadosOficios';

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtFecha(iso: string) {
  try {
    return new Date(iso).toLocaleString('es-VE', { dateStyle: 'long', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

export function buildResumenSolicitadosPrintHtml(payload: ResumenSolicitadosPayload, opts?: { autoPrint?: boolean }) {
  const filasHtml = payload.filas
    .map(
      (row) => `<tr>
        <td><strong>${escapeHtml(row.codigo)}</strong>${row.nombre ? `<br><span class="muted">${escapeHtml(row.nombre)}</span>` : ''}</td>
        <td class="num">${row.plazas}</td>
        <td class="num">${row.solicitudes}</td>
      </tr>`,
    )
    .join('');

  const autoPrintScript = opts?.autoPrint
    ? `<script>window.addEventListener('load',function(){setTimeout(function(){window.print()},400)});</script>`
    : '';

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Resumen solicitados — ${escapeHtml(payload.alcanceNombre)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, Segoe UI, sans-serif; margin: 0; color: #111; background: #f8fafc; }
    .toolbar { max-width: 210mm; margin: 0 auto; padding: 16px 20px; display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
    .toolbar button, .toolbar a { font-size: 14px; font-weight: 600; padding: 10px 16px; border-radius: 8px; border: none; cursor: pointer; text-decoration: none; display: inline-block; }
    .btn-print { background: #0f172a; color: #fff; }
    .btn-pdf { background: #6d28d9; color: #fff; }
    .sheet { max-width: 210mm; margin: 0 auto 32px; padding: 28px 32px; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
    h1 { font-size: 20px; margin: 0 0 4px; }
    .sub { color: #64748b; font-size: 13px; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { border: 1px solid #e2e8f0; padding: 10px 12px; text-align: left; vertical-align: top; }
    th { background: #f1f5f9; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: #475569; }
    td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
    .muted { color: #64748b; font-size: 12px; }
    .totals { margin-top: 16px; font-size: 13px; color: #334155; }
    .brand { font-size: 11px; color: #94a3b8; margin-top: 24px; text-align: center; }
    @media print {
      body { background: #fff; }
      .toolbar { display: none !important; }
      .sheet { box-shadow: none; margin: 0; max-width: none; padding: 12mm 14mm; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <button type="button" class="btn-print" onclick="window.print()">Imprimir</button>
    <a class="btn-pdf" id="link-pdf" href="#">Descargar PDF</a>
  </div>
  <main class="sheet">
    <h1>Resumen por oficio — personal solicitado</h1>
    <p class="sub">
      <strong>${escapeHtml(payload.alcanceNombre)}</strong><br />
      Generado: ${escapeHtml(fmtFecha(payload.generadoAt))} ·
      ${payload.totalPlazas} plaza(s) · ${payload.solicitudesPendientes} solicitud(es) pendiente(s)
    </p>
    <table>
      <thead>
        <tr>
          <th>Oficio (tabulador GOE)</th>
          <th class="num">Plazas</th>
          <th class="num">Solicitudes</th>
        </tr>
      </thead>
      <tbody>
        ${filasHtml || '<tr><td colspan="3">Sin solicitudes pendientes en este alcance.</td></tr>'}
      </tbody>
    </table>
    <p class="totals">
      Total plazas: <strong>${payload.totalPlazas}</strong> ·
      Oficios distintos: <strong>${payload.filas.length}</strong>
    </p>
    <p class="brand">Casa Inteligente — RRHH / Gestión de personal</p>
  </main>
  <script>
    (function () {
      var u = new URL(window.location.href);
      u.searchParams.set('format', 'pdf');
      var a = document.getElementById('link-pdf');
      if (a) a.href = u.toString();
    })();
  </script>
  ${autoPrintScript}
</body>
</html>`;
}
