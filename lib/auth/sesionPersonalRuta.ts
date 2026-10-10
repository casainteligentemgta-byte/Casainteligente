/**
 * Rutas de API del personal (RRHH, contratos): exigen sesión y luego trabajan con el
 * cliente del servidor.
 *
 * Reemplaza a `supabaseForRoute()`, un cliente anónimo sin sesión: con él estas rutas
 * respondían a cualquiera y, para funcionar, las tablas debían estar abiertas a todo el
 * mundo. Ahora primero se comprueba la sesión (cookie) y solo entonces se consulta.
 */
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export type ClientePersonalRuta =
  | { ok: true; client: ReturnType<typeof createSupabaseClient>; userId: string }
  | { ok: false; response: NextResponse };

export async function clientePersonalConSesion(): Promise<ClientePersonalRuta> {
  let userId = '';
  try {
    const sesion = await createClient();
    const {
      data: { user },
    } = await sesion.auth.getUser();
    userId = user?.id ?? '';
  } catch (e) {
    console.error('[sesión personal]', e instanceof Error ? e.message : e);
    return {
      ok: false,
      response: NextResponse.json({ error: 'No se pudo comprobar la sesión.' }, { status: 503 }),
    };
  }
  if (!userId) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'No autorizado. Inicie sesión.' }, { status: 401 }),
    };
  }

  const admin = supabaseAdminForRoute();
  if (!admin.ok) return admin;
  return { ok: true, client: admin.client, userId };
}
