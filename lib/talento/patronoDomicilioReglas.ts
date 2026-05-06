/**
 * Reglas de domicilio del patrono: para Casa Inteligente el domicilio contractual
 * es el domicilio de la empresa según registro mercantil (`domicilio_empresa`), no el fiscal genérico.
 */

function strOpt(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length ? t : null;
}

/**
 * Detecta la entidad matriz Casa Inteligente (razón social / nombre legal).
 * Comparación insensible a mayúsculas y tildes.
 */
export function esEntidadCasaInteligente(
  nombreLegal: string | null | undefined,
  nombre: string | null | undefined,
): boolean {
  const raw = `${nombreLegal ?? ''} ${nombre ?? ''}`.trim();
  if (!raw) return false;
  const n = raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
  return n.includes('casa inteligente');
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
 * Domicilio del patrono para textos legales: fiscal vs. domicilio social en registro.
 * Casa Inteligente → primero registro (`domicilio_empresa`), luego fiscal.
 */
export function domicilioPatronoParaEntidad(row: {
  nombre_legal?: string | null;
  nombre?: string | null;
  domicilio_fiscal?: string | null;
  direccion_fiscal?: string | null;
  registro_mercantil?: unknown;
}): string | null {
  const domRm = domicilioEmpresaDesdeRegistroMercantil(row.registro_mercantil);
  const fiscal =
    strOpt(row.domicilio_fiscal) ?? strOpt(row.direccion_fiscal) ?? null;
  if (esEntidadCasaInteligente(row.nombre_legal, row.nombre)) {
    return domRm ?? fiscal;
  }
  return fiscal ?? domRm;
}
