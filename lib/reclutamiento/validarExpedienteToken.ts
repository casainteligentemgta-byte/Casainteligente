import type { SupabaseClient } from '@supabase/supabase-js';

export type ExpedienteEmpleadoResumen = {
  nombre: string;
  cargo: string;
};

export type ValidarExpedienteTokenOk = {
  valid: true;
  empleado: ExpedienteEmpleadoResumen;
  empleadoId: string;
  /** Origen de la validación (tabla nueva o legado token_registro). */
  source: 'expediente_tokens' | 'ci_empleados';
};

export type ValidarExpedienteTokenErr = {
  valid: false;
  error: string;
  status: number;
};

function empleadoResumenDesdeRow(row: {
  nombre_completo?: string | null;
  cargo_nombre?: string | null;
  cargo?: string | null;
  rol_buscado?: string | null;
}): ExpedienteEmpleadoResumen {
  const nombre = (row.nombre_completo ?? '').trim() || 'Sin nombre';
  const cargo =
    (row.cargo_nombre ?? '').trim() ||
    (row.cargo ?? '').trim() ||
    (row.rol_buscado ?? '').trim() ||
    'Por definir';
  return { nombre, cargo };
}

async function cargarEmpleadoPorId(
  admin: SupabaseClient,
  empleadoId: string,
): Promise<{ id: string; resumen: ExpedienteEmpleadoResumen } | null> {
  const { data, error } = await admin
    .from('ci_empleados')
    .select('id,nombre_completo,cargo_nombre,cargo,rol_buscado')
    .eq('id', empleadoId)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as {
    id: string;
    nombre_completo?: string | null;
    cargo_nombre?: string | null;
    cargo?: string | null;
    rol_buscado?: string | null;
  };
  return { id: row.id, resumen: empleadoResumenDesdeRow(row) };
}

/**
 * Valida token de expediente (tabla `expediente_tokens`) o, en su defecto,
 * `ci_empleados.token_registro` / `token` (enlaces legados sin fila en expediente_tokens).
 */
export async function validarExpedienteToken(
  admin: SupabaseClient,
  tokenRaw: string,
): Promise<ValidarExpedienteTokenOk | ValidarExpedienteTokenErr> {
  const token = tokenRaw.trim();
  if (!token) {
    return { valid: false, error: 'Token requerido', status: 400 };
  }

  const { data: tokRow, error: tokErr } = await admin
    .from('expediente_tokens')
    .select('id, hoja_vida_id, expires_at, is_used')
    .eq('token', token)
    .maybeSingle();

  if (!tokErr && tokRow) {
    const row = tokRow as {
      hoja_vida_id: string;
      expires_at: string;
      is_used: boolean;
    };
    const now = new Date();
    const expiresAt = new Date(row.expires_at);
    if (now > expiresAt || row.is_used) {
      return {
        valid: false,
        error: 'El enlace ha expirado o ya fue utilizado',
        status: 410,
      };
    }
    const emp = await cargarEmpleadoPorId(admin, row.hoja_vida_id);
    if (!emp) {
      return { valid: false, error: 'Expediente no encontrado', status: 404 };
    }
    return {
      valid: true,
      empleado: emp.resumen,
      empleadoId: emp.id,
      source: 'expediente_tokens',
    };
  }

  const schemaMissing =
    tokErr &&
    /expediente_tokens|schema cache|relation.*does not exist|42P01/i.test(tokErr.message ?? '');

  if (tokErr && !schemaMissing) {
    return { valid: false, error: tokErr.message, status: 500 };
  }

  const sel = 'id,nombre_completo,cargo_nombre,cargo,rol_buscado';
  let leg: Record<string, unknown> | null = null;
  const byReg = await admin.from('ci_empleados').select(sel).eq('token_registro', token).maybeSingle();
  if (byReg.error) {
    return { valid: false, error: byReg.error.message, status: 500 };
  }
  if (byReg.data) {
    leg = byReg.data as Record<string, unknown>;
  } else {
    const byTok = await admin.from('ci_empleados').select(sel).eq('token', token).maybeSingle();
    if (byTok.error) {
      return { valid: false, error: byTok.error.message, status: 500 };
    }
    leg = (byTok.data as Record<string, unknown> | null) ?? null;
  }

  if (!leg) {
    return { valid: false, error: 'Enlace no válido o inexistente', status: 404 };
  }

  const emp = leg as {
    id: string;
    nombre_completo?: string | null;
    cargo_nombre?: string | null;
    cargo?: string | null;
    rol_buscado?: string | null;
  };

  return {
    valid: true,
    empleado: empleadoResumenDesdeRow(emp),
    empleadoId: emp.id,
    source: 'ci_empleados',
  };
}

/** Registra enlace como usado (opcional al completar onboarding). */
/** Crea fila en expediente_tokens (ignora si la tabla aún no existe). */
export async function crearExpedienteToken(
  admin: SupabaseClient,
  params: { token: string; empleadoId: string; expiresAt: string },
): Promise<void> {
  const token = params.token.trim();
  const empleadoId = params.empleadoId.trim();
  if (!token || !empleadoId) return;
  const { error } = await admin.from('expediente_tokens').insert({
    token,
    hoja_vida_id: empleadoId,
    expires_at: params.expiresAt,
    is_used: false,
  } as never);
  if (error && !/expediente_tokens|schema cache|does not exist|42P01/i.test(error.message ?? '')) {
    console.warn('[crearExpedienteToken]', error.message);
  }
}

export async function marcarExpedienteTokenUsado(
  admin: SupabaseClient,
  tokenRaw: string,
): Promise<void> {
  const token = tokenRaw.trim();
  if (!token) return;
  await admin
    .from('expediente_tokens')
    .update({ is_used: true, used_at: new Date().toISOString() } as never)
    .eq('token', token)
    .eq('is_used', false);
}
