import type { SupabaseClient } from '@supabase/supabase-js';
import type { CustomerCategoriaUi, CustomerListItem, CustomerStatus, CustomerTipo } from '@/types';

export const CUSTOMERS_LIST_SELECT =
  'id,nombre,apellido,razon_social,customer_type,tipo,rif,cedula,email,movil,telefono,direccion,imagen,status,created_at,telegram_username,telegram_chat_id';

export const CUSTOMERS_LIST_SELECT_SAFE =
  'id,nombre,apellido,razon_social,customer_type,tipo,rif,cedula,email,movil,telefono,direccion,imagen,status,created_at';

const PALETA = ['#007AFF', '#5856D6', '#AF52DE', '#FF2D55', '#FF9500', '#00C7BE', '#34C759'];

export function colorPorId(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h += id.charCodeAt(i);
  return PALETA[h % PALETA.length];
}

function normalizarTipo(tipoRaw: string | null | undefined, categoria: CustomerCategoriaUi): 'V' | 'J' | 'E' {
  const t = (tipoRaw || '').trim().toUpperCase();
  if (t === 'V' || t === 'J' || t === 'E') return t;
  if (categoria === 'empresa') return 'J';
  return 'V';
}

function normalizarStatus(s: string | null | undefined): CustomerStatus {
  const v = (s || 'activo').toLowerCase();
  if (v === 'inactivo' || v === 'pendiente' || v === 'activo') return v;
  return 'activo';
}

export function mapearClienteLista(
  c: Record<string, unknown>,
  obraCount: number,
): CustomerListItem {
  const nombreSafe = typeof c.nombre === 'string' && c.nombre.trim() ? c.nombre.trim() : 'Sin nombre';
  const partes = nombreSafe.split(/\s+/).filter(Boolean);
  const initials = partes.map((n) => n[0]).join('').slice(0, 2).toUpperCase() || '??';
  const tipoStr = typeof c.tipo === 'string' ? c.tipo : '';
  const customerType = typeof c.customer_type === 'string' ? c.customer_type.toLowerCase() : '';
  const esEmpresa =
    customerType === 'juridico' || /jurid|empresa/i.test(tipoStr) || tipoStr.trim().toUpperCase() === 'J';
  const categoria: CustomerCategoriaUi = esEmpresa ? 'empresa' : 'personal';
  const tipoLetra = normalizarTipo(tipoStr, categoria);
  const idStr = String(c.id ?? '');
  const cedula = typeof c.cedula === 'string' ? c.cedula.trim() : '';
  const rif = typeof c.rif === 'string' ? c.rif.trim() : '';
  const documentoLabel = esEmpresa
    ? rif
      ? `RIF: ${rif}`
      : ''
    : cedula
      ? `Cédula: ${cedula}`
      : rif
        ? `RIF: ${rif}`
        : '';
  const telefono =
    typeof c.movil === 'string' && c.movil
      ? c.movil
      : typeof c.telefono === 'string'
        ? c.telefono
        : '';

  return {
    id: idStr,
    tipo: (esEmpresa ? 'Empresa' : 'Personal') as CustomerTipo,
    rif: documentoLabel || rif,
    nombre: nombreSafe,
    razon_social: typeof c.razon_social === 'string' ? c.razon_social : null,
    email: typeof c.email === 'string' ? c.email : '',
    movil: telefono,
    direccion: typeof c.direccion === 'string' ? c.direccion : '',
    latitude: null,
    longitude: null,
    imagen: typeof c.imagen === 'string' ? c.imagen : null,
    color: colorPorId(idStr),
    status: normalizarStatus(typeof c.status === 'string' ? c.status : undefined),
    created_at: typeof c.created_at === 'string' ? c.created_at : undefined,
    initials,
    categoria,
    telefono,
    cedula,
    telegram_username: typeof c.telegram_username === 'string' ? c.telegram_username : null,
    telegram_chat_id: Number.isFinite(Number(c.telegram_chat_id)) ? Number(c.telegram_chat_id) : null,
    obraCount,
  };
}

export async function contarObrasPorCliente(
  supabase: SupabaseClient,
  ids: string[],
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (!ids.length) return map;

  try {
    const rpc = await supabase.rpc('ci_conteo_obras_por_cliente', { p_ids: ids });
    if (!rpc.error && Array.isArray(rpc.data)) {
      for (const row of rpc.data as Array<{ customer_id?: unknown; n?: unknown }>) {
        const cid = String(row.customer_id ?? '');
        if (!cid) continue;
        map.set(cid, Number(row.n) || 0);
      }
      return map;
    }
  } catch {
    // RPC ausente (migración 384 pendiente) o cliente de prueba sin .rpc.
  }

  const { data: proys } = await supabase.from('ci_proyectos').select('customer_id').in('customer_id', ids);
  for (const p of proys ?? []) {
    const cid = String((p as { customer_id?: unknown }).customer_id ?? '');
    if (!cid) continue;
    map.set(cid, (map.get(cid) ?? 0) + 1);
  }
  return map;
}

export async function listarClientesCrm(
  supabase: SupabaseClient,
): Promise<{ lista: CustomerListItem[]; error: string | null }> {
  const first = await supabase
    .from('customers')
    .select(CUSTOMERS_LIST_SELECT)
    .order('created_at', { ascending: false });

  let rows = (first.data ?? null) as Record<string, unknown>[] | null;
  let error = first.error;

  if (error) {
    const firstMsg = error.message;
    const second = await supabase
      .from('customers')
      .select(CUSTOMERS_LIST_SELECT_SAFE)
      .order('created_at', { ascending: false });
    rows = (second.data ?? null) as Record<string, unknown>[] | null;
    error = second.error;
    if (error) return { lista: [], error: `${firstMsg} · ${error.message}` };
  }

  if (!rows?.length) return { lista: [], error: null };

  const ids = rows.map((c) => String(c.id ?? '')).filter(Boolean);
  const obraCount = await contarObrasPorCliente(supabase, ids);
  return {
    lista: rows.map((c) => mapearClienteLista(c, obraCount.get(String(c.id ?? '')) ?? 0)),
    error: null,
  };
}
