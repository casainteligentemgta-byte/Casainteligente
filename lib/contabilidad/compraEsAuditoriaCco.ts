/**
 * Detecta filas de auditoría del programa CCO que no deben vivir en el cuadro de compras.
 * En el CSV maestro, CLASE=AUDITORIA usa PROVEEDOR = usuario de sesión (p. ej. «CARLO DI MATTEO»).
 */

const ACCION_AUDITORIA =
  /^(INICIO\s+DE\s+SESI[OÓ]N|CIERRE\s+DE\s+SESI[OÓ]N|IMPRESI[OÓ]N\s+PDF|RESPALDO\s+DISCO|EXPORTACI[OÓ]N|IMPORTACI[OÓ]N|ACCESO\s+AL\s+SISTEMA|LOGIN|LOGOUT|BACKUP)/i;

const DETALLE_AUDITORIA =
  /(ACCEDI[OÓ]\s+AL\s+SISTEMA|GENER[OÓ]\s+EL\s+REPORTE|GUARD[OÓ]\s+COPIA\s+CSV|COPIA\s+CSV\s+EN\s+DISCO)/i;

export function esClaseAuditoriaCco(clase: string | null | undefined): boolean {
  const u = String(clase ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();
  return u === 'AUDITORIA' || u.startsWith('AUDIT');
}

/** Clases del maestro CCO que no son compras/gastos del cuadro. */
export function esClaseNoCompraCco(clase: string | null | undefined): boolean {
  const u = String(clase ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();
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

/** Texto de artículo/descripción típico de logs CCO (sesión, PDF, respaldo…). */
export function esDescripcionAuditoriaCco(descripcion: string | null | undefined): boolean {
  const s = String(descripcion ?? '').trim();
  if (!s) return false;
  const cabeza = s.split(':')[0]?.trim() ?? s;
  if (ACCION_AUDITORIA.test(cabeza) || ACCION_AUDITORIA.test(s)) return true;
  if (DETALLE_AUDITORIA.test(s)) return true;
  return false;
}
