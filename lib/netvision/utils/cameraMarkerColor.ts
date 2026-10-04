/** Color del pin, la línea y el chip de nombre de cada cámara. */

export const CAM_MARKER_COLORES = [
  'cian',
  'verde',
  'naranja',
  'azul',
  'blanco',
  'magenta',
] as const

export type CamMarkerColor = (typeof CAM_MARKER_COLORES)[number]

export const DEFAULT_CAM_MARKER_COLOR: CamMarkerColor = 'cian'

export const CAM_MARKER_HEX: Record<CamMarkerColor, string> = {
  cian: '#22d3ee',
  verde: '#39ff20',
  naranja: '#ff8c00',
  azul: '#00a8ff',
  blanco: '#f8fafc',
  magenta: '#ff2bd6',
}

const CAM_MARKER_SET = new Set<string>(CAM_MARKER_COLORES)

export function normalizeCamMarkerColor(raw: unknown): CamMarkerColor {
  const t = String(raw ?? '')
    .trim()
    .toLowerCase()
  if (t === 'cyan') return 'cian'
  if (t === 'amarillo') return 'naranja'
  if (CAM_MARKER_SET.has(t)) return t as CamMarkerColor
  return DEFAULT_CAM_MARKER_COLOR
}

export function camMarkerHex(raw: unknown): string {
  return CAM_MARKER_HEX[normalizeCamMarkerColor(raw)]
}

/** Contraste del aro: blanco sobre color, oscuro sobre blanco. */
export function camMarkerRing(hex: string): string {
  return hex === CAM_MARKER_HEX.blanco ? '#0f172a' : '#ffffff'
}

export function nextCamMarkerColor(index: number): CamMarkerColor {
  const i = Number.isFinite(index) ? Math.max(0, Math.floor(index)) : 0
  return CAM_MARKER_COLORES[i % CAM_MARKER_COLORES.length]!
}

export const CAM_MARKER_CHIPS: Array<{ id: CamMarkerColor; label: string; hex: string }> =
  CAM_MARKER_COLORES.map((id) => ({
    id,
    label: id === 'azul' ? 'Azul eléctrico' : id[0]!.toUpperCase() + id.slice(1),
    hex: CAM_MARKER_HEX[id],
  }))
