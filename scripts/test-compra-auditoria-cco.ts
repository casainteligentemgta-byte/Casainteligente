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
  const real = esCompraSoloAuditoriaCco({
    supplier_name: 'FERRETERIA XYZ',
    invoice_number: 'F-100',
    notas: null,
    lineas: [{ descripcion: 'Cabilla 3/8' }],
  });
  assert(!real, 'compra real no es auditoria');
}

console.log('OK test-compra-auditoria-cco');
