import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire('/opt/npm-tools/node_modules/');
const { chromium } = require('playwright');
const AQUI = path.dirname(new URL(import.meta.url).pathname);
const DIST = process.env.VISOR_SALIDA ?? path.join(os.tmpdir(), 'ci-visor');
const tipos = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const srv = http.createServer((req, res) => {
  const f = path.join(DIST, decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/$/, '/index.html'));
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': tipos[path.extname(f)] ?? 'application/octet-stream' });
  res.end(fs.readFileSync(f));
}).listen(0);
const puerto = srv.address().port;
const WORKER_PDF = '/home/claude/.npm-global/lib/node_modules/pdfjs-dist/build/pdf.worker.min.mjs';
const destino = process.argv[2] ?? path.join(os.tmpdir(), 'ci-visor-capturas');
fs.mkdirSync(destino, { recursive: true });
const pedidas = (process.argv[3] ?? 'lista,modal,ficha,nuevo,editar').split(',');
const temas = (process.argv[4] ?? 'dark,light').split(',');
const sufijo = process.argv[5] ?? '';
const nav = await chromium.launch();
for (const t of temas) {
  for (const p of pedidas) {
    const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: t });
    const pag = await ctx.newPage();
    const errores = [];
    pag.on('pageerror', (e) => errores.push(String(e)));
    pag.on('console', (m) => m.type() === 'error' && errores.push(m.text()));
    const pantalla =
      p === 'modal' ? 'lista' : p === 'producto-detalle' || p === 'productos-corregir' ? 'productos' : p === 'importar-pdf' ? 'importar-lista' : p;
    // «importar-pdf»: sube un PDF de prueba (VISOR_PDF) y espera a que se lea. El lector de PDF
    // pide su «worker» a internet; aquí se le entrega el archivo local.
    if (p === 'importar-pdf') {
      await pag.route(/unpkg\.com\/pdfjs-dist.*pdf\.worker/, (ruta) =>
        ruta.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(WORKER_PDF) }),
      );
    }
    await pag.goto(`http://127.0.0.1:${puerto}/?p=${pantalla}&t=${t}${sufijo}`);
    await pag.waitForTimeout(900);
    if (p === 'modal') { await pag.getByRole('button', { name: 'Ver' }).first().click(); await pag.waitForTimeout(600); }
    // «producto-detalle»: la hoja que se abre al tocar un producto. «productos-corregir»: filtro «Sin precio».
    if (p === 'producto-detalle') { await pag.getByText('Cerradura inteligente de ejemplo').first().click(); await pag.waitForTimeout(600); }
    if (p === 'productos-corregir') { await pag.getByRole('button', { name: /Repetidos/ }).click(); await pag.waitForTimeout(400); }
    if (p === 'importar-pdf') {
      await pag.setInputFiles('[data-ilp-csv]', process.env.VISOR_PDF);
      await pag.waitForSelector('[data-ilp-csv-ok], [data-ilp-csv-error]', { timeout: 20000 });
      await pag.waitForTimeout(700);
    }
    const hoja = p === 'modal' || p === 'producto-detalle';
    await pag.screenshot({ path: path.join(destino, `${p}-${t}.png`), fullPage: !hoja });
    if (errores.length) console.log(p, t, 'ERRORES:', errores.slice(0, 3).join(' | ').slice(0, 400));
    await ctx.close();
  }
}
await nav.close(); srv.close();
console.log('capturas en', destino);
