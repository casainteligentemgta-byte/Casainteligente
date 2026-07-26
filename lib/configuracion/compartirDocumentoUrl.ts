/**
 * Comparte un documento ya cargado (URL pública) o un File pendiente de subir.
 * Prioriza Web Share con archivo; si no, URL; fallback: copiar enlace / WhatsApp.
 */

export type CompartirDocumentoResult =
  | { ok: true; modo: 'archivo' | 'url' | 'copiado' | 'whatsapp' }
  | { ok: false; cancelado?: boolean; error: string };

function nombreSeguro(nombre: string, fallback = 'documento.pdf'): string {
  const t = nombre.trim().replace(/[^\w.\-áéíóúñÁÉÍÓÚÑ ()]+/gi, '_').slice(0, 80);
  return t || fallback;
}

async function fetchComoFile(url: string, nombre: string): Promise<File | null> {
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) return null;
    const blob = await res.blob();
    const type = blob.type || 'application/pdf';
    const base = nombreSeguro(nombre, type.includes('image') ? 'documento.jpg' : 'documento.pdf');
    return new File([blob], base, { type });
  } catch {
    return null;
  }
}

export async function compartirDocumentoUrl(opts: {
  url?: string | null;
  file?: File | null;
  titulo: string;
  texto?: string;
}): Promise<CompartirDocumentoResult> {
  const titulo = opts.titulo.trim() || 'Documento';
  const texto = (opts.texto ?? titulo).trim();
  const url = (opts.url ?? '').trim();
  let file = opts.file ?? null;

  if (!file && url) {
    file = await fetchComoFile(url, titulo);
  }

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    if (
      file &&
      typeof navigator.canShare === 'function' &&
      navigator.canShare({ files: [file] })
    ) {
      try {
        await navigator.share({ title: titulo, text: texto, files: [file] });
        return { ok: true, modo: 'archivo' };
      } catch (e) {
        if (e instanceof Error && e.name === 'AbortError') {
          return { ok: false, cancelado: true, error: 'Cancelado' };
        }
      }
    }

    if (url) {
      try {
        await navigator.share({ title: titulo, text: texto, url });
        return { ok: true, modo: 'url' };
      } catch (e) {
        if (e instanceof Error && e.name === 'AbortError') {
          return { ok: false, cancelado: true, error: 'Cancelado' };
        }
      }
    }
  }

  if (url) {
    try {
      await navigator.clipboard.writeText(url);
      return { ok: true, modo: 'copiado' };
    } catch {
      /* fall through */
    }
    try {
      const wa = `https://wa.me/?text=${encodeURIComponent(`${texto}\n${url}`)}`;
      window.open(wa, '_blank', 'noopener,noreferrer');
      return { ok: true, modo: 'whatsapp' };
    } catch {
      return { ok: false, error: 'No se pudo compartir ni copiar el enlace.' };
    }
  }

  if (file) {
    return {
      ok: false,
      error: 'Guarda el documento primero para poder compartirlo.',
    };
  }

  return { ok: false, error: 'No hay documento para compartir.' };
}
