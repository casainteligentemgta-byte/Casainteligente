/** Descarga un PDF binario (no window.print). Sirve en móvil para compartir el archivo. */
export async function descargarPdfCliente(url: string, filename: string): Promise<void> {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error || `No se pudo descargar el PDF (${res.status}).`);
  }
  const blob = await res.blob();
  if (blob.type && !blob.type.includes('pdf') && blob.type !== 'application/octet-stream') {
    throw new Error('El servidor no devolvió un PDF.');
  }
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 2_000);
}
