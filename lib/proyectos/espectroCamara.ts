/** Modelo y utilidades del espectro de visión de cámara sobre plano. */

import {
  DEFAULT_CAMERA_CATALOG_ID,
  DEFAULT_LENS_KEY,
  findCameraModel,
  fovFromCatalog,
} from '@/lib/proyectos/cameraCatalog';

export type Punto2D = { x: number; y: number };

export type CamaraPlano = {
  id: string;
  x: number;
  y: number;
  /** Alcance del cono en píxeles del lienzo. */
  radius: number;
  /** Apertura FOV en grados (del catálogo o ajuste manual). */
  angle: number;
  /** Dirección de apuntado en grados (0 = este, sentido horario en Konva). */
  rotation: number;
  label?: string;
  /** Id en `cameraCatalog` (Hikvision / EZVIZ). */
  catalogId?: string;
  /** Lente seleccionada, p. ej. "2.8mm". */
  lensKey?: string;
  /** Marca/modelo para reportes (denormalizado del catálogo). */
  brand?: string;
  modelName?: string;
};

/** Escala del plano: metros reales por píxel del lienzo. */
export type EscalaPlano = {
  metrosPorPixel: number;
  puntoA: Punto2D;
  puntoB: Punto2D;
  metrosReferencia: number;
};

export const ALCANCE_MIN_M = 0.3;
export const ALCANCE_MAX_M = 40;
export const ALCANCE_MIN_PX = 12;
export const ALCANCE_MAX_PX = 800;

/** Presets FOV habituales (lente ~2.8 mm ≈ 103°, pasillos ≈ 90°). */
export const FOV_PRESETS_DEG = [90, 103] as const;
export const FOV_MIN_DEG = 20;
export const FOV_MAX_DEG = 160;

/** Tamaño físico del icono de cámara sobre el plano (~18 cm). */
export const ICONO_CAMARA_TAMANO_M = 0.18;
/** Ancho de diseño del icono Konva (unidades locales). */
export const ICONO_CAMARA_DISENO_W = 10;

export function clampFov(deg: number): number {
  if (!Number.isFinite(deg)) return FOV_PRESETS_DEG[1];
  return Math.min(FOV_MAX_DEG, Math.max(FOV_MIN_DEG, deg));
}

/** Escala del icono en espacio del lienzo según metros/píxel del plano. */
export function escalaIconoCamara(escala: EscalaPlano | null | undefined): number {
  if (!escala || !(escala.metrosPorPixel > 0)) return 1.15;
  const targetPx = metrosAPx(ICONO_CAMARA_TAMANO_M, escala);
  return Math.max(0.4, Math.min(5, targetPx / ICONO_CAMARA_DISENO_W));
}

const defaultModel = findCameraModel(DEFAULT_CAMERA_CATALOG_ID);
const defaultFov =
  fovFromCatalog(DEFAULT_CAMERA_CATALOG_ID, DEFAULT_LENS_KEY) ?? FOV_PRESETS_DEG[1];

export const CAMARA_DEFAULT: Omit<CamaraPlano, 'id' | 'x' | 'y'> = {
  radius: 80,
  angle: defaultFov,
  rotation: -40,
  catalogId: DEFAULT_CAMERA_CATALOG_ID,
  lensKey: DEFAULT_LENS_KEY,
  brand: defaultModel?.brand,
  modelName: defaultModel?.model,
};

/** Konva Wedge dibuja desde `rotation` con barrido `angle`; centramos el FOV en la dirección de apuntado. */
export function wedgeRotation(camara: Pick<CamaraPlano, 'rotation' | 'angle'>): number {
  return camara.rotation - camara.angle / 2;
}

/** Punto en el borde del arco (centro del FOV) para el asa de rotación. */
export function puntoAsaRotacion(camara: CamaraPlano): { x: number; y: number } {
  const rad = (camara.rotation * Math.PI) / 180;
  return {
    x: camara.x + Math.cos(rad) * camara.radius,
    y: camara.y + Math.sin(rad) * camara.radius,
  };
}

export function anguloDesdePuntos(
  origenX: number,
  origenY: number,
  targetX: number,
  targetY: number,
): number {
  return (Math.atan2(targetY - origenY, targetX - origenX) * 180) / Math.PI;
}

export function distanciaPx(a: Punto2D, b: Punto2D): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function calcularEscala(
  puntoA: Punto2D,
  puntoB: Punto2D,
  metrosReferencia: number,
): EscalaPlano | null {
  const d = distanciaPx(puntoA, puntoB);
  if (d < 2 || !(metrosReferencia > 0) || !Number.isFinite(metrosReferencia)) return null;
  return {
    metrosPorPixel: metrosReferencia / d,
    puntoA,
    puntoB,
    metrosReferencia,
  };
}

export function pxAMetros(px: number, escala: EscalaPlano | null | undefined): number | null {
  if (!escala || !(escala.metrosPorPixel > 0)) return null;
  return px * escala.metrosPorPixel;
}

export function metrosAPx(metros: number, escala: EscalaPlano): number {
  return metros / escala.metrosPorPixel;
}

export function formatDistancia(px: number, escala: EscalaPlano | null | undefined): string {
  const m = pxAMetros(px, escala);
  if (m == null) return `${Math.round(px)} px`;
  if (m >= 10) return `${m.toFixed(1)} m`;
  return `${m.toFixed(2)} m`;
}

export function alcanceMaxPx(escala: EscalaPlano | null | undefined): number {
  if (!escala) return ALCANCE_MAX_PX;
  return Math.max(ALCANCE_MAX_PX, Math.ceil(metrosAPx(ALCANCE_MAX_M, escala)));
}

export function alcanceMinPx(escala: EscalaPlano | null | undefined): number {
  if (!escala) return ALCANCE_MIN_PX;
  return Math.max(8, Math.floor(metrosAPx(ALCANCE_MIN_M, escala)));
}

export function nuevaCamara(partial?: Partial<CamaraPlano>): CamaraPlano {
  return {
    id: crypto.randomUUID(),
    x: 200,
    y: 200,
    ...CAMARA_DEFAULT,
    ...partial,
  };
}

/** Completa catálogo/FOV en cámaras guardadas sin esos campos. */
export function normalizarCamara(c: CamaraPlano): CamaraPlano {
  const catalogId = c.catalogId ?? CAMARA_DEFAULT.catalogId!;
  const lensKey = c.lensKey ?? CAMARA_DEFAULT.lensKey!;
  const model = findCameraModel(catalogId);
  const fromCat = fovFromCatalog(catalogId, lensKey);
  return {
    ...c,
    catalogId,
    lensKey,
    brand: c.brand ?? model?.brand ?? CAMARA_DEFAULT.brand,
    modelName: c.modelName ?? model?.model ?? CAMARA_DEFAULT.modelName,
    angle:
      typeof c.angle === 'number' && Number.isFinite(c.angle) && c.catalogId
        ? c.angle
        : (fromCat ?? c.angle ?? CAMARA_DEFAULT.angle),
  };
}

/** Ids de storage: en /prueba-camara usa local/prueba. */
export function espectroStorageIds(
  proyectoId?: string,
  planoId?: string,
): { proyectoId: string; planoId: string } {
  return {
    proyectoId: proyectoId?.trim() || 'local',
    planoId: planoId?.trim() || 'prueba',
  };
}

export function storageKeyCamaras(proyectoId: string, planoId: string): string {
  return `ci-plano-camaras-v1:${proyectoId}:${planoId}`;
}

export function storageKeyEscala(proyectoId: string, planoId: string): string {
  return `ci-plano-escala-v1:${proyectoId}:${planoId}`;
}

export function cargarCamarasLocal(proyectoId: string, planoId: string): CamaraPlano[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(storageKeyCamaras(proyectoId, planoId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CamaraPlano[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function guardarCamarasLocal(
  proyectoId: string,
  planoId: string,
  camaras: CamaraPlano[],
): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(storageKeyCamaras(proyectoId, planoId), JSON.stringify(camaras));
}

export function cargarEscalaLocal(proyectoId: string, planoId: string): EscalaPlano | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(storageKeyEscala(proyectoId, planoId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as EscalaPlano;
    if (
      !parsed ||
      !(parsed.metrosPorPixel > 0) ||
      !(parsed.metrosReferencia > 0) ||
      !parsed.puntoA ||
      !parsed.puntoB
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function guardarEscalaLocal(
  proyectoId: string,
  planoId: string,
  escala: EscalaPlano | null,
): void {
  if (typeof window === 'undefined') return;
  const key = storageKeyEscala(proyectoId, planoId);
  if (!escala) {
    localStorage.removeItem(key);
    return;
  }
  localStorage.setItem(key, JSON.stringify(escala));
}
