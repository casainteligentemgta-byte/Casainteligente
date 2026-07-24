/**
 * Origen público para enlaces de registro (WhatsApp, copiar).
 * — Hoja de vida Gaceta: `/registro?need=<uuid de recruitment_needs>`
 * — Flujo legado proyecto/cargo: `/registro?prj=<uuid ci_proyectos>&role=…`
 * Prioridad: NEXT_PUBLIC_REGISTRO_ORIGEN → NEXT_PUBLIC_BASE_URL → NEXT_PUBLIC_APP_URL → producción por defecto.
 */
export function publicRegistroOrigin(): string {
  const raw =
    (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_REGISTRO_ORIGEN?.trim()) ||
    (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_BASE_URL?.trim()) ||
    (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_APP_URL?.trim()) ||
    '';
  const base = raw.replace(/\/$/, '');
  return base || 'https://casainteligente.company';
}
