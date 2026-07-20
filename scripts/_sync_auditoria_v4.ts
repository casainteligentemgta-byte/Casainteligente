/** Sincroniza solo AUDITORIA del JSON V4 (sin reimportar gastos). */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const PROYECTO_ID = '171694ed-0ecb-4ec5-82f5-82b980cb261f';
const root = path.join(__dirname, '..');
for (const line of fs.readFileSync(path.join(root, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (!m) continue;
  let v = m[2].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  if (process.env[m[1].trim()] === undefined) process.env[m[1].trim()] = v;
}

function fechaIso(raw: string | null | undefined): string {
  const s = String(raw ?? '').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return new Date().toISOString().slice(0, 10);
}

async function main() {
  const payload = JSON.parse(fs.readFileSync(path.join(root, 'tmp', 'cco_v4_from_csv.json'), 'utf8'));
  const audits = (payload.transacciones || []).filter(
    (t: any) => String(t.clase).toUpperCase() === 'AUDITORIA',
  );
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  // Borrar auditoría V4 previa de la obra y cargar la del CSV nuevo
  const ids: string[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await sb
      .from('cco_auditoria_eventos')
      .select('id')
      .eq('proyecto_id', PROYECTO_ID)
      .not('origen_v4_id', 'is', null)
      .range(from, from + 999);
    if (error) throw error;
    ids.push(...((data || []) as { id: string }[]).map((r) => r.id));
    if (!data || data.length < 1000) break;
    from += 1000;
  }
  for (let i = 0; i < ids.length; i += 200) {
    const part = ids.slice(i, i + 200);
    const { error } = await sb.from('cco_auditoria_eventos').delete().in('id', part);
    if (error) throw error;
  }
  console.log('borradas', ids.length);

  let ok = 0;
  for (const t of audits) {
    const { error } = await sb.from('cco_auditoria_eventos').insert({
      proyecto_id: PROYECTO_ID,
      fecha: fechaIso(t.fecha),
      accion: String(t.tipo ?? t.descripcion ?? 'AUDITORIA').slice(0, 200),
      detalle: String(t.descripcion ?? ''),
      origen_v4_id: t.origen_v4_id,
      metadata: { proveedor: t.proveedor ?? null },
    });
    if (error) console.error(t.origen_v4_id, error.message);
    else ok += 1;
  }
  console.log('insertadas', ok, 'de', audits.length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
