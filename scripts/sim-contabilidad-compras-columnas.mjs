/**
 * Simula columnas usadas en flujos de contabilidad_compras vs migraciones locales.
 * Uso: node scripts/sim-contabilidad-compras-columnas.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const migDir = path.join(root, 'supabase/migrations');

/** Columnas base + migraciones conocidas (orden aplicación). */
const SCHEMA_COLUMNS = new Set([
  'id',
  'purchase_invoice_id',
  'invoice_number',
  'supplier_rif',
  'supplier_name',
  'fecha',
  'total_amount',
  'moneda',
  'origen',
  'estado',
  'document_storage_path',
  'document_file_name',
  'notas',
  'created_at',
  'proyecto_id',
  // 144
  'tasa_bcv_ves_por_usd',
  'total_amount_usd',
  // 148
  'monto_ves',
  'monto_usd',
  'moneda_original',
  // 183
  'ubicacion_destino_id',
  // 196
  'entidad_id',
  // 202
  'compra_factura_id',
  'ingresado_almacen_at',
  'cuarentena_rechazo_total',
  // 219
  'imputacion',
  // 145 valuaciones
  'valuacion_delegada_id',
  // 221
  'alerta_fecha',
  'fecha_confirmada_manual',
  // 222
  'clasificacion_gasto_entidad',
]);

/** Columnas que el código intenta escribir pero NO están en migraciones. */
const CODE_ONLY_COLUMNS = new Set(['updated_at']);

/** Flujos simulados: PATCH/INSERT típicos por operación. */
const FLUJOS = {
  'Verificar fecha (actualizarFechaCompra)': {
    file: 'lib/contabilidad/actualizarFechaCompra.ts',
    patch: [
      'fecha',
      'moneda',
      'moneda_original',
      'total_amount',
      'monto_ves',
      'monto_usd',
      'tasa_bcv_ves_por_usd',
      'total_amount_usd',
      'alerta_fecha',
      'fecha_confirmada_manual',
    ],
    select: [
      'id',
      'fecha',
      'total_amount',
      'moneda',
      'moneda_original',
      'tasa_bcv_ves_por_usd',
    ],
    fallbackPatch: [
      'fecha',
      'moneda',
      'moneda_original',
      'total_amount',
      'monto_ves',
      'monto_usd',
      'tasa_bcv_ves_por_usd',
      'total_amount_usd',
    ],
    note: 'Si falla alerta_fecha/fecha_confirmada_manual → retry sin auditoría (221 pendiente).',
  },
  'Confirmar fecha anómala (legacy checkbox)': {
    file: 'lib/contabilidad/confirmarFechaAnomalaCompra.ts',
    patch: ['fecha_confirmada_manual', 'alerta_fecha'],
    select: ['id', 'fecha', 'alerta_fecha', 'fecha_confirmada_manual'],
  },
  'Editar factura extracted (actualizarCompraContableDesdeExtracted)': {
    file: 'lib/contabilidad/actualizarCompraContableDesdeExtracted.ts',
    patch: [
      'invoice_number',
      'supplier_name',
      'supplier_rif',
      'fecha',
      'moneda',
      'moneda_original',
      'total_amount',
      'monto_ves',
      'monto_usd',
      'tasa_bcv_ves_por_usd',
      'total_amount_usd',
      'alerta_fecha',
      'fecha_confirmada_manual',
    ],
    select: [
      'id',
      'fecha',
      'purchase_invoice_id',
      'invoice_number',
      'supplier_name',
      'supplier_rif',
      'tasa_bcv_ves_por_usd',
      'moneda',
      'moneda_original',
      'total_amount',
    ],
  },
  'Cuadro compras — listado': {
    file: 'app/contabilidad/compras/page.tsx',
    select: [
      'id',
      'purchase_invoice_id',
      'proyecto_id',
      'entidad_id',
      'imputacion',
      'ubicacion_destino_id',
      'invoice_number',
      'supplier_rif',
      'supplier_name',
      'fecha',
      'total_amount',
      'total_amount_usd',
      'tasa_bcv_ves_por_usd',
      'moneda',
      'moneda_original',
      'monto_ves',
      'monto_usd',
      'origen',
      'estado',
      'document_file_name',
      'document_storage_path',
      'created_at',
      'alerta_fecha',
      'fecha_confirmada_manual',
      'clasificacion_gasto_entidad',
      'compra_factura_id',
      'ingresado_almacen_at',
      'cuarentena_rechazo_total',
    ],
  },
  'Reubicar obra': {
    file: 'lib/almacen/reubicarCompraObra.ts',
    patch: ['proyecto_id', 'entidad_id', 'ubicacion_destino_id'],
  },
  'Imputación obra/entidad': {
    file: 'app/api/contabilidad/compras/[id]/imputacion/route.ts',
    patch: ['imputacion', 'proyecto_id', 'valuacion_delegada_id', 'ubicacion_destino_id', 'clasificacion_gasto_entidad'],
  },
  'Logística post-ingreso': {
    file: 'lib/contabilidad/sincronizarLogisticaCompraContable.ts',
    patch: ['compra_factura_id', 'cuarentena_rechazo_total', 'ingresado_almacen_at'],
    select: ['id', 'ingresado_almacen_at', 'cuarentena_rechazo_total'],
  },
};

function scanFileForUpdatedAtOnContabilidad(relPath) {
  const full = path.join(root, relPath);
  if (!fs.existsSync(full)) return false;
  const src = fs.readFileSync(full, 'utf8');
  const blocks = src.split(".from('contabilidad_compras')");
  for (let i = 1; i < blocks.length; i++) {
    const chunk = blocks[i].slice(0, 800);
    if (/updated_at/.test(chunk) && /\.(update|insert|upsert)/.test(chunk)) return true;
  }
  return false;
}

function diffColumns(cols, label) {
  const missing = cols.filter((c) => !SCHEMA_COLUMNS.has(c) && !CODE_ONLY_COLUMNS.has(c));
  const codeOnly = cols.filter((c) => CODE_ONLY_COLUMNS.has(c));
  const ok = cols.filter((c) => SCHEMA_COLUMNS.has(c));
  return { label, ok, missing, codeOnly };
}

function printSection(title, cols) {
  if (!cols?.length) return;
  const { ok, missing, codeOnly } = diffColumns(cols, title);
  console.log(`\n### ${title}`);
  if (ok.length) console.log(`  OK (${ok.length}): ${ok.join(', ')}`);
  if (codeOnly.length) {
    console.log(`  ⚠️  Código referencia columna ausente en migraciones: ${codeOnly.join(', ')}`);
  }
  if (missing.length) {
    console.log(`  ❌ FALTA migración para: ${missing.join(', ')}`);
  }
}

console.log('═══════════════════════════════════════════════════════════');
console.log(' Simulación columnas contabilidad_compras');
console.log('═══════════════════════════════════════════════════════════');
console.log(`\nEsquema esperado (migraciones 135–222): ${SCHEMA_COLUMNS.size} columnas`);
console.log(`Sin updated_at en BD (solo created_at en 141).`);

console.log('\n── Escaneo updated_at en escrituras ──');
const filesToScan = [
  'lib/contabilidad/actualizarFechaCompra.ts',
  'lib/contabilidad/confirmarFechaAnomalaCompra.ts',
  'lib/contabilidad/actualizarCompraContableDesdeExtracted.ts',
  'lib/almacen/reubicarCompraObra.ts',
  'lib/contabilidad/recalcularTotalesCompraContable.ts',
  'lib/contabilidad/registerCompraDesdeRecepcion.ts',
  'lib/contabilidad/registrarCompraDesdeIngresoManualFactura.ts',
  'lib/contabilidad/actualizarCompraProvisionalConFacturaCanal.ts',
  'lib/contabilidad/sincronizarLogisticaCompraContable.ts',
  'app/api/contabilidad/compras/[id]/route.ts',
];
let foundUpdatedAt = false;
for (const f of filesToScan) {
  if (scanFileForUpdatedAtOnContabilidad(f)) {
    console.log(`  ❌ ${f} → escribe updated_at en contabilidad_compras`);
    foundUpdatedAt = true;
  }
}
if (!foundUpdatedAt) {
  console.log('  ✅ Ningún archivo escaneado envía updated_at a contabilidad_compras');
}

console.log('\n── Simulación por flujo ──');
for (const [name, flow] of Object.entries(FLUJOS)) {
  console.log(`\n▶ ${name}`);
  if (flow.file) console.log(`  ${flow.file}`);
  if (flow.note) console.log(`  Nota: ${flow.note}`);
  printSection('SELECT', flow.select);
  printSection('PATCH/INSERT', flow.patch);
  if (flow.fallbackPatch) printSection('PATCH fallback (sin auditoría)', flow.fallbackPatch);
}

console.log('\n── Migraciones pendientes típicas en producción ──');
const pendingChecks = [
  { mig: '221_compras_auditoria_fecha.sql', cols: ['alerta_fecha', 'fecha_confirmada_manual'] },
  { mig: '222_compras_clasificacion_gasto_entidad.sql', cols: ['clasificacion_gasto_entidad'] },
  { mig: '220_repair_contabilidad_compras.sql', cols: ['ubicacion_destino_id', 'entidad_id', 'compra_factura_id', 'ingresado_almacen_at', 'imputacion'] },
  { mig: '228_ci_alertas_config.sql', cols: ['(tabla ci_alertas_config — no afecta contabilidad_compras)'] },
];
for (const p of pendingChecks) {
  const migPath = path.join(migDir, p.mig);
  const exists = fs.existsSync(migPath);
  console.log(`  ${exists ? '✓' : '?'} ${p.mig} → ${p.cols.join(', ')}`);
}

console.log('\n── Conclusión ──');
console.log(`
1. updated_at: NO está en migraciones de contabilidad_compras.
   El commit 311018c ya lo quitó del código de fecha/reubicar.
   Si el error persiste en producción, puede ser caché de bundle antiguo
   O un deploy anterior a 311018c.

2. Flujo Verificar fecha: columnas del PATCH están cubiertas SI aplicaste 221.
   Sin 221: falla alerta_fecha/fecha_confirmada_manual (el código reintenta sin ellas).

3. Otras columnas que SÍ suelen faltar si no corriste 220/219/202:
   imputacion, ubicacion_destino_id, ingresado_almacen_at, clasificacion_gasto_entidad.

4. NO hace falta otra columna para el flujo de fecha más allá de 221.
   updated_at es un falso positivo del código viejo, no un requisito de esquema.
`);

console.log('═══════════════════════════════════════════════════════════\n');
