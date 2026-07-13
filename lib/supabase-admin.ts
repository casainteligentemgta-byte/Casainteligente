import { createClient } from '@supabase/supabase-js';

/**
 * Cliente de Supabase con service role para operaciones privilegiadas
 * (Storage, inserts que bypass RLS). Solo usar en servidor.
 */
export function createAdminClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceRoleKey) {
        throw new Error(
            'Configuración de Supabase incompleta. Verifica NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.'
        );
    }

    return createClient(url, serviceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });
}
