/** Tipos de gasto alineados al menú / leyendas CCO V4. */
export const CCO_TIPOS_GASTO = [
  'ADMINISTRACIÓN DELEGADA',
  'MATERIALES',
  'CONTRATISTA',
  'EQUIPOS',
  'INSUMOS',
  'MANO DE OBRA',
  'TRANSPORTE',
  'PERMISOLOGIA',
  'PROYECTO',
] as const;

export type CcoTipoGasto = (typeof CCO_TIPOS_GASTO)[number];

/** Colores categorical (barras apiladas sub-capítulo) — como captura V4. */
export const CCO_TIPO_COLOR_CAT: Record<CcoTipoGasto, string> = {
  'ADMINISTRACIÓN DELEGADA': '#93C5FD',
  MATERIALES: '#FDE68A',
  CONTRATISTA: '#F87171',
  EQUIPOS: '#4ADE80',
  INSUMOS: '#6D28D9',
  'MANO DE OBRA': '#C026D3',
  TRANSPORTE: '#2DD4BF',
  PERMISOLOGIA: '#F472B6',
  PROYECTO: '#9F1239',
};

/** Colores secuelas azul→púrpura (dona total por tipo). */
export const CCO_TIPO_COLOR_PIE: Record<CcoTipoGasto, string> = {
  MATERIALES: '#1E3A8A',
  'MANO DE OBRA': '#2563EB',
  'ADMINISTRACIÓN DELEGADA': '#3B82F6',
  CONTRATISTA: '#4F46E5',
  EQUIPOS: '#7C3AED',
  TRANSPORTE: '#A855F7',
  INSUMOS: '#C084FC',
  PROYECTO: '#D946EF',
  PERMISOLOGIA: '#DB2777',
};

export function clasificarTipoGasto(proveedor: string): CcoTipoGasto {
  const u = proveedor.toUpperCase();
  if (/ADMIN|DELEGAD|HONORARIO/.test(u)) return 'ADMINISTRACIÓN DELEGADA';
  if (/NOMINA|NÓMINA|SUELDO|OBRERO|MANO\s*DE\s*OBRA|PLANILLA/.test(u)) return 'MANO DE OBRA';
  if (/TRANSPORT|FLETE|LOGIST/.test(u)) return 'TRANSPORTE';
  if (/EQUIPO|MAQUIN|ALQUILER|DIMAQUIN/.test(u)) return 'EQUIPOS';
  if (/CONTRATISTA|SERVICIO\s|INSTAL/.test(u)) return 'CONTRATISTA';
  if (/PERMISO|TRAMITE|TRÁMITE/.test(u)) return 'PERMISOLOGIA';
  if (/INSUMO|QUIMIC|QUÍMIC/.test(u)) return 'INSUMOS';
  if (/PROYECTO|DISEÑO|DISEÑO|GERENC/.test(u)) return 'PROYECTO';
  return 'MATERIALES';
}

function normKey(s: string): string {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Resuelve un texto a tipo CCO si coincide (PERMISOLOGÍA → PERMISOLOGIA). */
export function resolverTipoGastoTexto(texto: string): CcoTipoGasto | null {
  const n = normKey(texto);
  if (!n) return null;
  for (const t of CCO_TIPOS_GASTO) {
    if (normKey(t) === n) return t;
  }
  if (n.includes('ADMINISTRACION') || n.includes('DELEGADA')) return 'ADMINISTRACIÓN DELEGADA';
  if (n.includes('MANO DE OBRA') || n === 'MO' || n === 'MANO OBRA') return 'MANO DE OBRA';
  if (n.includes('PERMISO')) return 'PERMISOLOGIA';
  if (n.includes('MATERIAL')) return 'MATERIALES';
  if (n.includes('CONTRAT')) return 'CONTRATISTA';
  if (n.includes('EQUIPO')) return 'EQUIPOS';
  if (n.includes('INSUMO')) return 'INSUMOS';
  if (n.includes('TRANSPORT')) return 'TRANSPORTE';
  if (n.includes('PROYECTO')) return 'PROYECTO';
  return null;
}

export type CcoJerarquiaParsed = {
  tipo: CcoTipoGasto | null;
  capitulo: string | null;
  subcapitulo: string | null;
};

/**
 * Extrae TIPO / CAPÍTULO / SUB-CAPÍTULO desde descripciones del CSV maestro
 * (formatos: "TIPO · CAP · SUB", "TIPO · CAP: detalle", "CAP · SUB").
 */
export function parseJerarquiaDesdeTexto(texto: string): CcoJerarquiaParsed {
  const raw = String(texto ?? '').trim();
  if (!raw) return { tipo: null, capitulo: null, subcapitulo: null };

  let tipo: CcoTipoGasto | null = null;
  let capitulo: string | null = null;
  let subcapitulo: string | null = null;

  // "TIPO · CAP · SUB: detalle" o "TIPO · CAP: detalle"
  const colonMatch = raw.match(/^(.+?)\s*:\s*(.+)$/);
  if (colonMatch) {
    const leftParts = colonMatch[1]
      .split(/\s*[·|]\s*/)
      .map((p) => p.trim())
      .filter(Boolean);
    if (leftParts.length >= 1) {
      const t0 = resolverTipoGastoTexto(leftParts[0]);
      if (t0) {
        tipo = t0;
        if (leftParts[1]) capitulo = leftParts[1].trim().toUpperCase() || null;
        if (leftParts[2]) subcapitulo = leftParts[2].trim().toUpperCase() || null;
      } else if (leftParts.length >= 2) {
        capitulo = leftParts[0].trim().toUpperCase() || null;
        subcapitulo = leftParts[1].trim().toUpperCase() || null;
      }
    }
    // Si no vino sub en el prefijo, intentar primera palabra del detalle
    if (!subcapitulo) {
      const resto = colonMatch[2].trim();
      const subCand = resto.split(/[\s·|,;—–-]+/)[0]?.trim() ?? '';
      if (subCand && subCand.length >= 3 && subCand.length <= 28) {
        subcapitulo = subCand.toUpperCase();
      }
    }
    return { tipo, capitulo, subcapitulo };
  }

  const parts = raw
    .split(/\s*[·|]\s*/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length >= 1) {
    const t0 = resolverTipoGastoTexto(parts[0]);
    if (t0) {
      tipo = t0;
      if (parts[1]) capitulo = parts[1].replace(/:.*$/, '').trim().toUpperCase() || null;
      if (parts[2]) subcapitulo = parts[2].replace(/:.*$/, '').trim().toUpperCase() || null;
      return { tipo, capitulo, subcapitulo };
    }
  }

  if (parts.length >= 2) {
    capitulo = parts[0].replace(/:.*$/, '').trim().toUpperCase() || null;
    subcapitulo = parts[1].replace(/:.*$/, '').trim().toUpperCase() || null;
    return { tipo, capitulo, subcapitulo };
  }

  // Último recurso: si todo el texto es un tipo conocido
  tipo = resolverTipoGastoTexto(raw);
  return { tipo, capitulo, subcapitulo };
}

export function etiquetaCorta(s: string, max = 22): string {
  const t = String(s ?? '').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

/** Escala teal sunburst / treemap (oscuro = mayor costo). */
export function colorTealPorValor(valor: number, max: number): string {
  const t = max > 0 ? Math.min(1, Math.max(0, valor / max)) : 0;
  // dark teal #004D40 → light #C8E6E0
  const r = Math.round(0x00 + (0xc8 - 0x00) * (1 - t));
  const g = Math.round(0x4d + (0xe6 - 0x4d) * (1 - t));
  const b = Math.round(0x40 + (0xe0 - 0x40) * (1 - t));
  return `rgb(${r},${g},${b})`;
}

export function fmtUsdCorto(n: number): string {
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
}
