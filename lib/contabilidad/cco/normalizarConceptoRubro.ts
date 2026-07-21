/**
 * Normaliza descripciones de gasto a conceptos oficiales de Lista de Rubros V4.
 * Heurística por palabras clave (sin NLP); si no hay match, usa el texto limpio.
 */

import type { CcoTipoGasto } from '@/lib/contabilidad/ccoClasificarGasto';

function limpia(raw: string): string {
  return String(raw ?? '')
    .replace(/\s*\(\d+(?:\.\d+)?%\)\s*$/, '')
    .replace(/^RUBRO:\s*[^|\n]+\|\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const REGLAS: { re: RegExp; concepto: string }[] = [
  { re: /CONCRETO\s*PREMEZCL|PREMEZCLADO|HORMIGON\s*PREMEZ/i, concepto: 'CONCRETO PREMEZCLADO' },
  { re: /\bCEMENTO\b/i, concepto: 'CEMENTO' },
  { re: /\b(ACERO|CABILLA|CABILLAS|VARILLA)/i, concepto: 'ACERO Y CABILLAS' },
  { re: /HORCON|VIGA\s*DE\s*MADERA|VIGAS\s*DE\s*MADERA/i, concepto: 'HORCONES Y VIGAS DE MADERA' },
  { re: /PIEDRA\s*NEGRA/i, concepto: 'PIEDRA NEGRA' },
  { re: /ENCOFRAD|MADERA\s*ESTRUCTURAL/i, concepto: 'MADERA ESTRUCTURAL / ENCOFRADOS (VARIOS)' },
  { re: /\bBLOQUE/i, concepto: 'BLOQUES DE CONCRETO' },
  { re: /ADITIVO|FIBRA.*(CONCRETO|HORMIGON)/i, concepto: 'ADITIVOS Y FIBRAS (CONCRETO)' },
  { re: /TUBER|PLOMER|PVC\b|CODO|TEE\b/i, concepto: 'TUBERÍAS Y PLOMERÍA' },
  { re: /WATER\s*STOP|WATERSTOP/i, concepto: 'JUNTAS WATER STOP' },
  { re: /ARENA/i, concepto: 'ARENA' },
  { re: /GRAVA|PIEDRA\s*PICADA|PIEDE\s*PICADA/i, concepto: 'GRAVA / PIEDRA PICADA' },
  { re: /ANDAMIO|PUNTAL/i, concepto: 'ANDAMIOS, PUNTALES Y ENCOFRADOS (ALQUILER)' },
  { re: /RETROEXCAV/i, concepto: 'RETROEXCAVADORA (ALQUILER)' },
  { re: /CAMI[OÓ]N|VEH[IÍ]CULO/i, concepto: 'CAMIÓN / VEHÍCULO (ALQUILER)' },
  { re: /ROTOMARTIL/i, concepto: 'ROTOMARTILLOS (ALQUILER)' },
  { re: /FIORI|AUTOHORMIGONERA/i, concepto: 'AUTOHORMIGONERA FIORI (ALQUILER)' },
  { re: /COMPACTADOR|RANA\b/i, concepto: 'COMPACTADORA (RANA) (ALQUILER)' },
  { re: /MEZCLADOR|TROMPO/i, concepto: 'MEZCLADORA (TROMPO) (ALQUILER)' },
  { re: /VIBRADOR/i, concepto: 'VIBRADOR DE CONCRETO (ALQUILER)' },
  { re: /TANQUE.*AGUA|AGUA.*TANQUE/i, concepto: 'TANQUES DE AGUA (ALQUILER)' },
  { re: /HERRAMIENTA|EQUIPO\s*MENOR/i, concepto: 'HERRAMIENTAS MENORES / EQUIPO MENOR' },
  { re: /N[OÓ]MINA|OBRERO|PLANILLA|PERSONAL/i, concepto: 'NÓMINAS DE PERSONAL / OBREROS' },
  { re: /LIQUIDACI[OÓ]N|PRESTACI[OÓ]N/i, concepto: 'LIQUIDACIONES Y PRESTACIONES SOCIALES' },
  { re: /BOTE\s*DE\s*ESCOMBR|ESCOMBRO/i, concepto: 'BOTE DE ESCOMBROS (FLETES)' },
  { re: /FLETE|TRANSPORT/i, concepto: 'SERVICIOS DE TRANSPORTE / FLETES' },
  { re: /PERMISO|TR[AÁ]MITE|DERECHO/i, concepto: 'TRÁMITES, PERMISOS Y DERECHOS' },
  { re: /PROYECTO|PROFESIONAL|DISE[NÑ]O|GERENC/i, concepto: 'SERVICIOS PROFESIONALES / PROYECTOS' },
  { re: /INSUMO|CONSUMIBLE|GUANTE/i, concepto: 'INSUMOS GENERALES / CONSUMIBLES' },
];

export function normalizarConceptoRubro(
  descripcion: string,
  opts?: { tipo?: CcoTipoGasto | string; proveedor?: string },
): string {
  const tipo = String(opts?.tipo ?? '').toUpperCase();
  const proveedor = String(opts?.proveedor ?? '').trim();
  const d = limpia(descripcion);

  if (tipo === 'CONTRATISTA' || tipo === 'CONTRATO') {
    const nombre = proveedor || d || 'SIN NOMBRE';
    return `SUBCONTRATISTA: ${nombre.toUpperCase()}`;
  }

  if (tipo === 'ADMINISTRACIÓN DELEGADA' || tipo === 'ADMINISTRACION DELEGADA') {
    return 'ADMINISTRACIÓN DELEGADA';
  }

  for (const r of REGLAS) {
    if (r.re.test(d) || r.re.test(proveedor)) return r.concepto;
  }

  if (!d) {
    if (proveedor) return proveedor.toUpperCase().slice(0, 80);
    return 'SIN CONCEPTO';
  }

  return d.toUpperCase().slice(0, 80);
}

export type RubroSeccionMeta = {
  key: string;
  titulo: string;
  icon: string;
  tipos: string[];
};

/** Secciones numeradas del resumen consolidado V4. */
export const RUBRO_SECCIONES: RubroSeccionMeta[] = [
  { key: 'MATERIALES', titulo: 'MATERIALES', icon: '🧱', tipos: ['MATERIALES'] },
  { key: 'EQUIPOS', titulo: 'EQUIPOS', icon: '⚙️', tipos: ['EQUIPOS'] },
  {
    key: 'MANO_OBRA',
    titulo: 'MANO DE OBRA Y SERVICIOS',
    icon: '👷',
    tipos: ['MANO DE OBRA'],
  },
  { key: 'CONTRATISTAS', titulo: 'CONTRATISTAS', icon: '📄', tipos: ['CONTRATISTA'] },
  {
    key: 'TRANSPORTE',
    titulo: 'TRANSPORTE Y FLETES',
    icon: '🚚',
    tipos: ['TRANSPORTE'],
  },
  {
    key: 'INSUMOS',
    titulo: 'INSUMOS / CONSUMIBLES',
    icon: '📦',
    tipos: ['INSUMOS'],
  },
  {
    key: 'PERMISOLOGIA',
    titulo: 'PERMISOLOGÍA Y TRÁMITES',
    icon: '⚖️',
    tipos: ['PERMISOLOGIA'],
  },
  {
    key: 'PROYECTO',
    titulo: 'SERVICIOS PROFESIONALES / PROYECTO',
    icon: '📐',
    tipos: ['PROYECTO'],
  },
];
