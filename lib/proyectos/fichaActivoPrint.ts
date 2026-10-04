import {
  buildDocumentoPrintToolbarHtml,
  documentoPrintToolbarStyles,
} from '@/lib/contabilidad/documentoPrintShare';
import { PRESUPUESTO_BRAND } from '@/lib/presupuesto/brand';
import { etiquetaCategoriaEquipo } from '@/lib/proyectos/proyectoEquipos';

export type FichaActivoFoto = { label: string; url: string };

export type FichaActivoDatos = {
  categoria: string | null;
  entidadNombre?: string | null;
  nombre: string;
  marca: string | null;
  modelo: string | null;
  serial: string | null;
  cantidad: number;
  ubicacion: string;
  fechaAsignacion: string | null;
  notas: string | null;
  fotos: FichaActivoFoto[];
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtFecha(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('es-VE');
}

export function tituloFichaActivo(d: FichaActivoDatos): string {
  return `Ficha · ${d.nombre}`.trim();
}

export function textoFichaActivo(d: FichaActivoDatos): string {
  const tipo = etiquetaCategoriaEquipo(d.categoria);
  const lineas = [
    `*${tipo.toUpperCase()} — ${PRESUPUESTO_BRAND.nombreLegal}*`,
    d.entidadNombre?.trim() ? `Patrono: ${d.entidadNombre.trim()}` : null,
    `Equipo: ${d.nombre}`,
    d.marca ? `Marca: ${d.marca}` : null,
    d.modelo ? `Modelo: ${d.modelo}` : null,
    d.serial ? `Serial / placa: ${d.serial}` : null,
    `Cantidad: ${d.cantidad}`,
    `Ubicación: ${d.ubicacion || 'Sin ubicación'}`,
    d.fechaAsignacion ? `Fecha de asignación: ${fmtFecha(d.fechaAsignacion)}` : null,
    d.notas ? `Notas: ${d.notas}` : null,
  ];
  return lineas.filter(Boolean).join('\n');
}

export function urlWhatsAppFichaActivo(d: FichaActivoDatos): string {
  return `https://wa.me/?text=${encodeURIComponent(textoFichaActivo(d))}`;
}

export function urlTelegramFichaActivo(d: FichaActivoDatos): string {
  return `https://t.me/share/url?url=${encodeURIComponent('https://casainteligente.company')}&text=${encodeURIComponent(textoFichaActivo(d))}`;
}

export function urlEmailFichaActivo(d: FichaActivoDatos): string {
  return `mailto:?subject=${encodeURIComponent(tituloFichaActivo(d))}&body=${encodeURIComponent(textoFichaActivo(d))}`;
}

export function buildFichaActivoPrintHtml(d: FichaActivoDatos): string {
  const tipo = etiquetaCategoriaEquipo(d.categoria);
  const filas: [string, string][] = [
    ['Tipo', tipo],
    ['Patrono', d.entidadNombre?.trim() || '—'],
    ['Equipo', d.nombre],
    ['Marca', d.marca?.trim() || '—'],
    ['Modelo', d.modelo?.trim() || '—'],
    ['Serial / placa', d.serial?.trim() || '—'],
    ['Cantidad', String(d.cantidad)],
    ['Ubicación', d.ubicacion?.trim() || 'Sin ubicación'],
    ['Fecha de asignación', fmtFecha(d.fechaAsignacion)],
    ['Notas', d.notas?.trim() || '—'],
  ];

  const filasHtml = filas
    .map(
      ([k, v]) =>
        `<tr><th>${escapeHtml(k)}</th><td>${escapeHtml(v)}</td></tr>`,
    )
    .join('');

  const fotosHtml = d.fotos.length
    ? `<div class="fotos">${d.fotos
        .map(
          (f) =>
            `<figure><img src="${escapeHtml(f.url)}" alt="${escapeHtml(f.label)}" /><figcaption>${escapeHtml(f.label)}</figcaption></figure>`,
        )
        .join('')}</div>`
    : '<p class="muted">Sin fotos de costados.</p>';

  const toolbar = buildDocumentoPrintToolbarHtml({
    titulo: tituloFichaActivo(d),
    resumen: textoFichaActivo(d),
    url: '',
  });

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(tituloFichaActivo(d))}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: system-ui, Segoe UI, sans-serif; margin: 0; background: #f1f5f9; color: #0f172a; }
    ${documentoPrintToolbarStyles()}
    .sheet { max-width: 210mm; margin: 0 auto 32px; padding: 22px 26px; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
    .brand { font-size: 11px; letter-spacing: .12em; text-transform: uppercase; color: #64748b; margin: 0 0 4px; }
    h1 { font-size: 22px; margin: 0 0 2px; }
    .sub { color: #64748b; margin: 0 0 18px; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 18px; }
    th, td { border: 1px solid #e2e8f0; padding: 8px 10px; text-align: left; vertical-align: top; font-size: 13px; }
    th { width: 34%; background: #f8fafc; color: #475569; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; }
    .fotos { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    figure { margin: 0; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; background: #0f172a; }
    figure img { width: 100%; height: 180px; object-fit: cover; display: block; }
    figcaption { font-size: 11px; padding: 6px 8px; color: #475569; background: #f8fafc; }
    .muted { color: #64748b; font-size: 13px; }
    .pie { margin-top: 18px; font-size: 10px; color: #94a3b8; text-align: right; }
    @media print {
      body { background: #fff; }
      .sheet { box-shadow: none; margin: 0; max-width: none; padding: 0; }
      figure img { height: 160px; }
    }
  </style>
</head>
<body>
  ${toolbar}
  <main class="sheet">
    <p class="brand">${escapeHtml(PRESUPUESTO_BRAND.nombreLegal)} · RIF ${escapeHtml(PRESUPUESTO_BRAND.rifEmpresa)}</p>
    <h1>${escapeHtml(d.nombre)}</h1>
    <p class="sub">${escapeHtml(tipo)}${d.entidadNombre?.trim() ? ` · ${escapeHtml(d.entidadNombre.trim())}` : ''}</p>
    <table>${filasHtml}</table>
    <h2 style="font-size:14px;margin:0 0 10px;">Fotos por costado</h2>
    ${fotosHtml}
    <p class="pie">Generado ${escapeHtml(new Date().toLocaleString('es-VE'))}</p>
  </main>
</body>
</html>`;
}

export function abrirFichaActivoImpresion(d: FichaActivoDatos): void {
  const html = buildFichaActivoPrintHtml(d);
  const w = window.open('', '_blank');
  if (!w) {
    throw new Error('El navegador bloqueó la ventana. Permita ventanas emergentes para imprimir.');
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
}
