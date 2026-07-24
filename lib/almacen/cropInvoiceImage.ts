/**
 * Recorta automáticamente la foto de factura eliminando mesa/fondo alrededor del papel.
 * Solo imágenes; PDF y otros formatos se devuelven sin cambios.
 */
export async function prepareInvoiceDocument(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') {
    return file;
  }
  try {
    return await cropInvoiceImageForUpload(file);
  } catch {
    return file;
  }
}

const ANALYSIS_MAX = 1200;
const JPEG_QUALITY = 0.9;

type BgSample = { r: number; g: number; b: number; lum: number };

type CropBox = { x0: number; y0: number; x1: number; y1: number };

function luminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function median(values: number[]): number {
  if (!values.length) return 128;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 128;
}

function estimateBackground(data: Uint8ClampedArray, w: number, h: number): BgSample {
  const rs: number[] = [];
  const gs: number[] = [];
  const bs: number[] = [];
  const band = Math.max(2, Math.round(Math.min(w, h) * 0.05));

  const push = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    rs.push(data[i] ?? 0);
    gs.push(data[i + 1] ?? 0);
    bs.push(data[i + 2] ?? 0);
  };

  for (let x = 0; x < w; x++) {
    for (let y = 0; y < band; y++) push(x, y);
    for (let y = h - band; y < h; y++) push(x, y);
  }
  for (let y = band; y < h - band; y++) {
    for (let x = 0; x < band; x++) push(x, y);
    for (let x = w - band; x < w; x++) push(x, y);
  }

  const r = median(rs);
  const g = median(gs);
  const b = median(bs);
  return { r, g, b, lum: luminance(r, g, b) };
}

function isContentPixel(r: number, g: number, b: number, bg: BgSample): boolean {
  const lum = luminance(r, g, b);
  const dr = r - bg.r;
  const dg = g - bg.g;
  const db = b - bg.b;
  const dist = Math.sqrt(dr * dr + dg * dg + db * db);
  const lumDiff = Math.abs(lum - bg.lum);

  if (dist > 22 || lumDiff > 16) return true;
  if (bg.lum < 140 && lum > bg.lum + 32) return true;
  if (bg.lum > 180 && lum < bg.lum - 22) return true;
  return false;
}

function findContentBounds(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  bg: BgSample,
): CropBox | null {
  const rowCount = new Uint32Array(h);
  const colCount = new Uint32Array(w);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (isContentPixel(data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0, bg)) {
        rowCount[y]++;
        colCount[x]++;
      }
    }
  }

  const rowThresh = Math.max(2, Math.round(w * 0.012));
  const colThresh = Math.max(2, Math.round(h * 0.012));

  let y0 = 0;
  let y1 = h - 1;
  let x0 = 0;
  let x1 = w - 1;

  while (y0 < h && rowCount[y0] < rowThresh) y0++;
  while (y1 > y0 && rowCount[y1] < rowThresh) y1--;
  while (x0 < w && colCount[x0] < colThresh) x0++;
  while (x1 > x0 && colCount[x1] < colThresh) x1--;

  if (y1 <= y0 || x1 <= x0) return null;
  return { x0, y0, x1: x1 + 1, y1: y1 + 1 };
}

function shouldApplyCrop(box: CropBox, w: number, h: number): boolean {
  const cw = box.x1 - box.x0;
  const ch = box.y1 - box.y0;
  if (cw >= w * 0.97 && ch >= h * 0.97) return false;
  if (cw < w * 0.22 || ch < h * 0.22) return false;
  const margin = Math.min(box.x0, box.y0, w - box.x1, h - box.y1);
  return margin >= Math.max(4, Math.round(Math.min(w, h) * 0.018));
}

export async function cropInvoiceImageForUpload(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  try {
    const { width: w, height: h } = bitmap;
    if (w < 64 || h < 64) return file;

    const scale = Math.min(1, ANALYSIS_MAX / Math.max(w, h));
    const aw = Math.max(1, Math.round(w * scale));
    const ah = Math.max(1, Math.round(h * scale));

    const analysis = document.createElement('canvas');
    analysis.width = aw;
    analysis.height = ah;
    const actx = analysis.getContext('2d', { willReadFrequently: true });
    if (!actx) return file;

    actx.drawImage(bitmap, 0, 0, aw, ah);
    const img = actx.getImageData(0, 0, aw, ah);
    const bg = estimateBackground(img.data, aw, ah);
    const box = findContentBounds(img.data, aw, ah, bg);
    if (!box || !shouldApplyCrop(box, aw, ah)) return file;

    const inset = Math.max(0, Math.round(3 / scale));
    const x0 = Math.max(0, Math.round(box.x0 / scale) - inset);
    const y0 = Math.max(0, Math.round(box.y0 / scale) - inset);
    const x1 = Math.min(w, Math.round(box.x1 / scale) + inset);
    const y1 = Math.min(h, Math.round(box.y1 / scale) + inset);
    const cw = x1 - x0;
    const ch = y1 - y0;
    if (cw < 32 || ch < 32) return file;

    const out = document.createElement('canvas');
    out.width = cw;
    out.height = ch;
    const octx = out.getContext('2d');
    if (!octx) return file;

    octx.fillStyle = '#ffffff';
    octx.fillRect(0, 0, cw, ch);
    octx.drawImage(bitmap, x0, y0, cw, ch, 0, 0, cw, ch);

    const blob = await new Promise<Blob | null>((resolve) => {
      out.toBlob((b) => resolve(b), 'image/jpeg', JPEG_QUALITY);
    });
    if (!blob || blob.size === 0) return file;

    const baseName = file.name.replace(/\.[^.]+$/, '').trim() || 'factura';
    return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
  } finally {
    bitmap.close();
  }
}
