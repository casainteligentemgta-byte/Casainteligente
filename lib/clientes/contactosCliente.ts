import type { SupabaseClient } from '@supabase/supabase-js';

export const CANALES_CONTACTO_CLIENTE = ['whatsapp', 'llamada', 'telegram', 'email', 'otro'] as const;
export type CanalContactoCliente = (typeof CANALES_CONTACTO_CLIENTE)[number];

export type ContactoCliente = {
  id: string;
  customer_id: string;
  fecha: string;
  canal: CanalContactoCliente | string;
  nota: string | null;
  usuario_id: string | null;
  usuario_nombre: string | null;
};

export function esCanalContacto(v: unknown): v is CanalContactoCliente {
  return (CANALES_CONTACTO_CLIENTE as readonly string[]).includes(String(v ?? '').trim());
}

export function etiquetaCanalContacto(canal: string | null | undefined): string {
  const c = String(canal ?? '').trim().toLowerCase();
  if (c === 'whatsapp') return 'WhatsApp';
  if (c === 'llamada') return 'Llamada';
  if (c === 'telegram') return 'Telegram';
  if (c === 'email') return 'Email';
  return 'Otro';
}

export function hintMigracionContactos(message: string | null | undefined): boolean {
  return /ci_cliente_contactos|does not exist|schema cache/i.test(String(message ?? ''));
}

export function normalizarContactosCliente(filas: unknown): ContactoCliente[] {
  if (!Array.isArray(filas)) return [];
  return filas
    .map((f) => {
      const r = (f ?? {}) as Record<string, unknown>;
      const id = String(r.id ?? '').trim();
      const customer_id = String(r.customer_id ?? '').trim();
      if (!id || !customer_id) return null;
      const canal = String(r.canal ?? 'otro').trim() || 'otro';
      return {
        id,
        customer_id,
        fecha: typeof r.fecha === 'string' && r.fecha ? r.fecha : String(r.created_at ?? ''),
        canal,
        nota: typeof r.nota === 'string' && r.nota.trim() ? r.nota.trim() : null,
        usuario_id: typeof r.usuario_id === 'string' && r.usuario_id ? r.usuario_id : null,
        usuario_nombre:
          typeof r.usuario_nombre === 'string' && r.usuario_nombre.trim() ? r.usuario_nombre.trim() : null,
      };
    })
    .filter((x): x is ContactoCliente => Boolean(x));
}

export async function cargarContactosCliente(
  supabase: SupabaseClient,
  customerId: string,
): Promise<{ contactos: ContactoCliente[]; error: string | null; migracionPendiente: boolean }> {
  const id = customerId.trim();
  if (!id) return { contactos: [], error: null, migracionPendiente: false };
  const { data, error } = await supabase
    .from('ci_cliente_contactos')
    .select('id,customer_id,fecha,canal,nota,usuario_id,usuario_nombre,created_at')
    .eq('customer_id', id)
    .order('fecha', { ascending: false });
  if (error) {
    return {
      contactos: [],
      error: hintMigracionContactos(error.message)
        ? 'Aplique la migración 389_customers_entidad_rls_contactos.sql'
        : error.message,
      migracionPendiente: hintMigracionContactos(error.message),
    };
  }
  return { contactos: normalizarContactosCliente(data), error: null, migracionPendiente: false };
}

export async function registrarContactoCliente(
  supabase: SupabaseClient,
  input: {
    customerId: string;
    canal: CanalContactoCliente;
    nota?: string | null;
    usuarioId?: string | null;
    usuarioNombre?: string | null;
  },
): Promise<{ contacto: ContactoCliente | null; error: string | null; migracionPendiente: boolean }> {
  const customer_id = input.customerId.trim();
  if (!customer_id) return { contacto: null, error: 'Falta el cliente.', migracionPendiente: false };
  const fila = {
    customer_id,
    canal: input.canal,
    nota: input.nota?.trim() || null,
    usuario_id: input.usuarioId?.trim() || null,
    usuario_nombre: input.usuarioNombre?.trim() || null,
  };
  const { data, error } = await supabase
    .from('ci_cliente_contactos')
    .insert(fila)
    .select('id,customer_id,fecha,canal,nota,usuario_id,usuario_nombre,created_at')
    .maybeSingle();
  if (error) {
    return {
      contacto: null,
      error: hintMigracionContactos(error.message)
        ? 'Aplique la migración 389_customers_entidad_rls_contactos.sql'
        : error.message,
      migracionPendiente: hintMigracionContactos(error.message),
    };
  }
  const lista = normalizarContactosCliente(data ? [data] : []);
  return { contacto: lista[0] ?? null, error: null, migracionPendiente: false };
}
