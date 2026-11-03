import type { SupabaseClient } from '@supabase/supabase-js';
import type { FilaRolUsuario } from '@/lib/auth/ciUsuariosRolesDb';
import { entidadActivaDesdeRoles, esAdminGlobalRoles, esUuid } from '@/lib/clientes/entidadActiva';
import { nombreEntidad, SELECT_NOMBRE_ENTIDAD, type EntidadConNombre } from '@/lib/entidades/nombreEntidad';

export const MIGRACION_CLIENTE_ENTIDADES = '394_ci_cliente_entidades.sql';

export type ClienteEntidadVinculo = {
  entidadId: string;
  nombre: string;
  rif: string | null;
  createdAt: string | null;
};

export type ContextoEntidadUsuario = {
  esAdmin: boolean;
  entidadIds: string[];
  entidadActivaId: string | null;
};

/** null = admin global (no filtrar). Array = solo esas empresas. */
export type FiltroEntidadFicha = {
  entidadIds: string[] | null;
};

export function hintMigracionClienteEntidades(message: string | null | undefined): boolean {
  return /ci_cliente_entidades|does not exist|schema cache/i.test(String(message ?? ''));
}

export function mensajeMigracionClienteEntidades(): string {
  return `Aplique la migración ${MIGRACION_CLIENTE_ENTIDADES}`;
}

export function entidadesIdsDesdeRoles(roles: readonly FilaRolUsuario[]): string[] {
  const out: string[] = [];
  const visto = new Set<string>();
  for (const r of roles) {
    const id = String(r.entidad_id ?? '').trim();
    if (!esUuid(id) || visto.has(id)) continue;
    visto.add(id);
    out.push(id);
  }
  return out;
}

export function contextoEntidadDesdeRoles(
  roles: readonly FilaRolUsuario[],
  rolesSlugs?: readonly string[],
): ContextoEntidadUsuario {
  const slugs = rolesSlugs ?? roles.map((r) => String(r.rol ?? ''));
  return {
    esAdmin: esAdminGlobalRoles(slugs),
    entidadIds: entidadesIdsDesdeRoles(roles),
    entidadActivaId: entidadActivaDesdeRoles(roles),
  };
}

export function filtroFichaDesdeContexto(ctx: ContextoEntidadUsuario): FiltroEntidadFicha {
  return { entidadIds: ctx.esAdmin ? null : ctx.entidadIds };
}

export async function cargarContextoEntidadUsuario(
  supabase: SupabaseClient,
  userId?: string | null,
): Promise<ContextoEntidadUsuario> {
  let uid = String(userId ?? '').trim();
  if (!uid) {
    const { data } = await supabase.auth.getUser();
    uid = data.user?.id ?? '';
  }
  if (!uid) {
    return { esAdmin: false, entidadIds: [], entidadActivaId: null };
  }
  const { data, error } = await supabase
    .from('ci_usuarios_roles')
    .select('rol,entidad_id')
    .eq('user_id', uid);
  if (error) {
    return { esAdmin: false, entidadIds: [], entidadActivaId: null };
  }
  return contextoEntidadDesdeRoles((data ?? []) as FilaRolUsuario[]);
}

export function normalizarVinculosClienteEntidad(filas: unknown): ClienteEntidadVinculo[] {
  if (!Array.isArray(filas)) return [];
  const out: ClienteEntidadVinculo[] = [];
  const visto = new Set<string>();
  for (const f of filas) {
    const r = (f ?? {}) as Record<string, unknown>;
    const entidadId = String(r.entidad_id ?? r.entidadId ?? '').trim();
    if (!esUuid(entidadId) || visto.has(entidadId)) continue;
    const rel = r.ci_entidades as EntidadConNombre | EntidadConNombre[] | null | undefined;
    const ent = Array.isArray(rel) ? rel[0] : rel;
    const rifRaw = ent && typeof ent.rif === 'string' ? ent.rif.trim() : '';
    visto.add(entidadId);
    out.push({
      entidadId,
      nombre: nombreEntidad(ent, 'Empresa'),
      rif: rifRaw || null,
      createdAt: typeof r.created_at === 'string' && r.created_at ? r.created_at : null,
    });
  }
  return out.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

export async function cargarEntidadesCliente(
  supabase: SupabaseClient,
  customerId: string,
): Promise<{ vinculos: ClienteEntidadVinculo[]; error: string | null; migracionPendiente: boolean }> {
  const id = customerId.trim();
  if (!id) return { vinculos: [], error: null, migracionPendiente: false };
  const { data, error } = await supabase
    .from('ci_cliente_entidades')
    .select(`customer_id,entidad_id,created_at,ci_entidades(${SELECT_NOMBRE_ENTIDAD},rif)`)
    .eq('customer_id', id);
  if (error) {
    return {
      vinculos: [],
      error: hintMigracionClienteEntidades(error.message)
        ? mensajeMigracionClienteEntidades()
        : error.message,
      migracionPendiente: hintMigracionClienteEntidades(error.message),
    };
  }
  return {
    vinculos: normalizarVinculosClienteEntidad(data),
    error: null,
    migracionPendiente: false,
  };
}

export async function vincularClienteEntidad(
  supabase: SupabaseClient,
  customerId: string,
  entidadId: string,
): Promise<{ error: string | null; migracionPendiente: boolean; yaEstaba: boolean }> {
  const cid = customerId.trim();
  const eid = entidadId.trim();
  if (!esUuid(cid) || !esUuid(eid)) {
    return { error: 'Identificador no válido.', migracionPendiente: false, yaEstaba: false };
  }
  const { error } = await supabase.from('ci_cliente_entidades').insert({
    customer_id: cid,
    entidad_id: eid,
  });
  if (!error) return { error: null, migracionPendiente: false, yaEstaba: false };
  if (/duplicate|unique|23505/i.test(error.message)) {
    return { error: null, migracionPendiente: false, yaEstaba: true };
  }
  return {
    error: hintMigracionClienteEntidades(error.message)
      ? mensajeMigracionClienteEntidades()
      : error.message,
    migracionPendiente: hintMigracionClienteEntidades(error.message),
    yaEstaba: false,
  };
}

export async function desvincularClienteEntidad(
  supabase: SupabaseClient,
  customerId: string,
  entidadId: string,
): Promise<{ error: string | null; migracionPendiente: boolean }> {
  const cid = customerId.trim();
  const eid = entidadId.trim();
  if (!esUuid(cid) || !esUuid(eid)) {
    return { error: 'Identificador no válido.', migracionPendiente: false };
  }
  const { error } = await supabase
    .from('ci_cliente_entidades')
    .delete()
    .eq('customer_id', cid)
    .eq('entidad_id', eid);
  if (!error) return { error: null, migracionPendiente: false };
  return {
    error: hintMigracionClienteEntidades(error.message)
      ? mensajeMigracionClienteEntidades()
      : error.message,
    migracionPendiente: hintMigracionClienteEntidades(error.message),
  };
}

export async function listarClientesSinEntidad(
  supabase: SupabaseClient,
): Promise<{
  ids: string[];
  filas: Array<{ id: string; nombre: string }>;
  error: string | null;
  migracionPendiente: boolean;
}> {
  const { data: ligados, error: errLigados } = await supabase
    .from('ci_cliente_entidades')
    .select('customer_id');
  if (errLigados) {
    return {
      ids: [],
      filas: [],
      error: hintMigracionClienteEntidades(errLigados.message)
        ? mensajeMigracionClienteEntidades()
        : errLigados.message,
      migracionPendiente: hintMigracionClienteEntidades(errLigados.message),
    };
  }
  const conEmpresa = new Set(
    (ligados ?? []).map((r) => String((r as { customer_id?: unknown }).customer_id ?? '')).filter(Boolean),
  );

  const { data: clientes, error } = await supabase
    .from('customers')
    .select('id,nombre,razon_social,apellido')
    .order('nombre', { ascending: true });
  if (error) return { ids: [], filas: [], error: error.message, migracionPendiente: false };

  const filas: Array<{ id: string; nombre: string }> = [];
  for (const c of clientes ?? []) {
    const row = c as {
      id?: unknown;
      nombre?: unknown;
      razon_social?: unknown;
    };
    const id = String(row.id ?? '').trim();
    if (!id || conEmpresa.has(id)) continue;
    const nombre =
      String(row.razon_social ?? '').trim() || String(row.nombre ?? '').trim() || 'Cliente';
    filas.push({ id, nombre });
  }
  return { ids: filas.map((f) => f.id), filas, error: null, migracionPendiente: false };
}

export async function asignarEntidadAClientes(
  supabase: SupabaseClient,
  customerIds: string[],
  entidadId: string,
): Promise<{ vinculados: number; error: string | null; migracionPendiente: boolean }> {
  const eid = entidadId.trim();
  const ids = customerIds.map((x) => x.trim()).filter((id) => esUuid(id));
  if (!esUuid(eid)) {
    return { vinculados: 0, error: 'Elija una empresa.', migracionPendiente: false };
  }
  if (!ids.length) {
    return { vinculados: 0, error: 'No hay clientes para asignar.', migracionPendiente: false };
  }
  const { error } = await supabase.from('ci_cliente_entidades').upsert(
    ids.map((customer_id) => ({ customer_id, entidad_id: eid })),
    { onConflict: 'customer_id,entidad_id', ignoreDuplicates: true },
  );
  if (error) {
    return {
      vinculados: 0,
      error: hintMigracionClienteEntidades(error.message)
        ? mensajeMigracionClienteEntidades()
        : error.message,
      migracionPendiente: hintMigracionClienteEntidades(error.message),
    };
  }
  return { vinculados: ids.length, error: null, migracionPendiente: false };
}

export function mensajeClienteYaExiste(nombre: string, motivo: 'rif' | 'cedula' | 'telefono'): string {
  const n = nombre.trim() || 'Este cliente';
  const por =
    motivo === 'rif' ? 'el mismo RIF' : motivo === 'cedula' ? 'la misma cédula' : 'el mismo teléfono';
  return `${n} ya está en el sistema (${por}). Lo vincularemos a su empresa para no duplicarlo.`;
}

export function mensajeConfirmarDesvincular(
  nombre: string | null | undefined,
  entidadNombre: string | null | undefined,
): string {
  const n = String(nombre ?? '').trim() || 'este cliente';
  const e = String(entidadNombre ?? '').trim() || 'su empresa';
  return `¿Quitar a ${n} de ${e}?\n\nEl cliente seguirá existiendo para las otras empresas.`;
}

export function etiquetaMotivoDuplicado(motivo: 'rif' | 'cedula' | 'telefono'): string {
  if (motivo === 'rif') return 'mismo RIF';
  if (motivo === 'cedula') return 'misma cédula';
  return 'mismo teléfono';
}
