/**
 * Enlaces y mensajes para previsualizar / compartir documentos legales.
 */

export type DocumentoLegalShare = {
  titulo: string;
  resumen?: string;
  /** URL de vista previa / impresión (HTML). */
  previewUrl: string;
};

export function mensajeCompartirDocumentoLegal(share: DocumentoLegalShare): string {
  const partes = [share.titulo.trim()];
  if (share.resumen?.trim()) partes.push(share.resumen.trim());
  partes.push(share.previewUrl.trim());
  return partes.filter(Boolean).join('\n\n');
}

export function urlCompartirWhatsAppLegal(share: DocumentoLegalShare): string {
  return `https://wa.me/?text=${encodeURIComponent(mensajeCompartirDocumentoLegal(share))}`;
}

export function urlCompartirTelegramLegal(share: DocumentoLegalShare): string {
  const texto = [share.titulo.trim(), share.resumen?.trim()].filter(Boolean).join('\n\n');
  return `https://t.me/share/url?url=${encodeURIComponent(share.previewUrl.trim())}&text=${encodeURIComponent(texto)}`;
}

export function urlCompartirEmailLegal(share: DocumentoLegalShare): string {
  return `mailto:?subject=${encodeURIComponent(share.titulo.trim())}&body=${encodeURIComponent(mensajeCompartirDocumentoLegal(share))}`;
}

/** HTML de previsualización sin auto-print (para iframe / modal). */
export function documentoPreviewHtml(titulo: string, cuerpoHtml: string): string {
  const safeTitle = titulo.replace(/</g, '').replace(/>/g, '');
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8"/>
<title>${safeTitle}</title>
<style>
  body { font-family: "Times New Roman", Times, serif; max-width: 720px; margin: 1.5rem auto; padding: 0 1rem; color: #111; line-height: 1.45; background: #fff; }
  h1 { font-size: 1.35rem; text-align: center; text-transform: uppercase; }
  h2 { font-size: 1.05rem; margin-top: 1.4rem; }
  p { margin: 0.55rem 0; text-align: justify; }
  ul { margin: 0.4rem 0 0.4rem 1.2rem; }
  .meta { font-family: system-ui, sans-serif; font-size: 11px; color: #64748b; margin-bottom: 1rem; text-align: center; }
</style>
</head>
<body>
<p class="meta">Vista previa · ${safeTitle}</p>
${cuerpoHtml}
</body>
</html>`;
}
