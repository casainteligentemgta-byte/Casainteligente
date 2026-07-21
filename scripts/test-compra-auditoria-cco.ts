/**
 * npx tsx scripts/test-compra-auditoria-cco.ts
 */
import {
  esCompraSoloAuditoriaCco,
  esDescripcionAuditoriaCco,
  esNotaImportacionGenericaCco,
} from '../lib/contabilidad/compraEsAuditoriaCco';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

{
  assert(
    esDescripcionAuditoriaCco('cambio proyecto: cambio al proyecto maestro……'),
    'cambio proyecto con dos puntos',
  );
  assert(esDescripcionAuditoriaCco('CAMBIO PROYECTO'), 'accion sola');
  assert(esDescripcionAuditoriaCco('CAMBIO DE PROYECTO: foo'), 'con DE');
  assert(!esDescripcionAuditoriaCco('Cemento gris 42.5'), 'gasto real');
}

{
  assert(
    esNotaImportacionGenericaCco('Importación desde CSV/tabla histórica'),
    'nota generica',
  );
}

{
  const soloAudit = esCompraSoloAuditoriaCco({
    supplier_name: 'CARLO DI MATTEO',
    invoice_number: 'SIN-2358',
    notas: 'Importación desde CSV/tabla (histórico).',
    lineas: [{ descripcion: 'cambio proyecto: cambio al proyecto maestro……' }],
  });
  assert(soloAudit, 'HISTORICO_TABLA Carlo + cambio proyecto');
}

{
  // Caso producción: embed de líneas vacío → PRODUCTOS se carga al expandir.
  const sinLineasEmbed = esCompraSoloAuditoriaCco({
    supplier_name: 'CARLO DI MATTEO',
    supplier_rif: '---',
    invoice_number: 'SIN-2358',
    origen: 'HISTORICO_TABLA',
    monto_usd: 0,
    total_amount: 0,
    notas: 'Importación desde CSV/tabla histórica (solo contabilidad, sin stock).',
    lineas: [],
  });
  assert(sinLineasEmbed, 'SIN-* sin lineas embed debe ocultarse');
}

{
  const real = esCompraSoloAuditoriaCco({
    supplier_name: 'FERRETERIA XYZ',
    supplier_rif: 'J-12345678-9',
    invoice_number: 'F-100',
    origen: 'TELEGRAM',
    notas: null,
    lineas: [{ descripcion: 'Cabilla 3/8' }],
  });
  assert(!real, 'compra real no es auditoria');
}

console.log('OK test-compra-auditoria-cco');
