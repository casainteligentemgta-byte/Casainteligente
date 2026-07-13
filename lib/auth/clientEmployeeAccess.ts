import { TEMP_PASSWORD } from '@/lib/auth/passwordPolicy'

export type ProvisionarPayload = {
    employeeId: string
    email: string
    nombres?: string
    apellidos?: string
}

export async function provisionarAccesoEmpleadoClient(
    payload: ProvisionarPayload,
): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
    const email = payload.email.trim()
    if (!email) return { ok: false, error: 'Sin correo: no se habilitó acceso' }

    try {
        const res = await fetch('/api/empleados/provisionar-acceso', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(payload),
        })
        const data = (await res.json().catch(() => ({}))) as {
            error?: string
            message?: string
            hint?: string
        }
        if (!res.ok) {
            return {
                ok: false,
                error: [data.error, data.hint].filter(Boolean).join(' — ') || 'No se pudo habilitar el acceso',
            }
        }
        return {
            ok: true,
            message:
                data.message ||
                `Acceso habilitado. Clave temporal: ${TEMP_PASSWORD}. Debe cambiarla al primer ingreso.`,
        }
    } catch {
        return { ok: false, error: 'Error de red al habilitar el acceso' }
    }
}

export async function resetPasswordEmpleadoClient(
    employeeId: string,
): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
    try {
        const res = await fetch('/api/empleados/reset-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ employeeId }),
        })
        const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string }
        if (!res.ok) {
            return { ok: false, error: data.error || 'No se pudo resetear la clave' }
        }
        return {
            ok: true,
            message: data.message || `Clave restablecida a ${TEMP_PASSWORD}`,
        }
    } catch {
        return { ok: false, error: 'Error de red al resetear la clave' }
    }
}
