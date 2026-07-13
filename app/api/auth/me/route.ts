import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { cookies } from 'next/headers'
import { getSessionUser, obtenerRolesUsuario } from '@/lib/auth/sessionRoles'
import { debeCambiarPassword, puedeResetearPassword } from '@/lib/auth/passwordPolicy'

export const dynamic = 'force-dynamic'

/** GET — Datos de sesión y permisos del usuario actual. */
export async function GET() {
    const user = await getSessionUser()
    if (!user) {
        return NextResponse.json({ authenticated: false }, { status: 401 })
    }

    const roles = await obtenerRolesUsuario(user)
    return NextResponse.json({
        authenticated: true,
        user: { id: user.id, email: user.email },
        roles,
        must_change_password: debeCambiarPassword(user.app_metadata as Record<string, unknown>),
        can_reset_password: puedeResetearPassword(roles),
    })
}

type ChangeBody = { password?: string }

/**
 * POST — Cambia la contraseña del usuario autenticado y limpia must_change_password.
 */
export async function POST(req: Request) {
    const supabase = createClient(cookies())
    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        return NextResponse.json({ error: 'Debe iniciar sesión' }, { status: 401 })
    }

    let body: ChangeBody
    try {
        body = (await req.json()) as ChangeBody
    } catch {
        return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
    }

    const password = (body.password ?? '').trim()
    if (password.length < 8) {
        return NextResponse.json(
            { error: 'La nueva clave debe tener al menos 8 caracteres' },
            { status: 400 },
        )
    }
    if (password === '12345678') {
        return NextResponse.json(
            { error: 'No puedes reutilizar la clave temporal. Elige otra.' },
            { status: 400 },
        )
    }

    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Limpiar flag en app_metadata (requiere service role)
    const admin = createAdminClient()
    if (admin) {
        const nextMeta = { ...(user.app_metadata ?? {}), must_change_password: false }
        await admin.auth.admin.updateUserById(user.id, { app_metadata: nextMeta })
    }

    return NextResponse.json({ ok: true, message: 'Clave actualizada correctamente' })
}
