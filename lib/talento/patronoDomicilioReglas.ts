/**
 * Domicilio del patrono: primero el domicilio de la empresa en registro mercantil
 * (`registro_mercantil.domicilio_empresa`); si falta, domicilio fiscal de la entidad.
 */

function strOpt(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length ? t : null;
}

/** Acepta string o número (JSON / formularios). */
function strDesdeCampo(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === 'string') {
    const t = v.trim();
    return t.length ? t : null;
  }
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return null;
}

function normalizarClave(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function parseRegistroMercantilObj(raw: unknown): Record<string, unknown> | null {
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
  return o as Record<string, unknown>;
}

/**
 * Domicilio dentro de `ci_entidades.registro_mercantil` (jsonb o JSON string).
 * Acepta variantes históricas de clave para evitar placeholders en contratos.
 */
export function domicilioEmpresaDesdeRegistroMercantil(raw: unknown): string | null {
  const r = parseRegistroMercantilObj(raw);
  if (!r) return null;
  const directo =
    strOpt(r.domicilio_empresa) ??
    strOpt(r.domicilioFiscal) ??
    strOpt(r.domicilio_fiscal) ??
    strOpt(r.direccion_fiscal) ??
    strOpt(r.direccion) ??
    null;
  if (directo) return directo;

  for (const [k, v] of Object.entries(r)) {
    const nk = normalizarClave(k);
    const esDomicilio = nk.includes('domicilio') || nk.includes('direccion');
    const esEmpresaRegistro = nk.includes('empresa') || nk.includes('registro');
    if (!esDomicilio || !esEmpresaRegistro) continue;
    const val = strOpt(v as string);
    if (val) return val;
  }
  return null;
}

/**
 * Solo el campo `domicilio_empresa` del RM (vía / urbanización), sin otros fallbacks del JSON.
 * Sirve para la línea «domiciliada en…» del PDF sin repetir municipio/estado ya mostrados aparte.
 */
export function domicilioEmpresaSoloCampoRegistro(raw: unknown): string | null {
  const r = parseRegistroMercantilObj(raw);
  if (!r) return null;
  return strDesdeCampo(r.domicilio_empresa);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Intenta extraer sector, municipio y estado de un texto libre (datos viejos en `domicilio_empresa` o dirección fiscal).
 */
export function inferirUbicacionDesdeTextoLibre(text: string | null | undefined): UbicacionEmpresaSegunRegistroMercantil {
  const vacio: UbicacionEmpresaSegunRegistroMercantil = { estado: null, municipio: null, sector: null };
  const t = (text ?? '').trim();
  if (!t) return vacio;

  let municipio: string | null = null;
  let estado: string | null = null;
  let sector: string | null = null;

  const mSec = t.match(/(?:^|[,.;\s])Sector\s+([^,.;\n]+?)(?=[,.;]|$|\s+Municipio|\s+Estado)/i);
  if (mSec) sector = mSec[1].trim();

  const mMunEst = t.match(/Municipio\s+(.+?)\s+del\s+Estado\s+(.+)$/i);
  if (mMunEst) {
    municipio = mMunEst[1].trim();
    estado = mMunEst[2].replace(/[.,;]+$/, '').trim();
  } else {
    const mMun = t.match(/(?:^|[,.;\s])Municipio\s+([^,.;\n]+?)(?=[,.;]|$|\s+Estado|\s+Sector)/i);
    if (mMun) municipio = mMun[1].trim();
    const mEdo = t.match(/(?:^|[,.;\s])Estado\s+([^,.;\n]+?)(?=[,.;]|$|\s+Municipio|\s+Sector)/i);
    if (mEdo) estado = mEdo[1].trim();
  }

  return { estado, municipio, sector };
}

function mergeUbicacion(
  a: UbicacionEmpresaSegunRegistroMercantil,
  b: UbicacionEmpresaSegunRegistroMercantil,
): UbicacionEmpresaSegunRegistroMercantil {
  return {
    sector: a.sector ?? b.sector ?? null,
    municipio: a.municipio ?? b.municipio ?? null,
    estado: a.estado ?? b.estado ?? null,
  };
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

/** Ubicación administrativa del domicilio social en RM (captura en UI: estado → municipio → sector; en documento: sector → municipio → estado). */
export type UbicacionEmpresaSegunRegistroMercantil = {
  estado: string | null;
  municipio: string | null;
  sector: string | null;
};

export function ubicacionEmpresaDesdeRegistroMercantil(raw: unknown): UbicacionEmpresaSegunRegistroMercantil {
  const vacio: UbicacionEmpresaSegunRegistroMercantil = { estado: null, municipio: null, sector: null };
  const r = parseRegistroMercantilObj(raw);
  if (!r) return vacio;
  return {
    estado:
      strDesdeCampo(r.domicilio_estado_registro) ??
      strDesdeCampo(r.estado_domicilio_registro) ??
      strDesdeCampo(r.estado_empresa_rm) ??
      strDesdeCampo(r.estado_empresa) ??
      null,
    municipio:
      strDesdeCampo(r.domicilio_municipio_registro) ??
      strDesdeCampo(r.municipio_domicilio_registro) ??
      strDesdeCampo(r.municipio_empresa_rm) ??
      strDesdeCampo(r.municipio_empresa) ??
      null,
    sector:
      strDesdeCampo(r.domicilio_sector_registro) ??
      strDesdeCampo(r.sector_domicilio_registro) ??
      strDesdeCampo(r.sector_empresa_rm) ??
      strDesdeCampo(r.sector_empresa) ??
      null,
  };
}

/**
 * Ubicación para comparecencia: campos estructurados del RM + inferencia desde textos libres
 * (`domicilio_empresa`, dirección fiscal) cuando aún no se migraron a los tres campos del formulario Mercantil.
 */
export function ubicacionEmpresaResueltaParaPdf(
  raw: unknown,
  fiscal?: { direccion_fiscal?: string | null; domicilio_fiscal?: string | null } | null,
): UbicacionEmpresaSegunRegistroMercantil {
  const base = ubicacionEmpresaDesdeRegistroMercantil(raw);
  const r = parseRegistroMercantilObj(raw);
  const textoRm = r ? strDesdeCampo(r.domicilio_empresa) : null;
  let u = mergeUbicacion(base, inferirUbicacionDesdeTextoLibre(textoRm));
  const domF = fiscal ? strDesdeCampo(fiscal.domicilio_fiscal) : null;
  const dirF = fiscal ? strDesdeCampo(fiscal.direccion_fiscal) : null;
  u = mergeUbicacion(u, inferirUbicacionDesdeTextoLibre(domF));
  u = mergeUbicacion(u, inferirUbicacionDesdeTextoLibre(dirF));
  return u;
}

function stripUbicacionRedundante(linea: string, u: UbicacionEmpresaSegunRegistroMercantil): string {
  let s = linea.trim();
  if (!s) return s;
  if (u.municipio && u.estado) {
    const escMun = escapeRegExp(u.municipio);
    const escEdo = escapeRegExp(u.estado);
    s = s.replace(new RegExp(`Municipio\\s+${escMun}\\s+del\\s+Estado\\s+${escEdo}`, 'gi'), ' ').trim();
  }
  if (u.municipio) {
    s = s.replace(new RegExp(`Municipio\\s+${escapeRegExp(u.municipio)}`, 'gi'), ' ').trim();
  }
  if (u.estado) {
    s = s.replace(new RegExp(`(?:del\\s+)?Estado\\s+${escapeRegExp(u.estado)}`, 'gi'), ' ').trim();
  }
  if (u.sector) {
    s = s.replace(new RegExp(`Sector\\s+${escapeRegExp(u.sector)}`, 'gi'), ' ').trim();
  }
  return s.replace(/^[,.\s;]+|[,.\s;]+$/g, '').replace(/\s+/g, ' ');
}

/**
 * Texto de la línea «domiciliada en…» en comparecencia: prioriza `domicilio_empresa` del RM;
 * si el texto repite municipio/estado ya resueltos en `ubicacionEmpresaResueltaParaPdf`, se limpia.
 */
export function domicilioLineaComparecenciaPatrono(row: {
  registro_mercantil?: unknown;
  domicilio_fiscal?: string | null;
  direccion_fiscal?: string | null;
}): string | null {
  const u = ubicacionEmpresaResueltaParaPdf(row.registro_mercantil, {
    direccion_fiscal: strOpt(row.direccion_fiscal),
    domicilio_fiscal: strOpt(row.domicilio_fiscal),
  });
  const soloRm = domicilioEmpresaSoloCampoRegistro(row.registro_mercantil);
  const fallback = domicilioPatronoParaEntidad({
    nombre_legal: null,
    nombre: null,
    domicilio_fiscal: row.domicilio_fiscal ?? null,
    direccion_fiscal: row.direccion_fiscal ?? null,
    registro_mercantil: row.registro_mercantil,
  });
  const linea = soloRm ?? fallback;
  if (!linea) return null;
  const cleaned = stripUbicacionRedundante(linea, u).trim();
  return cleaned.length ? cleaned : linea.trim();
}
