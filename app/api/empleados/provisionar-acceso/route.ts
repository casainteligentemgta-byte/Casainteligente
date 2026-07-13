import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { provisionarAccesoEmpleado } from '@/lib/auth/provisionEmployee'
import { TEMP_PASSWORD } from '@/lib/auth/passwordPolicy'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Body = {
    employeeId?: string
    email?: string
    nombres?: string
    apellidos?: string
}

/**
 * POST — Crea/habilita usuario Auth del empleado con clave temporal 12345678.
 * Requiere SUPABASE_SERVICE_ROLE_KEY en el servidor.
 */
export async function POST(req: Request) {
    const admin = createAdminClient()
    if (!admin) {
        return NextResponse.json(
            {
                error:
                    'Falta SUPABASE_SERVICE_ROLE_KEY en el servidor. Configúrala en Vercel y vuelve a desplegar.',
                code: 'SUPABASE_ADMIN_CONFIG',
            },
            { status: 503 },
        )
    }

    let body: Body
    try {
        body = (await req.json()) as Body
    } catch {
        return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
    }

    const email = (body.email ?? '').trim()
    if (!email) {
        return NextResponse.json({ error: 'email requerido' }, { status: 400 })
    }

    const result = await provisionarAccesoEmpleado(admin, {
        email,
        employeeId: body.employeeId,
        nombres: body.nombres,
        apellidos: body.apellidos,
    })

    if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 400 })
    }

    if (body.employeeId) {
        await admin
            .from('employees')
            .update({
                auth_user_id: result.userId,
                acceso_habilitado: true,
            })
            .eq('id', body.employeeId)
    }

    return NextResponse.json({
        ok: true,
        userId: result.userId,
        created: result.created,
        email: result.email,
        temporaryPassword: result.created ? TEMP_PASSWORD : undefined,
        message: result.created
            ? `Usuario creado. Clave temporal: ${TEMP_PASSWORD}. Debe cambiarla al primer ingreso.`
            : 'Acceso vinculado al correo existente (sin cambiar la clave actual).',
    })
}
