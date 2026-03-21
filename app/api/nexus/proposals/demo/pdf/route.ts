import { NextResponse } from 'next/server';

/**
 * PDF / HTML de propuesta Nexus (demo) — branding oscuro, acentos cian, tipografía mono para cifras.
 */
export async function GET() {
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Nexus Home · Propuesta comercial</title>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=JetBrains+Mono:wght@400;600;700&display=swap" rel="stylesheet"/>
  <style>
    :root {
      --bg: #0a0b10;
      --cyan: #00f2fe;
      --green: #00ff41;
      --gold: #ffd700;
      --muted: rgba(255,255,255,0.65);
      --dim: rgba(255,255,255,0.4);
      --glow: rgba(0, 242, 254, 0.45);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0; padding: 14mm 16mm; background: var(--bg); color: #fff;
      font-family: Inter, system-ui, sans-serif; font-size: 11px;
    }
    .mono { font-family: 'JetBrains Mono', monospace; }
    .top {
      display: flex; justify-content: space-between; align-items: flex-start;
      padding-bottom: 14px; margin-bottom: 20px;
      border-bottom: 2px solid var(--cyan);
      box-shadow: 0 8px 40px -20px var(--glow);
    }
    .brand { font-size: 22px; font-weight: 800; letter-spacing: -0.03em; }
    .tag { font-size: 9px; letter-spacing: 0.25em; text-transform: uppercase; color: var(--cyan); margin-bottom: 6px; }
    .badge {
      background: linear-gradient(135deg, rgba(0,242,254,0.2), rgba(0,242,254,0.05));
      border: 1px solid rgba(0,242,254,0.35); color: var(--cyan);
      padding: 8px 14px; border-radius: 10px; font-family: 'JetBrains Mono', monospace; font-weight: 700; font-size: 11px;
    }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th {
      text-align: left; font-size: 9px; text-transform: uppercase; letter-spacing: 0.12em;
      color: var(--dim); padding: 10px 8px; border-bottom: 1px solid rgba(255,255,255,0.12);
    }
    td { padding: 12px 8px; border-bottom: 1px solid rgba(255,255,255,0.06); }
    td.mono { color: var(--green); text-align: right; }
    .total-row { font-size: 14px; font-weight: 700; color: var(--cyan); }
    .footer { margin-top: 28px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.08); color: var(--dim); font-size: 10px; }
    @media print { body { padding: 10mm; } }
  </style>
</head>
<body>
  <div class="tag">Nexus Home · Propuesta premium</div>
  <div class="top">
    <div>
      <div class="brand">Casa Inteligente</div>
      <p style="color:var(--muted);margin:6px 0 0;font-size:11px;">Domótica de lujo · Security &amp; Domotics</p>
    </div>
    <div style="text-align:right">
      <div class="badge">PROP-DEMO</div>
      <p class="mono" style="margin-top:10px;color:var(--muted);font-size:11px;">${new Date().toLocaleDateString('es')}</p>
    </div>
  </div>
  <p style="color:var(--muted);margin:0 0 8px">Cliente: <strong style="color:#fff">Villa Aurora S.A.</strong></p>
  <table>
    <thead>
      <tr><th>Concepto</th><th class="mono" style="text-align:right">P. unit.</th><th class="mono" style="text-align:right">Qty</th><th class="mono" style="text-align:right">Subtotal</th></tr>
    </thead>
    <tbody>
      <tr><td>Cámara IP 4K domo</td><td class="mono">120.00</td><td class="mono">4</td><td class="mono">480.00</td></tr>
      <tr><td>NVR 16 canales</td><td class="mono">480.00</td><td class="mono">1</td><td class="mono">480.00</td></tr>
      <tr><td>Instalación certificada</td><td class="mono">650.00</td><td class="mono">1</td><td class="mono">650.00</td></tr>
    </tbody>
  </table>
  <p class="mono total-row" style="text-align:right;margin-top:16px">TOTAL USD 1,610.00 + impuestos según jurisdicción</p>
  <div class="footer">
    Documento generado por Nexus Builder · Interfaz numérica en JetBrains Mono · Resplandor cian marca registrada visual.
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': 'inline; filename="nexus-propuesta-demo.html"',
    },
  });
}
