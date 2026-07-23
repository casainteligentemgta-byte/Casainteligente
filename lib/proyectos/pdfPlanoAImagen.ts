/** Renderiza la primera página de un PDF a data-URL PNG (solo cliente / browser). */

export async function pdfSourceToDataUrl(
  source: ArrayBuffer | Uint8Array | string,
  opts?: { page?: number; maxWidth?: number },
): Promise<string> {
  const pageNum = opts?.page ?? 1;
  const maxWidth = opts?.maxWidth ?? 1600;

  const pdfjs = await import('pdfjs-dist');

  // Worker desde CDN (evita líos de bundling en Next).
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

  const loadingTask = pdfjs.getDocument(
    typeof source === 'string'
      ? { url: source, withCredentials: false }
      : { data: source instanceof ArrayBuffer ? new Uint8Array(source) : source },
  );

  const pdf = await loadingTask.promise;
  const page = await pdf.getPage(Math.min(Math.max(1, pageNum), pdf.numPages));

  const unscaled = page.getViewport({ scale: 1 });
  const scale = Math.min(2.5, maxWidth / unscaled.width);
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo crear canvas para el PDF');

  // pdfjs-dist tipa RenderParameters sin `canvas` en esta versión; el runtime lo acepta vía canvasContext.
  await page.render({ canvasContext: ctx, viewport } as Parameters<typeof page.render>[0]).promise;

  return canvas.toDataURL('image/png');
}

export function esPdfFile(file: File): boolean {
  return (
    file.type === 'application/pdf' ||
    file.name.toLowerCase().endsWith('.pdf')
  );
}

export function esPdfUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const path = url.split('?')[0] ?? url;
    return /\.pdf$/i.test(path) || path.toLowerCase().includes('/pdf');
  } catch {
    return false;
  }
}
