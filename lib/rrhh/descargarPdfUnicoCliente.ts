import { apiUrl, assertHttpOrigin } from '@/lib/http/apiUrl';

/**
 * Descarga el PDF único (lote) de contratos express seleccionados.
 * Abre el blob en nueva pestaña para imprimir o descarga el archivo.
 */
export async function descargarPdfUnicoContratosExpress(
  expressIds: string[],
  opts?: { abrirParaImprimir?: boolean; nombreArchivo?: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ids = Array.from(new Set(expressIds.map((s) => s.trim()).filter(Boolean)));
  if (ids.length === 0) {
    return { ok: false, error: 'Seleccione al menos un contrato.' };
  }

  const originErr = assertHttpOrigin();
  if (originErr) {
    return { ok: false, error: originErr };
  }

  const res = await fetch(apiUrl('/api/rrhh/contrato-pdf/lote'), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ express_ids: ids }),
  });

  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    return {
      ok: false,
      error: j.error ?? `No se pudo generar el PDF único (${res.status}).`,
    };
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const filename =
    opts?.nombreArchivo?.trim() ||
    `contratos-obra-${new Date().toISOString().slice(0, 10)}.pdf`;

  try {
    if (opts?.abrirParaImprimir) {
      const w = window.open(url, '_blank', 'noopener,noreferrer');
      if (!w) {
        // Fallback: descarga directa
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.rel = 'noopener';
        document.body.appendChild(a);
        a.click();
        a.remove();
        return { ok: false, error: 'Permite ventanas emergentes para abrir el PDF.' };
      }
      w.addEventListener('load', () => {
        try {
          w.print();
        } catch {
          /* el visor puede bloquear print() */
        }
      });
    } else {
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
  } finally {
    // Liberar después de un margen para que el navegador abra el blob
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  return { ok: true };
}
