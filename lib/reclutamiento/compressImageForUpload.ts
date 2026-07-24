/**
 * Reduce peso de fotos de cámara antes de subir a storage (más rápido y estable en 3G/4G).
 */
export async function compressImageForUpload(
  file: File,
  maxWidth = 1600,
  quality = 0.82,
): Promise<Blob> {
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') {
    return file;
  }
  try {
    const bitmap = await createImageBitmap(file);
    try {
      const scale = Math.min(1, maxWidth / bitmap.width);
      const w = Math.max(1, Math.round(bitmap.width * scale));
      const h = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return file;
      ctx.drawImage(bitmap, 0, 0, w, h);
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((b) => resolve(b), 'image/jpeg', quality);
      });
      if (blob && blob.size > 0 && blob.size < file.size * 0.99) {
        return blob;
      }
      if (blob && blob.size > 0) return blob;
    } finally {
      bitmap.close();
    }
  } catch {
    /* HEIC u otro formato no soportado por createImageBitmap: subir original */
  }
  return file;
}
