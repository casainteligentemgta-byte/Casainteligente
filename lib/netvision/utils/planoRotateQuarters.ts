/** Cuartos de giro horario (0–3) desde el archivo original. */
export function clampRotateQuarters(value: unknown): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : 0
  return ((n % 4) + 4) % 4
}

export function nextRotateQuarters(
  current: number | undefined,
  dir: 'cw' | 'ccw',
): number {
  const q = clampRotateQuarters(current)
  return (q + (dir === 'cw' ? 1 : 3)) % 4
}
