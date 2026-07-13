import type { SupabaseClient } from '@supabase/supabase-js'
import { TEMP_PASSWORD } from '@/lib/auth/passwordPolicy'

export type ProvisionResult =
    | { ok: true; userId: string; created: boolean; email: string }
    | { ok: false; error: string }

async function findUserIdByEmail(
    admin: SupabaseClient,
    email: string,
): Promise<string | null> {
    const normalized = email.trim().toLowerCase()
    const authAdmin = admin.auth.admin as {
        listUsers: (opts: { page?: number; perPage?: number }) => Promise<{
            data: { users: { id: string; email?: string | null }[] }
            error: { message: string } | null
        }>
    }

    // Paginación simple (hasta 5 páginas)
    for (let page = 1; page <= 5; page++) {
        const { data, error } = await authAdmin.listUsers({ page, perPage: 200 })
        if (error) return null
        const found = data.users.find(
            (u) => (u.email ?? '').trim().toLowerCase() === normalized,
        )
        if (found) return found.id
        if (data.users.length < 200) break
    }
    return null
}

/**
 * Crea o vincula usuario Auth para el empleado.
 * - Si el usuario no existe: lo crea con clave temporal 12345678 y must_change_password.
 * - Si ya existe: solo vincula metadatos; NO resetea la clave (usar reset-password para eso).
 */
export async function provisionarAccesoEmpleado(
    admin: SupabaseClient,
    input: {
        email: string
        employeeId?: string
        nombres?: string
        apellidos?: string
        /** Si true, vuelve a poner clave temporal (crear o reset). */
        resetPassword?: boolean
    },
): Promise<ProvisionResult> {
    const email = input.email.trim().toLowerCase()
    if (!email || !email.includes('@')) {
        return { ok: false, error: 'Correo inválido' }
    }

    const existingId = await findUserIdByEmail(admin, email)
    const reset = Boolean(input.resetPassword)

    if (existingId) {
        const patch: {
            email_confirm?: boolean
            ban_duration?: string
            password?: string
            app_metadata?: Record<string, unknown>
            user_metadata?: Record<string, unknown>
        } = {
            email_confirm: true,
            ban_duration: 'none',
            app_metadata: {
                employee_id: input.employeeId ?? null,
                rol: 'empleado',
                ...(reset ? { must_change_password: true } : {}),
            },
            user_metadata: {
                nombres: input.nombres ?? null,
                apellidos: input.apellidos ?? null,
            },
        }
        if (reset) {
            patch.password = TEMP_PASSWORD
        }

        const { error } = await admin.auth.admin.updateUserById(existingId, patch)
        if (error) return { ok: false, error: error.message }
        return { ok: true, userId: existingId, created: false, email }
    }

    const { data, error } = await admin.auth.admin.createUser({
        email,
        password: TEMP_PASSWORD,
        email_confirm: true,
        app_metadata: {
            must_change_password: true,
            employee_id: input.employeeId ?? null,
            rol: 'empleado',
        },
        user_metadata: {
            nombres: input.nombres ?? null,
            apellidos: input.apellidos ?? null,
        },
    })

    if (error || !data.user) {
        return { ok: false, error: error?.message ?? 'No se pudo crear el usuario' }
    }

    return { ok: true, userId: data.user.id, created: true, email }
}
