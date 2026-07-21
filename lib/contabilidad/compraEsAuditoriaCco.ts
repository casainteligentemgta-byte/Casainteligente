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
  'EXPORTACION',
  'EXPORTACIÓN',
  'IMPORTACION CSV',
  'IMPORTACIÓN CSV',
  'ACCESO AL SISTEMA',
  'LOGIN',
  'LOGOUT',
  'BACKUP',
  'CAMBIO DE OBRA',
  'CAMBIO DE PROYECTO',
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
];

/** Prefijos de log tipo «MÓDULO: verbo …» que no son conceptos de gasto. */
const PREFIJOS_LOG_AUDITORIA = [
  'EDITOR MAESTRO',
  'EDICION GASTOS',
  'EDICION EGRESOS',
  'DISTRIBUCION MASIVA',
  'AUDITORIA',
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
];

function normalizarAuditTexto(raw: string): string {
  return String(raw ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
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

  for (const a of ACCIONES_AUDITORIA) {
    const n = normalizarAuditTexto(a);
    if (s === n || s.startsWith(`${n}:`) || s.startsWith(`${n} ·`) || s.startsWith(`${n} -`)) {
      return true;
    }
    if (s.includes(n) && (s.includes(':') || s.includes('SISTEMA') || s.includes('REPORTE') || s.includes('CSV'))) {
      return true;
    }
  }
  for (const d of DETALLES_AUDITORIA) {
    if (s.includes(normalizarAuditTexto(d))) return true;
  }
  for (const p of PREFIJOS_LOG_AUDITORIA) {
    const n = normalizarAuditTexto(p);
    if (s === n || s.startsWith(`${n}:`) || s.startsWith(`${n} `)) return true;
  }
  for (const re of PATRONES_LOG_AUDITORIA) {
    if (re.test(s)) return true;
  }
  return false;
}

/**
 * ¿Esta compra es solo auditoría CCO mal importada?
 * No exige monto 0: esos logs a veces traen basura numérica del CSV.
 */
export function esCompraSoloAuditoriaCco(input: {
  supplier_name?: string | null;
  notas?: string | null;
  invoice_number?: string | null;
  lineas?: Array<{ descripcion?: string | null }>;
}): boolean {
  const lineas = input.lineas ?? [];
  const textos = [
    ...lineas.map((l) => String(l.descripcion ?? '')),
    String(input.notas ?? ''),
  ].filter((t) => t.trim());

  if (textos.length === 0) return false;

  // Todas las descripciones/notas parecen log de auditoría.
  if (textos.every((t) => esDescripcionAuditoriaCco(t))) return true;

  // Factura SIN-* + al menos un artículo de auditoría → basura de import.
  const inv = String(input.invoice_number ?? '').trim().toUpperCase();
  if (inv.startsWith('SIN-') && textos.some((t) => esDescripcionAuditoriaCco(t))) {
    return true;
  }

  return false;
}
