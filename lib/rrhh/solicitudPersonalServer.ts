import { createHmac, randomUUID } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveSupabaseServiceRoleKey } from '@/lib/supabase/resolveServiceRoleKey';

/**
 * Solicitud de personal (una fila de `recruitment_needs` por obra + oficio).
 * El enlace abierto de la solicitud es `/registro?need=<id>`:
 *  - sin más parámetros → la evaluación es obligatoria;
 *  - con `&m=<código>` válido → sin evaluación.
 * El código lo firma el servidor: quitarlo o cambiarlo solo puede AÑADIR la evaluación, nunca saltarla.
 */
export function codigoSinEvaluacion(solicitudId: string): string {
  const secreto = resolveSupabaseServiceRoleKey();
  const id = solicitudId.trim();
  if (!secreto || !id) return '';
  return createHmac('sha256', secreto).update(`solicitud-sin-evaluacion:${id}`).digest('hex').slice(0, 14);
}

export function esCodigoSinEvaluacionValido(solicitudId: string, codigo: string | null | undefined): boolean {
  const esperado = codigoSinEvaluacion(solicitudId);
  const c = (codigo ?? '').trim();
  return Boolean(esperado) && c.length === esperado.length && c === esperado;
}

export function enlacesAbiertosSolicitud(base: string, solicitudId: string): { sin: string; con: string } {
  const b = base.replace(/\/$/, '');
  const con = `${b}/registro?need=${encodeURIComponent(solicitudId)}`;
  const cod = codigoSinEvaluacion(solicitudId);
  return { con, sin: cod ? `${con}&m=${cod}` : con };
}

export function baseUrlPublica(req: Request): string {
  const trim = (u: string) => u.trim().replace(/\/$/, '');
  const origin = trim(req.headers.get('origin') ?? '');
  if (origin && /^https?:\/\//i.test(origin)) return origin;
  const env = trim(process.env.NEXT_PUBLIC_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? '');
  if (env && /^https?:\/\//i.test(env)) return env;
  try {
    return trim(new URL(req.url).origin);
  } catch {
    return '';
  }
}

/** Solo dígitos de la cédula («V-12.345.678» → «12345678»). */
export function digitosCedula(raw: unknown): string {
  return String(raw ?? '').replace(/\D/g, '');
}

const DIAS_ENLACE = 15;
export function expiraEnDias(dias = DIAS_ENLACE): string {
  return new Date(Date.now() + dias * 24 * 60 * 60 * 1000).toISOString();
}

/**
 * Deja lista la invitación a la evaluación del trabajador (crea la fila o renueva su vigencia).
 * Devuelve `hecha` si ya la presentó: en ese caso no se vuelve a pedir.
 */
export async function asegurarInvitacionEvaluacion(
  db: SupabaseClient,
  args: { empleadoId: string; token: string },
): Promise<{ ok: true; hecha: boolean } | { ok: false; error: string }> {
  const { data: ex, error } = await db
    .from('ci_examenes')
    .select('id, usado_at, completado')
    .eq('empleado_id', args.empleadoId)
    .order('expira_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };

  const fila = ex as { id: string; usado_at: string | null; completado?: boolean | null } | null;
  if (fila) {
    if (fila.usado_at || fila.completado) return { ok: true, hecha: true };
    const { error: up } = await db
      .from('ci_examenes')
      .update({ expira_at: expiraEnDias(), token: args.token } as never)
      .eq('id', fila.id);
    if (up) return { ok: false, error: up.message };
    return { ok: true, hecha: false };
  }

  const { error: ins } = await db
    .from('ci_examenes')
    .insert({ empleado_id: args.empleadoId, token: args.token, expira_at: expiraEnDias() } as never);
  if (ins) return { ok: false, error: ins.message };
  return { ok: true, hecha: false };
}

/** Enlace personal de hoja de vida: crea o reactiva el token del expediente. */
export async function asegurarTokenExpediente(
  db: SupabaseClient,
  args: { empleadoId: string; token: string },
): Promise<void> {
  const { data: prev } = await db.from('expediente_tokens').select('id').eq('token', args.token).maybeSingle();
  if (prev) {
    await db
      .from('expediente_tokens')
      .update({ is_used: false, expires_at: expiraEnDias() } as never)
      .eq('token', args.token);
    return;
  }
  await db
    .from('expediente_tokens')
    .insert({ token: args.token, hoja_vida_id: args.empleadoId, expires_at: expiraEnDias(), is_used: false } as never);
}

export function nuevoToken(): string {
  return randomUUID();
}

/** Cuenta los registrados vigentes de una solicitud y la cierra si ya cubrió sus plazas. */
export async function cerrarSolicitudSiCubierta(db: SupabaseClient, solicitudId: string): Promise<void> {
  const { data: need } = await db
    .from('recruitment_needs')
    .select('id, cantidad_requerida, protocol_active')
    .eq('id', solicitudId)
    .maybeSingle();
  if (!need) return;
  const n = need as { cantidad_requerida: number | null; protocol_active: boolean | null };
  const { count } = await db
    .from('ci_empleados')
    .select('id', { count: 'exact', head: true })
    .eq('recruitment_need_id', solicitudId)
    .eq('estado_proceso', 'cv_completado');
  const cubiertas = count ?? 0;
  const plazas = Math.max(1, Number(n.cantidad_requerida ?? 1));
  const patch: Record<string, unknown> = { vacantes_cubiertas: cubiertas, conteo_postulaciones: cubiertas };
  if (cubiertas >= plazas && n.protocol_active !== false) {
    patch.protocol_active = false;
    patch.estado_vacante = 'cerrada';
  }
  await db.from('recruitment_needs').update(patch as never).eq('id', solicitudId);
}

/**
 * Columnas que escribe el formulario público de hoja de vida. Si el trabajador ya tenía
 * expediente (misma cédula), estos datos se pasan al expediente existente.
 */
export const COLUMNAS_HOJA_VIDA_FORMULARIO = [
  'recruitment_need_id',
  'proyecto_modulo_id',
  'cargo_codigo',
  'cargo_nombre',
  'cargo_nivel',
  'tipo_vacante',
  'nombre_completo',
  'nombres',
  'cargo',
  'email',
  'telefono',
  'documento',
  'cedula',
  'celular',
  'rol_examen',
  'rol_buscado',
  'primer_nombre',
  'segundo_nombre',
  'primer_apellido',
  'segundo_apellido',
  'edad',
  'estado_civil',
  'lugar_nacimiento',
  'fecha_nacimiento_date',
  'fecha_nacimiento',
  'nacionalidad',
  'domicilio_declarado',
  'direccion_habitacion',
  'ciudad_estado',
  'zurdo',
  'ivss_inscrito',
  'educacion_sabe_leer',
  'educacion_primaria',
  'educacion_secundaria',
  'educacion_tecnica',
  'educacion_superior',
  'profesion_actual',
  'antecedentes_penales',
  'examen_medico',
  'salud_tipo_sangre',
  'salud_enfermedades',
  'salud_incapacidades',
  'grupo_sanguineo',
  'peso_kg',
  'estatura_m',
  'talla_camisa',
  'talla_pantalon',
  'talla_bragas',
  'talla_botas',
  'familiares',
  'experiencia_previa',
  'foto_perfil_url',
  'cedula_foto_url',
  'hoja_vida_obrero',
  'firma_electronica_url',
  'firma_electronica_id',
  'firma_electronica_at',
] as const;

function sinAcentos(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-zñ ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Primer apellido de una fila de `ci_empleados` (columna o hoja de vida); '' si no consta. */
export function primerApellidoDeFila(row: Record<string, unknown>): string {
  const col = typeof row.primer_apellido === 'string' ? row.primer_apellido : '';
  const hv = row.hoja_vida_obrero as { datosPersonales?: { primerApellido?: unknown } } | null | undefined;
  const deHv = typeof hv?.datosPersonales?.primerApellido === 'string' ? hv.datosPersonales.primerApellido : '';
  return sinAcentos(col || deHv).split(' ')[0] ?? '';
}

/**
 * ¿Es la misma persona? Con la misma cédula, coincide si el primer apellido es igual o si alguno
 * de los dos no lo tiene cargado (expedientes creados por RRHH solo con nombre y cédula). Si no hay
 * apellido en ninguna columna, se compara contra el nombre completo.
 */
export function mismaPersonaPorApellido(nuevo: Record<string, unknown>, previo: Record<string, unknown>): boolean {
  const a = primerApellidoDeFila(nuevo);
  const b = primerApellidoDeFila(previo);
  if (a && b) return a === b;
  const otroNombre = sinAcentos(String((a ? previo : nuevo).nombre_completo ?? ''));
  const apellido = a || b;
  if (!apellido || !otroNombre) return true;
  return otroNombre.split(' ').includes(apellido);
}

/**
 * Un expediente por cédula: si la persona que acaba de registrarse ya tenía expediente,
 * los datos nuevos pasan al expediente anterior (conserva su historial) y el duplicado se borra.
 * Devuelve el id del expediente que queda.
 */
export async function unificarExpedientePorCedula(
  db: SupabaseClient,
  nuevoId: string,
): Promise<{ empleadoId: string; unificado: boolean }> {
  const { data: nuevo } = await db.from('ci_empleados').select('*').eq('id', nuevoId).maybeSingle();
  if (!nuevo) return { empleadoId: nuevoId, unificado: false };
  const n = nuevo as Record<string, unknown>;
  const dig = digitosCedula(n.cedula ?? n.documento);
  if (dig.length < 6) return { empleadoId: nuevoId, unificado: false };

  const { data: todos, error } = await db
    .from('ci_empleados')
    .select('id, cedula, documento, created_at')
    .neq('id', nuevoId)
    .order('created_at', { ascending: true })
    .limit(5000);
  if (error || !todos) return { empleadoId: nuevoId, unificado: false };

  const previo = (todos as Array<{ id: string; cedula: string | null; documento: string | null }>).find(
    (r) => digitosCedula(r.cedula ?? r.documento) === dig,
  );
  if (!previo) return { empleadoId: nuevoId, unificado: false };

  // Misma cédula pero otro apellido: puede ser un dígito mal escrito. No se toca el
  // expediente existente; quedan los dos y RRHH lo revisa.
  const { data: previoFila } = await db
    .from('ci_empleados')
    .select('primer_apellido, nombre_completo, hoja_vida_obrero')
    .eq('id', previo.id)
    .maybeSingle();
  if (!mismaPersonaPorApellido(n, (previoFila ?? {}) as Record<string, unknown>)) {
    console.warn('[unificar expediente] cédula repetida con otro apellido; no se unifica', previo.id, nuevoId);
    return { empleadoId: nuevoId, unificado: false };
  }

  const patch: Record<string, unknown> = { estado_proceso: 'cv_completado' };
  for (const col of COLUMNAS_HOJA_VIDA_FORMULARIO) {
    if (!(col in n)) continue;
    const v = n[col];
    if (v === null || v === undefined) continue;
    if (typeof v === 'string' && !v.trim()) continue;
    patch[col] = v;
  }
  const { error: up } = await db.from('ci_empleados').update(patch as never).eq('id', previo.id);
  if (up) {
    console.warn('[unificar expediente]', up.message);
    return { empleadoId: nuevoId, unificado: false };
  }
  const { error: del } = await db.from('ci_empleados').delete().eq('id', nuevoId);
  if (del) console.warn('[unificar expediente] no se borró el duplicado:', del.message);
  return { empleadoId: previo.id, unificado: true };
}
