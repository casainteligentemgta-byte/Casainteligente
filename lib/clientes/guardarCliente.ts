import type { SupabaseClient } from '@supabase/supabase-js';

const CAMPOS_PERMITIDOS = new Set([
  'nombre',
  'apellido',
  'customer_type',
  'tipo',
  'cedula',
  'rif',
  'razon_social',
  'representante_legal',
  'genero',
  'estado_civil',
  'profesion',
  'direccion',
  'email',
  'telefono',
  'movil',
  'telegram_username',
  'telegram_chat_id',
  'status',
  'imagen',
]);

export function columnaCustomersFaltante(message: string): string | null {
  const m1 = /Could not find the '(\w+)' column of 'customers'/i.exec(message);
  if (m1?.[1]) return m1[1];
  const m2 = /column ['"]?(\w+)['"]? of relation ['"]?customers['"]?/i.exec(message);
  if (m2?.[1]) return m2[1];
  const m3 = /column customers\.(\w+) does not exist/i.exec(message);
  if (m3?.[1]) return m3[1];
  const m4 = /['"](\w+)['"].*customers.*does not exist/i.exec(message);
  return m4?.[1] ?? null;
}

export function esErrorSchemaColumnaCustomers(message: string): boolean {
  if (/Could not find the '\w+' column of 'customers'/i.test(message)) return true;
  if (/column customers\.\w+ does not exist/i.test(message)) return true;
  return (
    /customers/i.test(message) &&
    (/schema cache/i.test(message) || /column/i.test(message) || /does not exist/i.test(message))
  );
}

export function esErrorUnicoCustomers(message: string): boolean {
  return /duplicate key|unique constraint|uq_customers_rif|uq_customers_cedula|23505/i.test(message);
}

/** Quita campos que el cliente no puede fijar (id, entidad_id se asignan en servidor). */
export function payloadClientePermitido(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    if (!CAMPOS_PERMITIDOS.has(k)) continue;
    out[k] = v;
  }
  return out;
}

export async function guardarClienteEnDb(
  supabase: SupabaseClient,
  payload: Record<string, unknown>,
  id: string | null,
): Promise<{ id: string | null; error: string | null }> {
  let actual = { ...payload };
  const run = () =>
    id
      ? supabase.from('customers').update(actual).eq('id', id).select('id').maybeSingle()
      : supabase.from('customers').insert(actual).select('id').maybeSingle();

  let result = await run();
  for (let i = 0; i < 14 && result.error && esErrorSchemaColumnaCustomers(result.error.message); i++) {
    const col = columnaCustomersFaltante(result.error.message);
    if (!col || !(col in actual)) break;
    delete actual[col];
    result = await run();
  }
  if (result.error) return { id: null, error: result.error.message };
  const got = String((result.data as { id?: string } | null)?.id ?? id ?? '').trim();
  return { id: got || null, error: null };
}

export function mensajeConfirmarArchivar(nombre: string | null | undefined): string {
  const n = String(nombre ?? '').trim() || 'este cliente';
  return `¿Archivar a ${n}?\n\nDejará de aparecer en la lista de clientes activos. Puede restaurarlo después.`;
}
