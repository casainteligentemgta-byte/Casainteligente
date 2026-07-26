import type { SupabaseClient } from '@supabase/supabase-js';

export type CustomerDetail = {
  id: string;
  nombre: string | null;
  customer_type: 'natural' | 'juridico' | null;
  tipo: string | null;
  apellido: string | null;
  cedula: string | null;
  rif: string | null;
  razon_social: string | null;
  representante_legal: string | null;
  genero: string | null;
  estado_civil: string | null;
  profesion: string | null;
  direccion: string | null;
  email: string | null;
  telefono: string | null;
  movil: string | null;
  created_at: string | null;
};

const SELECT_FULL =
  'id,nombre,apellido,customer_type,tipo,cedula,rif,razon_social,representante_legal,genero,estado_civil,profesion,direccion,email,telefono,movil,created_at';

const SELECT_FALLBACKS = [
  'id,nombre,apellido,customer_type,tipo,cedula,rif,razon_social,representante_legal,direccion,email,telefono,movil,created_at',
  'id,nombre,customer_type,tipo,cedula,rif,razon_social,representante_legal,direccion,email,telefono,movil,created_at',
  'id,nombre,tipo,cedula,rif,razon_social,representante_legal,direccion,email,telefono,movil,created_at',
  'id,nombre,tipo,rif,direccion,email,telefono,movil,created_at',
  'id,nombre,tipo,rif,direccion,email,movil,created_at',
  'id,nombre,rif,email,movil,tipo,direccion,created_at',
] as const;

function columnaFaltante(message: string): string | null {
  const m1 = /Could not find the '(\w+)' column of 'customers'/i.exec(message);
  if (m1?.[1]) return m1[1];
  const m2 = /column ['"]?(\w+)['"]? of relation ['"]?customers['"]?/i.exec(message);
  if (m2?.[1]) return m2[1];
  const m3 = /column customers\.(\w+) does not exist/i.exec(message);
  if (m3?.[1]) return m3[1];
  return null;
}

function esErrorColumnaCustomers(message: string): boolean {
  if (/Could not find the '\w+' column of 'customers'/i.test(message)) return true;
  if (/column customers\.\w+ does not exist/i.test(message)) return true;
  return (
    /customers/i.test(message) &&
    (/schema cache/i.test(message) || /column/i.test(message) || /does not exist/i.test(message))
  );
}

function inferirCustomerType(row: Record<string, unknown>): 'natural' | 'juridico' | null {
  const ct = String(row.customer_type ?? '').toLowerCase();
  if (ct === 'juridico' || ct === 'natural') return ct;
  const tipo = String(row.tipo ?? '');
  if (/jurid|empresa/i.test(tipo) || tipo.trim().toUpperCase() === 'J') return 'juridico';
  if (tipo.trim()) return 'natural';
  if (row.rif && !row.cedula) return 'juridico';
  return 'natural';
}

function normalizarDetalle(row: Record<string, unknown> | null): CustomerDetail | null {
  if (!row) return null;
  const telefono =
    (typeof row.telefono === 'string' && row.telefono) ||
    (typeof row.movil === 'string' && row.movil) ||
    null;
  return {
    id: String(row.id),
    nombre: typeof row.nombre === 'string' ? row.nombre : null,
    customer_type: inferirCustomerType(row),
    tipo: typeof row.tipo === 'string' ? row.tipo : null,
    apellido: typeof row.apellido === 'string' ? row.apellido : null,
    cedula: typeof row.cedula === 'string' ? row.cedula : null,
    rif: typeof row.rif === 'string' ? row.rif : null,
    razon_social: typeof row.razon_social === 'string' ? row.razon_social : null,
    representante_legal: typeof row.representante_legal === 'string' ? row.representante_legal : null,
    genero: typeof row.genero === 'string' ? row.genero : null,
    estado_civil: typeof row.estado_civil === 'string' ? row.estado_civil : null,
    profesion: typeof row.profesion === 'string' ? row.profesion : null,
    direccion: typeof row.direccion === 'string' ? row.direccion : null,
    email: typeof row.email === 'string' ? row.email : null,
    telefono,
    movil: typeof row.movil === 'string' ? row.movil : null,
    created_at: typeof row.created_at === 'string' ? row.created_at : null,
  };
}

/**
 * Carga un cliente tolerando schemas antiguos (sin customer_type, sin datos de contrato, etc.).
 */
export async function cargarClienteDetalle(
  supabase: SupabaseClient,
  id: string,
): Promise<{ data: CustomerDetail | null; error: string | null }> {
  const selects = [SELECT_FULL, ...SELECT_FALLBACKS];
  let lastError: string | null = null;

  for (const select of selects) {
    const { data, error } = await supabase.from('customers').select(select).eq('id', id).maybeSingle();
    if (!error) {
      return { data: normalizarDetalle((data as Record<string, unknown> | null) ?? null), error: null };
    }
    lastError = error.message;
    if (!esErrorColumnaCustomers(error.message)) {
      return { data: null, error: error.message };
    }
    // Si sabemos la columna, el siguiente fallback ya la omite; seguir.
    void columnaFaltante(error.message);
  }

  return { data: null, error: lastError ?? 'No se pudo cargar el cliente.' };
}
