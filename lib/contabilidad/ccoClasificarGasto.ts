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
