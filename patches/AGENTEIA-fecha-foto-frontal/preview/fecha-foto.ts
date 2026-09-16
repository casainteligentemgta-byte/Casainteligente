/**
 * Extrae la fecha de captura de una foto (EXIF DateTimeOriginal / DateTime)
 * o, si no hay EXIF, la fecha del archivo (lastModified).
 */

const EXIF_DATETIME_ORIGINAL = 0x9003;
const EXIF_DATETIME = 0x0132;

function parseExifDateTime(raw: string): string | null {
  // EXIF: "YYYY:MM:DD HH:MM:SS"
  const m = raw
    .trim()
    .match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (!m) return null;
  const iso = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function readExifAscii(
  view: DataView,
  tiffOffset: number,
  littleEndian: boolean,
  entryOffset: number,
  count: number
): string | null {
  try {
    if (count <= 4) {
      const bytes = [];
      for (let i = 0; i < count; i++) {
        bytes.push(view.getUint8(entryOffset + 8 + i));
      }
      return String.fromCharCode(...bytes.filter((b) => b !== 0)).trim() || null;
    }
    const valueOffset = view.getUint32(entryOffset + 8, littleEndian);
    const start = tiffOffset + valueOffset;
    if (start < 0 || start + count > view.byteLength) return null;
    const bytes = [];
    for (let i = 0; i < count; i++) {
      bytes.push(view.getUint8(start + i));
    }
    return String.fromCharCode(...bytes.filter((b) => b !== 0)).trim() || null;
  } catch {
    return null;
  }
}

function readExifDateFromJpeg(buffer: ArrayBuffer): string | null {
  const view = new DataView(buffer);
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return null;

  let offset = 2;
  while (offset + 4 <= view.byteLength) {
    if (view.getUint8(offset) !== 0xff) break;
    const marker = view.getUint8(offset + 1);
    const size = view.getUint16(offset + 2);
    if (size < 2) break;

    // APP1
    if (marker === 0xe1) {
      const start = offset + 4;
      if (start + 6 > view.byteLength) break;
      const isExif =
        view.getUint8(start) === 0x45 &&
        view.getUint8(start + 1) === 0x78 &&
        view.getUint8(start + 2) === 0x69 &&
        view.getUint8(start + 3) === 0x66 &&
        view.getUint8(start + 4) === 0x00 &&
        view.getUint8(start + 5) === 0x00;
      if (!isExif) {
        offset += 2 + size;
        continue;
      }

      const tiffOffset = start + 6;
      if (tiffOffset + 8 > view.byteLength) break;
      const byte0 = view.getUint8(tiffOffset);
      const byte1 = view.getUint8(tiffOffset + 1);
      const littleEndian = byte0 === 0x49 && byte1 === 0x49;
      const bigEndian = byte0 === 0x4d && byte1 === 0x4d;
      if (!littleEndian && !bigEndian) break;
      if (view.getUint16(tiffOffset + 2, littleEndian) !== 0x002a) break;

      const ifd0Offset = view.getUint32(tiffOffset + 4, littleEndian);
      let ifdOffset = tiffOffset + ifd0Offset;
      let dateTime: string | null = null;
      let dateTimeOriginal: string | null = null;

      for (let pass = 0; pass < 2; pass++) {
        if (ifdOffset + 2 > view.byteLength) break;
        const entryCount = view.getUint16(ifdOffset, littleEndian);
        let exifIfdPointer: number | null = null;

        for (let i = 0; i < entryCount; i++) {
          const entry = ifdOffset + 2 + i * 12;
          if (entry + 12 > view.byteLength) break;
          const tag = view.getUint16(entry, littleEndian);
          const type = view.getUint16(entry + 2, littleEndian);
          const count = view.getUint32(entry + 4, littleEndian);
          if (type !== 2) {
            // Exif IFD pointer (tag 0x8769) is LONG
            if (tag === 0x8769 && type === 4) {
              exifIfdPointer = view.getUint32(entry + 8, littleEndian);
            }
            continue;
          }
          const ascii = readExifAscii(
            view,
            tiffOffset,
            littleEndian,
            entry,
            count
          );
          if (!ascii) continue;
          if (tag === EXIF_DATETIME_ORIGINAL) {
            dateTimeOriginal = parseExifDateTime(ascii);
          } else if (tag === EXIF_DATETIME) {
            dateTime = parseExifDateTime(ascii);
          }
        }

        if (dateTimeOriginal) return dateTimeOriginal;
        if (pass === 0 && exifIfdPointer != null) {
          ifdOffset = tiffOffset + exifIfdPointer;
          continue;
        }
        break;
      }

      return dateTimeOriginal ?? dateTime;
    }

    // SOS — image data starts; no more metadata
    if (marker === 0xda) break;
    offset += 2 + size;
  }

  return null;
}

function toIsoDateOnly(iso: string): string {
  return iso.slice(0, 10);
}

/**
 * Devuelve la fecha de la foto en ISO (YYYY-MM-DDTHH:mm:ss.sssZ).
 * Prioriza EXIF; si no hay, usa lastModified del File.
 */
export async function extractImageCaptureDate(
  file: File
): Promise<string | null> {
  if (!file || file.size <= 0) return null;

  try {
    if (
      file.type === "image/jpeg" ||
      file.type === "image/jpg" ||
      /\.jpe?g$/i.test(file.name)
    ) {
      const buffer = await file.arrayBuffer();
      const fromExif = readExifDateFromJpeg(buffer);
      if (fromExif) return fromExif;
    }
  } catch {
    // fallback abajo
  }

  if (file.lastModified && Number.isFinite(file.lastModified)) {
    const d = new Date(file.lastModified);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }

  return null;
}

/** Fecha civil YYYY-MM-DD a partir del ISO de captura. */
export async function extractImageCaptureDateOnly(
  file: File
): Promise<string | null> {
  const iso = await extractImageCaptureDate(file);
  return iso ? toIsoDateOnly(iso) : null;
}

/** Formato legible para la UI (es-VE). */
export function formatFechaFotoInspeccion(
  isoOrDateOnly: string | null | undefined
): string | null {
  if (!isoOrDateOnly?.trim()) return null;
  const raw = isoOrDateOnly.trim();
  const d = raw.length <= 10 ? new Date(`${raw}T12:00:00`) : new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("es-VE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(d);
}
