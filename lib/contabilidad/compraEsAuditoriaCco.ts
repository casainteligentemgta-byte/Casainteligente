/**
 * Detecta filas de auditoría del programa CCO que no deben vivir en el cuadro de compras
 * ni en el listado de egresos (columna Concepto).
 * En el CSV maestro, CLASE=AUDITORIA usa PROVEEDOR = usuario de sesión (p. ej. «CARLO DI MATTEO»)
 * y DESCRIPCION/TIPO = acción de log (sesión, PDF, respaldo, editor maestro…).
 */

const ACCIONES_AUDITORIA = [
  'INICIO DE SESION',
  'INICIO DE SESIÓN',
  'CIERRE DE SESION',
  'CIERRE DE SESIÓN',
  'IMPRESION PDF',
  'IMPRESIÓN PDF',
  'RESPALDO DISCO',
  'RESPALDO CSV',
  'RESPALDO',
  'EXPORTACION',
  'EXPORTACIÓN',
  'CARGA CSV',
  'IMPORTACION CSV',
  'IMPORTACIÓN CSV',
  'IMPORTACION PDF',
  'IMPORTACIÓN PDF',
  'ACCESO AL SISTEMA',
  'LOGIN',
  'LOGOUT',
  'BACKUP',
  'CAMBIO DE OBRA',
  'CAMBIO OBRA',
  'CAMBIO DE PROYECTO',
  'CAMBIO PROYECTO',
  'APERTURA DE ARCHIVO',
  'GUARDADO AUTOMATICO',
  'GUARDADO AUTOMÁTICO',
  'EDICION CONTRATO',
  'EDICIÓN CONTRATO',
  'EDITOR MAESTRO',
  'EDICION GASTOS',
  'EDICIÓN GASTOS',
  'EDICION EGRESOS',
  'EDICIÓN EGRESOS',
  'EDICION SOBRANTE',
  'EDICIÓN SOBRANTE',
  'ELIMINACION DUPLICADO',
  'ELIMINACIÓN DUPLICADO',
  'ELIMINACION SOBRANTE',
  'ELIMINACIÓN SOBRANTE',
  'DISTRIBUCION MASIVA',
  'DISTRIBUCIÓN MASIVA',
];

const DETALLES_AUDITORIA = [
  'ACCEDIO AL SISTEMA',
  'ACCEDIÓ AL SISTEMA',
  'GENERO EL REPORTE',
  'GENERÓ EL REPORTE',
  'GUARDO COPIA CSV',
  'GUARDÓ COPIA CSV',
  'COPIA CSV EN DISCO',
  'EXPORTO COPIA DE SEGURIDAD',
  'EXPORTÓ COPIA DE SEGURIDAD',
  'COPIA DE SEGURIDAD DE LA BASE',
  'IMPORTO',
  'IMPORTÓ',
  'REGISTROS DE LA BASE DE DATOS',
  'REGISTROS FALTANTES',
  'REPORTE PDF DE RUBROS',
  'PARA DESCARGA',
  'ACTUALIZO MONTOS ESTIMADOS',
  'ACTUALIZÓ MONTOS ESTIMADOS',
  'AREAS DE CAPITULOS',
  'ÁREAS DE CAPÍTULOS',
  'GRUPOS CONSOLIDADOS',
  'FRACCIONES INTERNAS',
  'GASTO DIVIDIDO',
  'ANADIO GASTO DIVIDIDO',
  'AÑADIÓ GASTO DIVIDIDO',
  'ANADIO INGRESO',
  'AÑADIÓ INGRESO',
  'EDITO GASTO',
  'EDITÓ GASTO',
  'RESOLUTOR',
  'BORRADO SUB-REGISTROS',
  'CAMBIO AL PROYECTO MAESTRO',
  'AL PROYECTO MAESTRO',
];

/** Prefijos de log tipo «MÓDULO: verbo …» que no son conceptos de gasto. */
const PREFIJOS_LOG_AUDITORIA = [
  'EDITOR MAESTRO',
  'EDICION GASTOS',
  'EDICION EGRESOS',
  'DISTRIBUCION MASIVA',
  'AUDITORIA',
  'CAMBIO PROYECTO',
  'CAMBIO DE PROYECTO',
  'CAMBIO OBRA',
  'CAMBIO DE OBRA',
];

/** Patrones de acciones de bitácora CCO en Concepto/descripción. */
const PATRONES_LOG_AUDITORIA = [
  /\bGRUPOS CONSOLIDADOS\b/,
  /\bFRACCIONES INTERNAS\b/,
  /\bGASTO DIVIDIDO\b/,
  /\bANADIO GASTO\b/,
  /\b(ELIMINO|MODIFICO|ANADIO|CREO|ACTUALIZO|DIVIDIO)\b.+\b(REGISTRO|REGISTROS|GRUPO|GRUPOS|FRACCION|FRACCIONES)\b/,
  /^GASTO\s*:\s*(ELIMINO|MODIFICO|ANADIO|CREO|ACTUALIZO|DIVIDIO)\b/,
  /^(INGRESO|CONTRATO|PRESUPUESTO)\s*:\s*(ELIMINO|MODIFICO|ANADIO|CREO|ACTUALIZO)\b/,
  // «cambio proyecto: cambio al proyecto maestro…» (sin «DE» en el CSV)
  /^CAMBIO\s+(DE\s+)?(PROYECTO|OBRA)\b/,
  /\bCAMBIO\s+(DE\s+)?(PROYECTO|OBRA)\s*[:·\-]/,
  /\bCAMBIO\s+AL\s+PROYECTO\s+MAESTRO\b/,
];

function normalizarAuditTexto(raw: string): string {
  return String(raw ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Notas genéricas del import CSV/tabla (no son concepto de gasto ni de log). */
export function esNotaImportacionGenericaCco(notas: string | null | undefined): boolean {
  return /importaci[oó]n desde (csv|tabla)/i.test(String(notas ?? ''));
}

export function esRifVacioOPlaceholder(rif: string | null | undefined): boolean {
  const r = String(rif ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
  return !r || r === '---' || r === '--' || r === '-' || r === 'SR' || r === 'N/A' || r === 'NA' || r === 'S/R';
}

export function esClaseAuditoriaCco(clase: string | null | undefined): boolean {
  const u = normalizarAuditTexto(String(clase ?? ''));
  return u === 'AUDITORIA' || u.startsWith('AUDIT');
}

/** Clases del maestro CCO que no son compras/gastos del cuadro. */
export function esClaseNoCompraCco(clase: string | null | undefined): boolean {
  const u = normalizarAuditTexto(String(clase ?? ''));
  if (!u) return false;
  if (u === 'GASTO' || u === 'EGRESO') return false;
  return (
    u === 'AUDITORIA' ||
    u.startsWith('AUDIT') ||
    u === 'INGRESO' ||
    u === 'CONTRATO' ||
    u === 'PRESUPUESTO' ||
    u === 'ESTRUCTURA'
  );
}

/** Texto de artículo/descripción/notas típico de logs CCO. */
export function esDescripcionAuditoriaCco(descripcion: string | null | undefined): boolean {
  const s = normalizarAuditTexto(String(descripcion ?? ''));
  if (!s) return false;
  if (esNotaImportacionGenericaCco(descripcion)) return false;

  for (const a of ACCIONES_AUDITORIA) {
    const n = normalizarAuditTexto(a);
    if (s === n || s.startsWith(`${n}:`) || s.startsWith(`${n} ·`) || s.startsWith(`${n} -`)) {
      return true;
    }
    if (s.includes(n) && (s.includes(':') || s.includes('SISTEMA') || s.includes('REPORTE') || s.includes('CSV') || s.includes('·'))) {
      return true;
    }
  }
  for (const d of DETALLES_AUDITORIA) {
    if (s.includes(normalizarAuditTexto(d))) return true;
  }
  for (const p of PREFIJOS_LOG_AUDITORIA) {
    const n = normalizarAuditTexto(p);
    if (s === n || s.startsWith(`${n}:`) || s.startsWith(`${n} `) || s.startsWith(`${n} ·`)) {
      return true;
    }
  }
  for (const re of PATRONES_LOG_AUDITORIA) {
    if (re.test(s)) return true;
  }
  return false;
}

/**
 * ¿Esta compra es solo auditoría CCO mal importada?
 * No exige monto 0: esos logs a veces traen basura numérica del CSV.
 * Ignora notas genéricas «Importación desde CSV/tabla…» (HISTORICO_TABLA).
 *
 * Importante: si las líneas aún no llegaron en el embed (PRODUCTOS se carga
 * al expandir), usa heurística SIN-* + RIF vacío + origen histórico/CCO.
 */
export function esCompraSoloAuditoriaCco(input: {
  supplier_name?: string | null;
  supplier_rif?: string | null;
  notas?: string | null;
  invoice_number?: string | null;
  origen?: string | null;
  monto_usd?: number | null;
  total_amount?: number | null;
  lineas?: Array<{ descripcion?: string | null }>;
}): boolean {
  const lineasDesc = (input.lineas ?? [])
    .map((l) => String(l.descripcion ?? '').trim())
    .filter(Boolean);
  const notas = String(input.notas ?? '').trim();
  const notasUtil = notas && !esNotaImportacionGenericaCco(notas) ? notas : '';

  // Preferir líneas de artículo; la nota genérica de import no cuenta como “concepto”.
  const textos = [...lineasDesc, ...(notasUtil ? [notasUtil] : [])];

  if (textos.length > 0) {
    if (textos.every((t) => esDescripcionAuditoriaCco(t))) return true;
  }

  const inv = String(input.invoice_number ?? '').trim().toUpperCase();
  if (inv.startsWith('SIN-') && textos.some((t) => esDescripcionAuditoriaCco(t))) {
    return true;
  }

  if (lineasDesc.length > 0 && lineasDesc.every((t) => esDescripcionAuditoriaCco(t))) {
    return true;
  }

  // Heurística cuando el embed de líneas viene vacío (el toggle carga después):
  // factura sintética SIN-* + RIF vacío + import histórico/CCO → bitácora.
  const origen = String(input.origen ?? '');
  const esImportCco =
    /HISTORICO_TABLA|cco_v4|cco_editor|cco_distribucion|cco_/i.test(origen) ||
    esNotaImportacionGenericaCco(notas);
  const rifVacio = esRifVacioOPlaceholder(input.supplier_rif);
  const montoUsd = Number(input.monto_usd);
  const totalBs = Number(input.total_amount);
  const montoCero =
    (!Number.isFinite(montoUsd) || Math.abs(montoUsd) < 0.005) &&
    (!Number.isFinite(totalBs) || Math.abs(totalBs) < 0.005);

  if (inv.startsWith('SIN-') && rifVacio && esImportCco && (lineasDesc.length === 0 || montoCero)) {
    return true;
  }

  return false;
}
