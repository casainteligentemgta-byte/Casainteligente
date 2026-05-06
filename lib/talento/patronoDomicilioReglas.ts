/**
 * Domicilio del patrono: primero el domicilio de la empresa en registro mercantil
 * (`registro_mercantil.domicilio_empresa`); si falta, domicilio fiscal de la entidad.
 */

function strOpt(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length ? t : null;
}

/** `domicilio_empresa` dentro de `ci_entidades.registro_mercantil` (jsonb o JSON string). */
export function domicilioEmpresaDesdeRegistroMercantil(raw: unknown): string | null {
  if (raw == null) return null;
  let o: unknown = raw;
  if (typeof raw === 'string') {
    try {
      o = JSON.parse(raw) as unknown;
    } catch {
      return null;
    }
  }
  if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
  return strOpt((o as { domicilio_empresa?: unknown }).domicilio_empresa);
}

/**
 * Domicilio del patrono: registro mercantil primero, luego columnas fiscales de `ci_entidades`.
 */
export function domicilioPatronoParaEntidad(row: {
  nombre_legal?: string | null;
  nombre?: string | null;
  domicilio_fiscal?: string | null;
  direccion_fiscal?: string | null;
  registro_mercantil?: unknown;
}): string | null {
  const domRm = domicilioEmpresaDesdeRegistroMercantil(row.registro_mercantil);
  const fiscal = strOpt(row.domicilio_fiscal) ?? strOpt(row.direccion_fiscal) ?? null;
  return domRm ?? fiscal;
}
