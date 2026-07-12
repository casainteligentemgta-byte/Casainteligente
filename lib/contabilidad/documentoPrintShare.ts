export type DocumentoPrintShare = {
  titulo: string;
  resumen: string;
  url: string;
};

function escapeHtmlAttr(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Texto plano para WhatsApp, Telegram y cuerpo de correo. */
export function mensajeCompartirDocumento(share: DocumentoPrintShare): string {
  const partes = [share.titulo.trim()];
  if (share.resumen.trim()) partes.push(share.resumen.trim());
  partes.push(share.url.trim());
  return partes.filter(Boolean).join('\n\n');
}

export function urlCompartirWhatsApp(share: DocumentoPrintShare): string {
  return `https://wa.me/?text=${encodeURIComponent(mensajeCompartirDocumento(share))}`;
}

export function urlCompartirTelegram(share: DocumentoPrintShare): string {
  const texto = [share.titulo.trim(), share.resumen.trim()].filter(Boolean).join('\n\n');
  return `https://t.me/share/url?url=${encodeURIComponent(share.url.trim())}&text=${encodeURIComponent(texto)}`;
}

export function urlCompartirEmail(share: DocumentoPrintShare): string {
  return `mailto:?subject=${encodeURIComponent(share.titulo.trim())}&body=${encodeURIComponent(mensajeCompartirDocumento(share))}`;
}

const TOOLBAR_STYLES = `
    .toolbar { max-width: 297mm; margin: 0 auto; padding: 16px 20px; display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
    .toolbar button, .toolbar a.btn-share { font-size: 13px; font-weight: 600; padding: 10px 14px; border-radius: 8px; border: none; cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; gap: 6px; }
    .btn-print { background: #0f172a; color: #fff; }
    .btn-hint { background: #6d28d9; color: #fff; }
    .btn-wa { background: #16a34a; color: #fff; }
    .btn-tg { background: #0284c7; color: #fff; }
    .btn-mail { background: #475569; color: #fff; }
    .toolbar-note { flex: 1 1 100%; font-size: 12px; color: #64748b; margin: 0; line-height: 1.4; }
    @media print { .toolbar { display: none !important; } }
`;

export function documentoPrintToolbarStyles(): string {
  return TOOLBAR_STYLES;
}

export function buildDocumentoPrintToolbarHtml(share?: DocumentoPrintShare | null): string {
  const shareBlock =
    share?.url?.trim()
      ? `<a class="btn-share btn-wa" href="${escapeHtmlAttr(urlCompartirWhatsApp(share))}" target="_blank" rel="noopener noreferrer">WhatsApp</a>
    <a class="btn-share btn-tg" href="${escapeHtmlAttr(urlCompartirTelegram(share))}" target="_blank" rel="noopener noreferrer">Telegram</a>
    <a class="btn-share btn-mail" href="${escapeHtmlAttr(urlCompartirEmail(share))}">Email</a>`
      : '';

  const note = share?.url?.trim()
    ? `<p class="toolbar-note">Comparta el enlace en la app. Para adjuntar el archivo PDF, use «Imprimir» → «Guardar como PDF» y envíe el documento.</p>`
    : '';

  return `<div class="toolbar">
    <button type="button" class="btn-print" onclick="window.print()">Imprimir</button>
    <button type="button" class="btn-hint" onclick="alert('En el diálogo de impresión elija «Guardar como PDF» o «Microsoft Print to PDF».')">Guardar como PDF</button>
    ${shareBlock}
    ${note}
  </div>`;
}
