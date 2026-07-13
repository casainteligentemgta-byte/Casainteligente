import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSessionUser, assertPuedeResetearPassword } from '@/lib/auth/sessionRoles'
import { TEMP_PASSWORD } from '@/lib/auth/passwordPolicy'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Body = {
    employeeId?: string
    email?: string
    userId?: string
}

/**
 * POST — Resetea la clave del empleado a 12345678 y fuerza cambio al entrar.
 * Solo administrador dueño o administrador general (no contable).
 */
export async function POST(req: Request) {
    const sessionUser = await getSessionUser()
    if (!sessionUser) {
        return NextResponse.json({ error: 'Debe iniciar sesión' }, { status: 401 })
    }

    const authz = await assertPuedeResetearPassword(sessionUser)
    if (!authz.ok) {
        return NextResponse.json({ error: authz.error }, { status: authz.status })
    }

    const admin = createAdminClient()
    if (!admin) {
        return NextResponse.json(
            { error: 'Falta SUPABASE_SERVICE_ROLE_KEY en el servidor', code: 'SUPABASE_ADMIN_CONFIG' },
            { status: 503 },
        )
    }

    let body: Body
    try {
        body = (await req.json()) as Body
    } catch {
        return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
    }

    let targetUserId = (body.userId ?? '').trim()
    let email = (body.email ?? '').trim().toLowerCase()

    if (body.employeeId) {
        const { data: emp, error } = await admin
            .from('employees')
            .select('id, email, auth_user_id, nombres, apellidos')
            .eq('id', body.employeeId)
            .maybeSingle()

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 })
        }
        if (!emp) {
            return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 })
        }

        email = (emp.email ?? email).trim().toLowerCase()
        targetUserId = emp.auth_user_id || targetUserId

        if (!targetUserId && email) {
            // Buscar por correo si no hay auth_user_id guardado
            for (let page = 1; page <= 5; page++) {
                const { data } = await admin.auth.admin.listUsers({ page, perPage: 200 })
                const found = data.users.find(
                    (u) => (u.email ?? '').trim().toLowerCase() === email,
                )
                if (found) {
                    targetUserId = found.id
                    break
                }
                if (data.users.length < 200) break
            }
        }

        if (!targetUserId) {
            return NextResponse.json(
                { error: 'El empleado aún no tiene usuario de acceso. Habilítalo primero desde editar/nuevo.' },
                { status: 404 },
            )
        }

        const { error: updErr } = await admin.auth.admin.updateUserById(targetUserId, {
            password: TEMP_PASSWORD,
            email_confirm: true,
            app_metadata: {
                must_change_password: true,
                employee_id: emp.id,
            },
        })
        if (updErr) {
            return NextResponse.json({ error: updErr.message }, { status: 400 })
        }

        await admin
            .from('employees')
            .update({ auth_user_id: targetUserId, acceso_habilitado: true })
            .eq('id', emp.id)

        return NextResponse.json({
            ok: true,
            userId: targetUserId,
            email,
            temporaryPassword: TEMP_PASSWORD,
            message: `Clave restablecida a ${TEMP_PASSWORD}. El empleado debe cambiarla al ingresar.`,
        })
    }

    if (!targetUserId) {
        return NextResponse.json({ error: 'employeeId o userId requerido' }, { status: 400 })
    }

    const { error: updErr } = await admin.auth.admin.updateUserById(targetUserId, {
        password: TEMP_PASSWORD,
        app_metadata: { must_change_password: true },
    })
    if (updErr) {
        return NextResponse.json({ error: updErr.message }, { status: 400 })
    }

    return NextResponse.json({
        ok: true,
        userId: targetUserId,
        temporaryPassword: TEMP_PASSWORD,
        message: `Clave restablecida a ${TEMP_PASSWORD}.`,
    })
}
