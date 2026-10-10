/**
 * Lo que los formularios públicos de reclutamiento pueden ver sin iniciar sesión.
 *
 * Antes las páginas leían estas tablas directamente desde el navegador con la llave
 * pública del sitio, y por eso las tablas tenían que estar abiertas a cualquiera. Ahora
 * las leen rutas del servidor (app/api/reclutamiento/*) que devuelven solo estos campos
 * y solo para el enlace que trae el candidato:
 *   · la vacante, por su identificador (el que va en el enlace de postulación);
 *   · el resumen del contrato y los datos del patrono, por el token de invitación.
 *
 * Funciones sin Next ni variables de entorno: reciben el cliente y se pueden probar.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { PlanillaPatronoCampos } from '@/lib/talento/planillaPatronoTypes';
import { resolvePlanillaPatronoParaEmpleado } from '@/lib/talento/resolvePlanillaPatronoPdf';

/** Únicos campos de la vacante que salen al público. */
export const CAMPOS_VACANTE_PUBLICA =
  'id,title,cargo_nombre,cargo_codigo,cargo_nivel,tipo_vacante,protocol_active,proyecto_modulo_id';

export type VacantePublica = {
  id: string;
  title: string | null;
  cargo_nombre: string | null;
  cargo_codigo: string | null;
  cargo_nivel: number | null;
  tipo_vacante: string | null;
  protocol_active: boolean | null;
  proyecto_modulo_id: string | null;
};

export type FalloPublico = { ok: false; status: number; error: string; codigo?: string };

export function esUuid(valor: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(valor.trim());
}

/**
 * Un token de invitación es largo y sin espacios. Rechazar lo demás evita consultas
 * inútiles y que alguien pruebe valores cortos hasta acertar.
 */
export function esTokenInvitacionPlausible(valor: string): boolean {
  const t = valor.trim();
  return t.length >= 16 && t.length <= 200 && /^[A-Za-z0-9._~-]+$/.test(t);
}

function soloCamposVacante(fila: Record<string, unknown>): VacantePublica {
  const texto = (k: string) => (fila[k] == null ? null : String(fila[k]));
  const nivel = Number(fila.cargo_nivel);
  return {
    id: String(fila.id ?? ''),
    title: texto('title'),
    cargo_nombre: texto('cargo_nombre'),
    cargo_codigo: texto('cargo_codigo'),
    cargo_nivel: fila.cargo_nivel == null || !Number.isFinite(nivel) ? null : nivel,
    tipo_vacante: texto('tipo_vacante'),
    protocol_active: typeof fila.protocol_active === 'boolean' ? fila.protocol_active : null,
    proyecto_modulo_id: texto('proyecto_modulo_id'),
  };
}

async function nombreDeProyecto(supabase: SupabaseClient, proyectoId: string | null): Promise<string> {
  const pid = (proyectoId ?? '').trim();
  if (!pid) return '';
  const { data } = await supabase.from('ci_proyectos').select('nombre').eq('id', pid).maybeSingle();
  return String((data as unknown as { nombre?: string | null } | null)?.nombre ?? '').trim();
}

/** Vacante del enlace de postulación (`/reclutamiento?need=<id>`) y el nombre de su obra. */
export async function vacantePublicaPorId(
  supabase: SupabaseClient,
  needId: string,
): Promise<{ ok: true; need: VacantePublica; proyectoNombre: string } | FalloPublico> {
  const id = needId.trim();
  if (!esUuid(id)) return { ok: false, status: 400, error: 'Enlace de registro no válido.' };

  const { data, error } = await supabase
    .from('recruitment_needs')
    .select(CAMPOS_VACANTE_PUBLICA)
    .eq('id', id)
    .maybeSingle();
  if (error) return { ok: false, status: 500, error: 'No se pudo consultar la vacante.' };
  if (!data) return { ok: false, status: 404, error: 'No se encontró la vacante o el enlace expiró.' };

  const need = soloCamposVacante(data as unknown as Record<string, unknown>);
  return { ok: true, need, proyectoNombre: await nombreDeProyecto(supabase, need.proyecto_modulo_id) };
}

/** Vacantes de una obra, para el enlace antiguo `/registro?prj=<id>&role=<cargo>`. */
export async function vacantesPublicasDeProyecto(
  supabase: SupabaseClient,
  proyectoId: string,
): Promise<{ ok: true; needs: VacantePublica[] } | FalloPublico> {
  const pid = proyectoId.trim();
  if (!esUuid(pid)) return { ok: false, status: 400, error: 'El identificador de proyecto no es válido.' };

  const { data, error } = await supabase
    .from('recruitment_needs')
    .select(CAMPOS_VACANTE_PUBLICA)
    .eq('proyecto_modulo_id', pid)
    .order('created_at', { ascending: false });
  if (error) return { ok: false, status: 500, error: 'No se pudieron cargar las vacantes.' };

  return { ok: true, needs: ((data ?? []) as unknown as Record<string, unknown>[]).map(soloCamposVacante) };
}

/**
 * Expediente del candidato dueño del token. Busca primero por `token_registro` (el que
 * usan los enlaces actuales) y, si se pide, también por el `token` antiguo.
 */
export async function empleadoPorTokenInvitacion(
  supabase: SupabaseClient,
  token: string,
  columnas: string,
  opciones?: { tambienTokenAntiguo?: boolean },
): Promise<Record<string, unknown> | null> {
  const t = token.trim();
  if (!esTokenInvitacionPlausible(t)) return null;

  const { data } = await supabase.from('ci_empleados').select(columnas).eq('token_registro', t).maybeSingle();
  if (data) return data as unknown as Record<string, unknown>;
  if (!opciones?.tambienTokenAntiguo) return null;

  const antiguo = await supabase.from('ci_empleados').select(columnas).eq('token', t).maybeSingle();
  return (antiguo.data as unknown as Record<string, unknown> | null) ?? null;
}

export type ResumenContratoFirma = {
  nombre: string;
  cargo: string;
  salario_basico_diario_ves: number | null;
  obra: string;
};

/** Lo que el trabajador ve antes de firmar su contrato desde el enlace de firma. */
export async function resumenContratoParaFirma(
  supabase: SupabaseClient,
  token: string,
): Promise<({ ok: true } & ResumenContratoFirma) | FalloPublico> {
  if (!esTokenInvitacionPlausible(token)) {
    return { ok: false, status: 400, error: 'Enlace inválido.', codigo: 'enlace_invalido' };
  }

  const emp = await empleadoPorTokenInvitacion(supabase, token, 'id,nombre_completo');
  if (!emp) {
    return {
      ok: false,
      status: 404,
      error: 'No encontramos tu expediente. Verifica el enlace.',
      codigo: 'sin_expediente',
    };
  }

  const { data: ctr } = await supabase
    .from('ci_contratos_empleado_obra')
    .select('cargo_oficio_desempeño,salario_basico_diario_ves,lugar_prestacion_servicio,obra_id,proyecto_id')
    .eq('empleado_id', String(emp.id))
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!ctr) {
    return {
      ok: false,
      status: 404,
      error: 'Aún no hay contrato generado. Cuando RRHH lo emita, podrás firmar desde este enlace.',
      codigo: 'sin_contrato',
    };
  }

  const c = ctr as unknown as Record<string, unknown>;
  let obra = String(c.lugar_prestacion_servicio ?? '').trim();
  if (!obra) {
    obra = await nombreDeProyecto(supabase, String(c.obra_id ?? c.proyecto_id ?? '').trim() || null);
  }
  const salario = Number(c.salario_basico_diario_ves);

  return {
    ok: true,
    nombre: String(emp.nombre_completo ?? '').trim() || 'Trabajador',
    cargo: String(c['cargo_oficio_desempeño'] ?? '').trim() || '—',
    salario_basico_diario_ves:
      c.salario_basico_diario_ves == null || !Number.isFinite(salario) ? null : salario,
    obra: obra || '—',
  };
}

/** Datos del patrono para la planilla que el candidato llena con su token. */
export async function patronoPlanillaPorToken(
  supabase: SupabaseClient,
  token: string,
): Promise<{ ok: true; planillaPatrono: PlanillaPatronoCampos } | FalloPublico> {
  if (!esTokenInvitacionPlausible(token)) {
    return { ok: false, status: 400, error: 'Enlace inválido.', codigo: 'enlace_invalido' };
  }
  const emp = await empleadoPorTokenInvitacion(
    supabase,
    token,
    'id,proyecto_modulo_id,recruitment_need_id,hoja_vida_obrero',
    { tambienTokenAntiguo: true },
  );
  if (!emp) {
    return { ok: false, status: 404, error: 'No se encontró el expediente del enlace.', codigo: 'sin_expediente' };
  }
  return { ok: true, planillaPatrono: await resolvePlanillaPatronoParaEmpleado(supabase, emp) };
}
