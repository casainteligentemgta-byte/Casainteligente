import type { SupabaseClient, User } from '@supabase/supabase-js'
import { createClient as createServerSupabase } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { cookies } from 'next/headers'
import { puedeResetearPassword, normalizarRol } from '@/lib/auth/passwordPolicy'

export async function getSessionUser(): Promise<User | null> {
    const supabase = createServerSupabase(cookies())
    const {
        data: { user },
    } = await supabase.auth.getUser()
    return user
}

/** Roles del usuario desde app_metadata y/o ci_roles_acceso. */
export async function obtenerRolesUsuario(
    user: User,
    admin?: SupabaseClient | null,
): Promise<string[]> {
    const roles = new Set<string>()

    const metaRol = user.app_metadata?.rol ?? user.app_metadata?.role
    if (typeof metaRol === 'string' && metaRol.trim()) {
        roles.add(normalizarRol(metaRol))
    }
    const metaRoles = user.app_metadata?.roles
    if (Array.isArray(metaRoles)) {
        for (const r of metaRoles) {
            if (typeof r === 'string' && r.trim()) roles.add(normalizarRol(r))
        }
    }

    const client = admin ?? createAdminClient()
    if (client) {
        const { data } = await client
            .from('ci_roles_acceso')
            .select('rol')
            .eq('user_id', user.id)
        for (const row of data ?? []) {
            if (row?.rol) roles.add(normalizarRol(String(row.rol)))
        }

        // Compatibilidad con ci_usuarios_roles (rama de integración)
        const byUserId = await client
            .from('ci_usuarios_roles')
            .select('rol')
            .eq('user_id', user.id)
        if (!byUserId.error) {
            for (const row of byUserId.data ?? []) {
                if (row?.rol) roles.add(normalizarRol(String(row.rol)))
            }
        } else {
            const byUsuarioId = await client
                .from('ci_usuarios_roles')
                .select('rol')
                .eq('usuario_id', user.id)
            for (const row of byUsuarioId.data ?? []) {
                if (row?.rol) roles.add(normalizarRol(String(row.rol)))
            }
        }
    }

    return Array.from(roles)
}

export async function assertPuedeResetearPassword(user: User): Promise<{
    ok: true
    roles: string[]
} | {
    ok: false
    status: number
    error: string
}> {
    const admin = createAdminClient()
    const roles = await obtenerRolesUsuario(user, admin)
    if (!puedeResetearPassword(roles)) {
        return {
            ok: false,
            status: 403,
            error:
                'Solo el administrador dueño o el administrador general pueden resetear claves. El administrador contable no tiene este permiso.',
        }
    }
    return { ok: true, roles }
}
