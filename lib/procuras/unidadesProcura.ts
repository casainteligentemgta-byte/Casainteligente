import {
  UNIDADES_MEDIDA_DEFAULT,
  fusionarUnidadesMedida,
  normalizarCodigoUnidad,
  type UnidadMedidaOpcion,
} from '@/lib/almacen/unidadesMedidaDefault';

/** Unidades adicionales frecuentes en procuras / obra. */
const UNIDADES_PROCURA_EXTRA: UnidadMedidaOpcion[] = [
  { code: 'PZA', name: 'Pieza' },
  { code: 'JGO', name: 'Juego' },
  { code: 'SET', name: 'Set' },
  { code: 'MLT', name: 'Mililitro' },
  { code: 'CM', name: 'Centímetro' },
  { code: 'MM', name: 'Milímetro' },
  { code: 'IN', name: 'Pulgada' },
  { code: 'FT', name: 'Pie (ft)' },
  { code: 'TON', name: 'Tonelada' },
  { code: 'LB', name: 'Libra' },
  { code: 'QQ', name: 'Quintal' },
  { code: 'BARR', name: 'Barril' },
  { code: 'BID', name: 'Bidón' },
  { code: 'TAM', name: 'Tamaco / cubeta' },
  { code: 'PLG', name: 'Pliego' },
  { code: 'HOJ', name: 'Hoja' },
  { code: 'RES', name: 'Resma' },
  { code: 'BLK', name: 'Block / bloque' },
  { code: 'VAR', name: 'Varilla' },
  { code: 'TRM', name: 'Tramo' },
  { code: 'VIA', name: 'Viaje' },
  { code: 'SERV', name: 'Servicio' },
  { code: 'LOTE', name: 'Lote' },
  { code: 'GLOBAL', name: 'Global' },
];

export const UNIDADES_PROCURA: UnidadMedidaOpcion[] = fusionarUnidadesMedida(
  UNIDADES_MEDIDA_DEFAULT,
  UNIDADES_PROCURA_EXTRA,
);

/** Sinónimos → código canónico del catálogo. */
const ALIAS_UNIDAD_PROCURA: Record<string, string> = {
  UND: 'UND',
  UNID: 'UND',
  UNIDAD: 'UND',
  UNIDADES: 'UND',
  U: 'UND',
  PZA: 'PZA',
  PIEZA: 'PZA',
  PIEZAS: 'PZA',
  PAR: 'PAR',
  PARES: 'PAR',
  M: 'M',
  MT: 'M',
  MTS: 'M',
  METRO: 'M',
  METROS: 'M',
  ML: 'M',
  'M.L.': 'M',
  M2: 'M2',
  'M²': 'M2',
  MT2: 'M2',
  MTS2: 'M2',
  METRO2: 'M2',
  'METRO CUADRADO': 'M2',
  'METROS CUADRADOS': 'M2',
  M3: 'M3',
  'M³': 'M3',
  MT3: 'M3',
  MTS3: 'M3',
  'METRO CUBICO': 'M3',
  'METRO CÚBICO': 'M3',
  'METROS CUBICOS': 'M3',
  'METROS CÚBICOS': 'M3',
  KG: 'KG',
  KILO: 'KG',
  KILOS: 'KG',
  KILOGRAMO: 'KG',
  KILOGRAMOS: 'KG',
  TON: 'TON',
  T: 'TON',
  TONELADA: 'TON',
  TONELADAS: 'TON',
  LB: 'LB',
  LIBRA: 'LB',
  LIBRAS: 'LB',
  QQ: 'QQ',
  QUINTAL: 'QQ',
  QUINTALES: 'QQ',
  L: 'L',
  LT: 'L',
  LTS: 'L',
  LITRO: 'L',
  LITROS: 'L',
  GL: 'GL',
  GAL: 'GL',
  GALON: 'GL',
  GALÓN: 'GL',
  GALONES: 'GL',
  MLT: 'MLT',
  MILILITRO: 'MLT',
  MILILITROS: 'MLT',
  CM: 'CM',
  CENTIMETRO: 'CM',
  CENTÍMETRO: 'CM',
  MM: 'MM',
  MILIMETRO: 'MM',
  MILÍMETRO: 'MM',
  IN: 'IN',
  INCH: 'IN',
  INCHES: 'IN',
  PUL: 'IN',
  PULG: 'IN',
  PULGADA: 'IN',
  PULGADAS: 'IN',
  FT: 'FT',
  PIE: 'FT',
  PIES: 'FT',
  SAC: 'SAC',
  SACO: 'SAC',
  SACOS: 'SAC',
  BOL: 'BOL',
  BOLSA: 'BOL',
  BOLSAS: 'BOL',
  CAJ: 'CAJ',
  CAJA: 'CAJ',
  CAJAS: 'CAJ',
  ROL: 'ROL',
  ROLLO: 'ROL',
  ROLLOS: 'ROL',
  TUB: 'TUB',
  TUBO: 'TUB',
  TUBOS: 'TUB',
  BARR: 'BARR',
  BARRIL: 'BARR',
  BARRILES: 'BARR',
  BID: 'BID',
  BIDON: 'BID',
  BIDÓN: 'BID',
  TAM: 'TAM',
  TAMACO: 'TAM',
  CUBETA: 'TAM',
  HR: 'HR',
  HORA: 'HR',
  HORAS: 'HR',
  H: 'HR',
  DIA: 'DIA',
  DÍA: 'DIA',
  DIAS: 'DIA',
  DÍAS: 'DIA',
  JGO: 'JGO',
  JUEGO: 'JGO',
  SET: 'SET',
  BLK: 'BLK',
  BLOCK: 'BLK',
  BLOQUE: 'BLK',
  BLOQUES: 'BLK',
  VAR: 'VAR',
  VARILLA: 'VAR',
  VARILLAS: 'VAR',
  TRM: 'TRM',
  TRAMO: 'TRM',
  TRAMOS: 'TRM',
  VIA: 'VIA',
  VIAJE: 'VIA',
  VIAJES: 'VIA',
  SERV: 'SERV',
  SERVICIO: 'SERV',
  SERVICIOS: 'SERV',
  LOTE: 'LOTE',
  LOTES: 'LOTE',
  GLOBAL: 'GLOBAL',
  GLB: 'GLOBAL',
};

const CODIGOS_VALIDOS = new Set(UNIDADES_PROCURA.map((u) => u.code));

function limpiarTokenUnidad(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\./g, '');
}

export function normalizarUnidadProcura(raw: string | null | undefined): string {
  const t = limpiarTokenUnidad(String(raw ?? ''));
  if (!t) return 'UND';
  const alias = ALIAS_UNIDAD_PROCURA[t];
  if (alias) return alias;
  const code = normalizarCodigoUnidad(t).slice(0, 16);
  if (CODIGOS_VALIDOS.has(code)) return code;
  return code || 'UND';
}

export function etiquetaUnidadProcura(code: string | null | undefined): string {
  const c = normalizarUnidadProcura(code);
  const hit = UNIDADES_PROCURA.find((u) => u.code === c);
  return hit ? `${hit.code} — ${hit.name}` : c;
}

export type CantidadUnidadProcura =
  | { kind: 'solo_cantidad'; cantidad: number }
  | { kind: 'completo'; cantidad: number; unidad: string };

export function parseCantidadUnidadProcura(texto: string): CantidadUnidadProcura | null {
  const t = texto.trim();
  if (!t) return null;
  const parts = t.split(/\s+/);
  const cantidad = Number(parts[0]?.replace(',', '.'));
  if (!Number.isFinite(cantidad) || cantidad <= 0) return null;

  const resto = parts.slice(1).join(' ').trim();
  if (!resto) {
    return { kind: 'solo_cantidad', cantidad };
  }

  return {
    kind: 'completo',
    cantidad,
    unidad: normalizarUnidadProcura(resto),
  };
}

const UNIDAD_PAGE_SIZE = 8;

export function tecladoUnidadesProcuraPagina(
  prefix: string,
  page = 0,
): { inline_keyboard: Array<Array<{ text: string; callback_data: string }>> } {
  const totalPages = Math.max(1, Math.ceil(UNIDADES_PROCURA.length / UNIDAD_PAGE_SIZE));
  const safePage = Math.min(Math.max(0, page), totalPages - 1);
  const slice = UNIDADES_PROCURA.slice(
    safePage * UNIDAD_PAGE_SIZE,
    safePage * UNIDAD_PAGE_SIZE + UNIDAD_PAGE_SIZE,
  );

  const rows: Array<Array<{ text: string; callback_data: string }>> = slice.map((u) => [
    {
      text: `${u.code} · ${u.name}`,
      callback_data: `${prefix}${u.code}`,
    },
  ]);

  if (totalPages > 1) {
    const nav: Array<{ text: string; callback_data: string }> = [];
    if (safePage > 0) {
      nav.push({ text: '◀', callback_data: `${prefix}pg:${safePage - 1}` });
    }
    nav.push({ text: `${safePage + 1}/${totalPages}`, callback_data: `${prefix}pg:${safePage}` });
    if (safePage < totalPages - 1) {
      nav.push({ text: '▶', callback_data: `${prefix}pg:${safePage + 1}` });
    }
    rows.push(nav);
  }

  return { inline_keyboard: rows };
}
