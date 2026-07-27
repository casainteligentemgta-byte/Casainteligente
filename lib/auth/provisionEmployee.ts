import type { SupabaseClient } from '@supabase/supabase-js';
import { buscarUsuarioIdPorEmail } from '@/lib/auth/buscarUsuarioIdPorEmail';
import { upsertRolEmpresaUsuario } from '@/lib/auth/ciUsuariosRolesDb';
import { normalizarRolEmpresa } from '@/lib/auth/permisosCatalogo';
import {
  generateOneTimePassword,
  MUST_CHANGE_PASSWORD_KEY,
} from '@/lib/auth/passwordPolicy';

export type ProvisionMode = 'invite' | 'password';

export type ProvisionResult =
  | {
      ok: true;
      userId: string;
      created: boolean;
      email: string;
      mode: ProvisionMode;
      inviteEnviado: boolean;
      /** Solo presente en modo password; mostrar una vez al admin. */
      oneTimePassword?: string;
    }
  | { ok: false; error: string };

function baseUrlApp(req?: Request): string {
  const env =
    process.env.NEXT_PUBLIC_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    '';
  if (env) return env.replace(/\/$/, '');
  if (req) {
    const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
    const proto = req.headers.get('x-forwarded-proto') || 'https';
    if (host) return `${proto}://${host}`.replace(/\/$/, '');
  }
  return 'https://casainteligente.company';
}

async function vincularEmpleado(
  admin: SupabaseClient,
  employeeId: string | undefined,
  userId: string,
): Promise<string | null> {
  if (!employeeId) return null;
  const { error } = await admin
    .from('employees')
    .update({
      auth_user_id: userId,
      acceso_habilitado: true,
    })
    .eq('id', employeeId);
  return error?.message ?? null;
}

/**
 * Crea o vincula Auth para un empleado CRM.
 * - invite: correo de invitación (preferido); el usuario define su clave.
 * - password: clave aleatoria de un solo uso + must_change_password en app_metadata.
 * Si el usuario ya existe y mode=invite, solo vincula (no resetea clave).
 */
export async function provisionarAccesoEmpleado(
  admin: SupabaseClient,
  input: {
    email: string;
    employeeId?: string;
    nombres?: string;
    apellidos?: string;
    mode?: ProvisionMode;
    /** Si true en modo password, regenera clave aunque el usuario exista. */
    resetPassword?: boolean;
    rol?: string | null;
    entidadId?: string | null;
    request?: Request;
  },
): Promise<ProvisionResult> {
  const email = input.email.trim().toLowerCase();
  if (!email || !email.includes('@')) {
    return { ok: false, error: 'Correo inválido' };
  }

  const mode: ProvisionMode = input.mode === 'password' ? 'password' : 'invite';
  const displayName =
    [input.nombres, input.apellidos].filter(Boolean).join(' ').trim() ||
    email.split('@')[0] ||
    'Empleado';

  const userMeta = {
    nombre: displayName,
    nombres: input.nombres ?? null,
    apellidos: input.apellidos ?? null,
    employee_id: input.employeeId ?? null,
  };

  const lookup = await buscarUsuarioIdPorEmail(admin, email);
  const existingId = 'userId' in lookup ? lookup.userId : null;

  let userId: string | null = existingId;
  let created = false;
  let inviteEnviado = false;
  let oneTimePassword: string | undefined;

  if (mode === 'password') {
    oneTimePassword = generateOneTimePassword(14);

    if (existingId) {
      const { data: existing } = await admin.auth.admin.getUserById(existingId);
      const prevMeta = (existing?.user?.app_metadata ?? {}) as Record<string, unknown>;
      const { error } = await admin.auth.admin.updateUserById(existingId, {
        password: oneTimePassword,
        email_confirm: true,
        ban_duration: 'none',
        app_metadata: {
          ...prevMeta,
          employee_id: input.employeeId ?? null,
          [MUST_CHANGE_PASSWORD_KEY]: true,
        },
        user_metadata: userMeta,
      });
      if (error) return { ok: false, error: error.message };
    } else {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password: oneTimePassword,
        email_confirm: true,
        app_metadata: {
          employee_id: input.employeeId ?? null,
          [MUST_CHANGE_PASSWORD_KEY]: true,
        },
        user_metadata: userMeta,
      });
      if (error || !data.user) {
        return { ok: false, error: error?.message ?? 'No se pudo crear el usuario' };
      }
      userId = data.user.id;
      created = true;
    }
  } else if (existingId) {
    const { data: existing } = await admin.auth.admin.getUserById(existingId);
    const prevMeta = (existing?.user?.app_metadata ?? {}) as Record<string, unknown>;
    const { error } = await admin.auth.admin.updateUserById(existingId, {
      email_confirm: true,
      ban_duration: 'none',
      user_metadata: userMeta,
      app_metadata: {
        ...prevMeta,
        employee_id: input.employeeId ?? null,
      },
    });
    if (error) return { ok: false, error: error.message };
  } else {
    const redirectTo = `${baseUrlApp(input.request)}/auth/callback?next=${encodeURIComponent('/')}`;
    const { data: inviteData, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(
      email,
      {
        redirectTo,
        data: userMeta,
      },
    );
    if (inviteErr) {
      const again = await buscarUsuarioIdPorEmail(admin, email);
      if ('userId' in again) {
        userId = again.userId;
        const { data: existing } = await admin.auth.admin.getUserById(userId);
        const prevMeta = (existing?.user?.app_metadata ?? {}) as Record<string, unknown>;
        await admin.auth.admin.updateUserById(userId, {
          user_metadata: userMeta,
          app_metadata: {
            ...prevMeta,
            employee_id: input.employeeId ?? null,
          },
        });
      } else {
        return { ok: false, error: inviteErr.message || 'No se pudo enviar la invitación' };
      }
    } else {
      userId = inviteData.user?.id ?? null;
      inviteEnviado = Boolean(userId);
      created = Boolean(userId);
      if (userId) {
        const { data: existing } = await admin.auth.admin.getUserById(userId);
        const prevMeta = (existing?.user?.app_metadata ?? {}) as Record<string, unknown>;
        await admin.auth.admin.updateUserById(userId, {
          app_metadata: {
            ...prevMeta,
            employee_id: input.employeeId ?? null,
          },
        });
      }
    }
  }

  if (!userId) {
    return { ok: false, error: 'No se obtuvo el id del usuario Auth' };
  }

  const linkErr = await vincularEmpleado(admin, input.employeeId, userId);
  if (linkErr) {
    return { ok: false, error: `Auth OK, pero no se vinculó la ficha: ${linkErr}` };
  }

  const rolNorm = input.rol ? normalizarRolEmpresa(input.rol) : null;
  const entidadId = (input.entidadId ?? '').trim();
  if (rolNorm && entidadId) {
    const { error: rolErr } = await upsertRolEmpresaUsuario(admin, {
      userId,
      rol: rolNorm,
      entidadId,
    });
    if (rolErr) {
      return {
        ok: false,
        error: `Usuario vinculado, pero falló el rol: ${rolErr}`,
      };
    }
  }

  return {
    ok: true,
    userId,
    created,
    email,
    mode,
    inviteEnviado,
    ...(oneTimePassword ? { oneTimePassword } : {}),
  };
}

/** Regenera clave aleatoria + fuerza cambio. */
export async function resetPasswordEmpleado(
  admin: SupabaseClient,
  input: {
    userId: string;
    employeeId?: string;
  },
): Promise<ProvisionResult> {
  const oneTimePassword = generateOneTimePassword(14);
  const { data: userData, error: getErr } = await admin.auth.admin.getUserById(input.userId);
  if (getErr || !userData.user) {
    return { ok: false, error: getErr?.message ?? 'Usuario Auth no encontrado' };
  }

  const email = (userData.user.email ?? '').trim().toLowerCase();
  const { error } = await admin.auth.admin.updateUserById(input.userId, {
    password: oneTimePassword,
    email_confirm: true,
    ban_duration: 'none',
    app_metadata: {
      ...(userData.user.app_metadata ?? {}),
      employee_id: input.employeeId ?? userData.user.app_metadata?.employee_id ?? null,
      [MUST_CHANGE_PASSWORD_KEY]: true,
    },
  });
  if (error) return { ok: false, error: error.message };

  if (input.employeeId) {
    await admin
      .from('employees')
      .update({ acceso_habilitado: true, auth_user_id: input.userId })
      .eq('id', input.employeeId);
  }

  return {
    ok: true,
    userId: input.userId,
    created: false,
    email,
    mode: 'password',
    inviteEnviado: false,
    oneTimePassword,
  };
}
