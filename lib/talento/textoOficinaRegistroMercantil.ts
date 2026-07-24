/**
 * Texto que sigue a «Oficina de …» en contratos (ej. mercantil segundo… estado).
 * Si el valor guardado no empieza por «Registro Mercantil», se antepone por compatibilidad.
 */
const TEXTO_EJEMPLO =
  'Registro Mercantil Segundo de la Circunscripción Judicial del Estado Nueva Esparta';

export function textoTrasLaPalabraOficinaDe(raw: string | null | undefined): string {
  const t = (raw ?? '').trim();
  if (!t) return TEXTO_EJEMPLO;
  if (/^registro\s+mercantil/i.test(t)) return t;
  return `Registro Mercantil ${t}`;
}
