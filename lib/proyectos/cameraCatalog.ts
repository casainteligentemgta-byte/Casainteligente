/** Catálogo de cámaras CCTV con FOV horizontal declarado por fabricante. */

export type CameraBrand = 'Hikvision' | 'EZVIZ';

export interface CameraModel {
  id: string;
  brand: CameraBrand;
  model: string;
  /** Ancho efectivo del sensor en mm (h). */
  sensorSizeHorizontal: number;
  /** Llave: "2.8mm", valor: ángulo horizontal real (°). */
  lenses: Record<string, number>;
}

export const cameraCatalog: CameraModel[] = [
  {
    id: 'hik-ds-2cd2043g2-i',
    brand: 'Hikvision',
    model: 'DS-2CD2043G2-I (4MP Bullet)',
    sensorSizeHorizontal: 4.8, // Sensor ~1/3"
    lenses: {
      '2.8mm': 98,
      '4mm': 78,
    },
  },
  {
    id: 'ezviz-h3c-2k',
    brand: 'EZVIZ',
    model: 'H3c (2K)',
    sensorSizeHorizontal: 5.37, // Sensor 1/2.7"
    lenses: {
      '2.8mm': 104,
      '4mm': 82,
    },
  },
  {
    id: 'hik-ds-2ce16d0t-irpf',
    brand: 'Hikvision',
    model: 'DS-2CE16D0T-IRPF (Análoga)',
    sensorSizeHorizontal: 4.8, // Sensor 1/2.8"
    lenses: {
      '2.8mm': 82.2,
      '3.6mm': 79.1,
      '6mm': 52,
    },
  },
];

export const DEFAULT_CAMERA_CATALOG_ID = cameraCatalog[0]!.id;
export const DEFAULT_LENS_KEY = '2.8mm';

export function findCameraModel(id: string | null | undefined): CameraModel | null {
  if (!id) return null;
  return cameraCatalog.find((c) => c.id === id) ?? null;
}

export function lensKeys(model: CameraModel): string[] {
  return Object.keys(model.lenses);
}

export function defaultLensKey(model: CameraModel): string {
  const keys = lensKeys(model);
  return keys.includes(DEFAULT_LENS_KEY) ? DEFAULT_LENS_KEY : (keys[0] ?? DEFAULT_LENS_KEY);
}

/** Ángulo FOV del catálogo; cae al teórico si la lente no está listada. */
export function fovFromCatalog(modelId: string, lensKey: string): number | null {
  const model = findCameraModel(modelId);
  if (!model) return null;
  const declared = model.lenses[lensKey];
  if (typeof declared === 'number' && Number.isFinite(declared)) return declared;
  const focalMm = parseFloat(lensKey);
  if (!Number.isFinite(focalMm) || focalMm <= 0) return null;
  return fovTeorico(model.sensorSizeHorizontal, focalMm);
}

/** FOV horizontal teórico: 2·atan(h / (2·f)) en grados. */
export function fovTeorico(sensorHorizontalMm: number, focalMm: number): number {
  if (sensorHorizontalMm <= 0 || focalMm <= 0) return 0;
  return (2 * Math.atan(sensorHorizontalMm / (2 * focalMm)) * 180) / Math.PI;
}

export function etiquetaCatalogo(model: CameraModel): string {
  return `${model.brand} · ${model.model}`;
}
