import { apiUrl } from '@/lib/http/apiUrl';
import type { ProvisionMode } from '@/lib/auth/provisionEmployee';

export type ProvisionarPayload = {
  employeeId: string;
  email: string;
  nombres?: string;
  apellidos?: string;
  mode?: ProvisionMode;
  rol?: string | null;
  entidadId?: string | null;
};

export type ProvisionarOk = {
  ok: true;
  message: string;
  oneTimePassword?: string | null;
  inviteEnviado?: boolean;
};

export async function provisionarAccesoEmpleadoClient(
  payload: ProvisionarPayload,
): Promise<ProvisionarOk | { ok: false; error: string }> {
  const email = payload.email.trim();
  if (!email) return { ok: false, error: 'Sin correo: no se habilitó acceso' };

  try {
    const res = await fetch(apiUrl('/api/empleados/provisionar-acceso'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      message?: string;
      one_time_password?: string | null;
      invite_enviado?: boolean;
    };
    if (!res.ok) {
      return { ok: false, error: data.error || 'No se pudo habilitar el acceso' };
    }
    return {
      ok: true,
      message: data.message || 'Acceso configurado',
      oneTimePassword: data.one_time_password ?? null,
      inviteEnviado: data.invite_enviado,
    };
  } catch {
    return { ok: false, error: 'Error de red al habilitar el acceso' };
  }
}

export async function resetPasswordEmpleadoClient(
  employeeId: string,
): Promise<ProvisionarOk | { ok: false; error: string }> {
  try {
    const res = await fetch(apiUrl('/api/empleados/reset-password'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ employeeId }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      message?: string;
      one_time_password?: string | null;
    };
    if (!res.ok) {
      return { ok: false, error: data.error || 'No se pudo regenerar la clave' };
    }
    return {
      ok: true,
      message: data.message || 'Clave regenerada',
      oneTimePassword: data.one_time_password ?? null,
    };
  } catch {
    return { ok: false, error: 'Error de red al regenerar la clave' };
  }
}
