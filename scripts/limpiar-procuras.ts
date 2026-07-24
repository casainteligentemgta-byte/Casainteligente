/**
 * Diagnóstico rápido de procuras y vínculos antes de limpiar.
 * Uso: npx tsx scripts/limpiar-procuras.ts --dry-run
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const dryRun = process.argv.includes('--dry-run');
const force = process.argv.includes('--force');

function parseEnvFile(content: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of content.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

async function main(): Promise<void> {
  const envPath = path.join(root, '.env.local');
  const env = parseEnvFile(fs.readFileSync(envPath, 'utf8'));
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new Error('Faltan credenciales Supabase');

  const sb = createClient(url, key, { auth: { persistSession: false } });

  const { data: procuras, error } = await sb
    .from('ci_procuras')
    .select('id,ticket,estado,purchase_invoice_id,material_txt,created_at')
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message);

  console.log(`\nProcuras en BD: ${procuras?.length ?? 0}\n`);
  for (const p of procuras ?? []) {
    console.log(`  ${p.ticket} | ${p.estado} | pi:${p.purchase_invoice_id ?? '—'}`);
  }

  const ids = (procuras ?? []).map((p) => p.id as string);
  if (!ids.length) {
    console.log('\n✅ Ya hay cero procuras.');
    return;
  }

  const { data: compras } = await sb
    .from('contabilidad_compras')
    .select('id,procura_id,purchase_invoice_id,factura_numero')
    .in('procura_id', ids);

  const piIds = (procuras ?? [])
    .map((p) => p.purchase_invoice_id)
    .filter((x): x is string => Boolean(x?.trim()));

  let comprasPorPi: Array<{ id: string; purchase_invoice_id: string | null; factura_numero: string | null }> = [];
  if (piIds.length) {
    const { data } = await sb
      .from('contabilidad_compras')
      .select('id,purchase_invoice_id,factura_numero')
      .in('purchase_invoice_id', piIds);
    comprasPorPi = data ?? [];
  }

  console.log(`\nCompras contables vinculadas (procura_id): ${compras?.length ?? 0}`);
  console.log(`Compras contables por purchase_invoice: ${comprasPorPi.length}`);
  for (const c of comprasPorPi) {
    console.log(`  cc:${c.id} pi:${c.purchase_invoice_id} factura:${c.factura_numero ?? '—'}`);
  }

  const { data: recepciones } = await sb
    .from('ci_recepciones_campo')
    .select('id,procura_id,num_doc')
    .in('procura_id', ids);

  const { data: historial } = await sb
    .from('ci_procura_estados_historial')
    .select('id,procura_id')
    .in('procura_id', ids);

  let facturasLog: Array<{ id: string; purchase_invoice_id: string | null; estado: string }> = [];
  if (piIds.length) {
    const { data } = await sb
      .from('compras_facturas')
      .select('id,purchase_invoice_id,estado')
      .in('purchase_invoice_id', piIds);
    facturasLog = data ?? [];
  }

  console.log(`\nRecepciones vinculadas: ${recepciones?.length ?? 0}`);
  console.log(`Historial estados: ${historial?.length ?? 0}`);
  console.log(`Facturas logísticas (compras_facturas): ${facturasLog.length}`);

  if (dryRun) {
    console.log('\n(dry-run — no se borró nada; use sin --dry-run para limpiar)');
    return;
  }

  if (!force) {
    console.log('\n⚠️ Ejecute con --force para confirmar borrado total.');
    return;
  }

  // 1) Desvincular contabilidad
  const { error: ccErr } = await sb
    .from('contabilidad_compras')
    .update({ procura_id: null })
    .in('procura_id', ids);
  if (ccErr && ccErr.code !== '42P01') throw new Error(`contabilidad: ${ccErr.message}`);

  // 2) Desvincular recepciones (preservar recepciones pero quitar procura_id)
  const { error: recErr } = await sb
    .from('ci_recepciones_campo')
    .update({ procura_id: null })
    .in('procura_id', ids);
  if (recErr && recErr.code !== '42P01') throw new Error(`recepciones: ${recErr.message}`);

  // 3) Quitar purchase_invoice_id de procuras para poder borrar
  const { error: piErr } = await sb
    .from('ci_procuras')
    .update({ purchase_invoice_id: null })
    .in('id', ids);
  if (piErr) throw new Error(`procuras unlink pi: ${piErr.message}`);

  // 4) Borrar purchase_invoices huérfanos de estas procuras (sin contabilidad)
  if (piIds.length) {
    for (const pi of piIds) {
      const { count: ccCount } = await sb
        .from('contabilidad_compras')
        .select('id', { count: 'exact', head: true })
        .eq('purchase_invoice_id', pi);
      if ((ccCount ?? 0) > 0) continue;

      const { data: cfs } = await sb
        .from('compras_facturas')
        .select('id')
        .eq('purchase_invoice_id', pi);
      const cfIds = (cfs ?? []).map((r) => r.id as string);
      if (cfIds.length) {
        await sb.from('compras_factura_lineas').delete().in('factura_id', cfIds);
        const { error: cfDelErr } = await sb.from('compras_facturas').delete().in('id', cfIds);
        if (cfDelErr && cfDelErr.code !== '42P01') throw new Error(`compras_facturas: ${cfDelErr.message}`);
      }

      const { error: piDelErr } = await sb.from('purchase_invoices').delete().eq('id', pi);
      if (piDelErr && piDelErr.code !== '42P01') throw new Error(`purchase_invoices: ${piDelErr.message}`);
    }
  }

  // 5) Borrar procuras (historial cascade)
  const { error: delErr } = await sb.from('ci_procuras').delete().in('id', ids);
  if (delErr) throw new Error(`delete procuras: ${delErr.message}`);

  const { count } = await sb.from('ci_procuras').select('id', { count: 'exact', head: true });
  console.log(`\n✅ Limpieza hecha. Procuras restantes: ${count ?? 0}`);
  console.log(`   Eliminadas: ${ids.map((id) => procuras?.find((p) => p.id === id)?.ticket).join(', ')}`);
}

main().catch((e) => {
  console.error('❌', e instanceof Error ? e.message : e);
  process.exit(1);
});
