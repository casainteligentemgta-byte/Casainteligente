import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Subtipos lógicos en `ci_proyectos` (`tipo_proyecto`: integral | talento).
 * En la UI se presentan como un solo concepto «proyecto» con subtipo.
 */
export type FuenteProyectoCi = 'integral' | 'talento';

export type OpcionProyectoReclutamiento = {
  key: string;
  etiqueta: string;
  fuente: FuenteProyectoCi;
  proyectoModuloId: string | null;
  proyectoObraId: string | null;
};

export function etiquetaFuenteProyecto(fuente: FuenteProyectoCi): string {
  return fuente === 'integral' ? 'Integral' : 'Talento';
}

/** Texto para pie de listado / ayudas (sin nombres de tablas SQL). */
export const TEXTO_LISTADO_PROYECTOS_UNIFICADO =
  'Un solo listado: proyectos del módulo integral y obras Talento. En la base siguen en tablas distintas; aquí se muestran juntos.';

export type LoadOpcionesProyectoReclutamientoOpts = {
  /** Si true, solo filas Talento con `obra_estado_legacy = 'activa'` (p. ej. vacantes CEO). */
  soloObrasActivas?: boolean;
};

export type ProyectoModuloIntegral = {
  id: string;
  nombre: string;
  entidad_id?: string | null;
};

/** Entidad de trabajo (`ci_entidades`) compartida por la mayoría de proyectos del listado. */
export function entidadIdPredominante(
  proyectos: { entidad_id?: string | null }[],
): string | null {
  const counts = new Map<string, number>();
  for (const p of proyectos) {
    const id = (p.entidad_id ?? '').trim();
    if (!id) continue;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  if (!counts.size) return null;
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]![0];
}

function normNombreProyecto(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/** Prioriza obras habituales en SMART RRHH (p. ej. Video de frente, Rancho Flamboyant). */
function prioridadSmartRrhh(nombre: string): number {
  const s = normNombreProyecto(nombre);
  if (s.includes('frente') || s.includes('flamboyant') || s.includes('video')) return 0;
  return 1;
}

function filaEsModuloIntegral(tipo: string | null | undefined): boolean {
  return (tipo ?? 'integral').trim().toLowerCase() !== 'talento';
}

function mapFilasModuloIntegral(
  rows: {
    id: unknown;
    nombre?: unknown;
    tipo_proyecto?: string | null;
    entidad_id?: string | null;
  }[],
): ProyectoModuloIntegral[] {
  return rows
    .filter((r) => filaEsModuloIntegral(r.tipo_proyecto))
    .map((r) => ({
      id: String(r.id),
      nombre: String(r.nombre ?? 'Sin nombre').trim() || 'Sin nombre',
      entidad_id: r.entidad_id != null ? String(r.entidad_id) : null,
    }));
}

/**
 * Módulos integrales vinculados a una entidad de trabajo (`ci_proyectos.entidad_id`).
 * Usado en SMART RRHH «Todos»: suma solicitados de todos los proyectos del mismo patrono.
 */
export async function loadProyectosModuloIntegralPorEntidad(
  supabase: SupabaseClient,
  entidadId: string,
): Promise<{ proyectos: ProyectoModuloIntegral[]; errors: string[] }> {
  const eid = entidadId.trim();
  if (!eid) return { proyectos: [], errors: [] };

  const errors: string[] = [];
  const res = await supabase
    .from('ci_proyectos')
    .select('id,nombre,tipo_proyecto,entidad_id')
    .eq('entidad_id', eid)
    .or('tipo_proyecto.eq.integral,tipo_proyecto.is.null')
    .order('nombre', { ascending: true })
    .limit(250);

  if (res.error && esColumnaTipoProyectoAusente(res.error.message ?? '')) {
    const leg = await supabase
      .from('ci_proyectos')
      .select('id,nombre,entidad_id')
      .eq('entidad_id', eid)
      .order('nombre', { ascending: true })
      .limit(250);
    if (leg.error) {
      errors.push(leg.error.message ?? 'No se pudieron cargar proyectos de la entidad.');
      return { proyectos: [], errors };
    }
    const proyectos = (leg.data ?? []).map((r) => ({
      id: String((r as { id: unknown }).id),
      nombre: String((r as { nombre?: unknown }).nombre ?? 'Sin nombre').trim() || 'Sin nombre',
      entidad_id: eid,
    }));
    return { proyectos, errors };
  }

  if (res.error) {
    const m = (res.error.message ?? '').toLowerCase();
    if (m.includes('entidad_id') || m.includes('does not exist') || m.includes('schema cache')) {
      errors.push(
        'Falta ci_proyectos.entidad_id. Asigne entidad de trabajo en cada proyecto o aplique migración 071.',
      );
      return { proyectos: [], errors };
    }
    errors.push(res.error.message ?? 'No se pudieron cargar proyectos de la entidad.');
    return { proyectos: [], errors };
  }

  const proyectos = mapFilasModuloIntegral(
    (res.data ?? []) as {
      id: unknown;
      nombre?: unknown;
      tipo_proyecto?: string | null;
      entidad_id?: string | null;
    }[],
  );
  return { proyectos, errors };
}

/**
 * Proyectos del módulo integral para cuadros SMART RRHH (`/rrhh/hojas-vida`).
 * Incluye filas con `tipo_proyecto` null (legacy) y excluye solo `talento`.
 */
export async function loadProyectosModuloIntegral(
  supabase: SupabaseClient,
): Promise<{ proyectos: ProyectoModuloIntegral[]; errors: string[] }> {
  const errors: string[] = [];

  let res = await supabase
    .from('ci_proyectos')
    .select('id,nombre,tipo_proyecto,entidad_id')
    .or('tipo_proyecto.eq.integral,tipo_proyecto.is.null')
    .order('nombre', { ascending: true })
    .limit(250);

  if (res.error && esColumnaTipoProyectoAusente(res.error.message ?? '')) {
    const leg = await supabase
      .from('ci_proyectos')
      .select('id,nombre')
      .order('nombre', { ascending: true })
      .limit(250);
    if (leg.error) {
      errors.push(leg.error.message ?? 'No se pudieron cargar proyectos.');
      return { proyectos: [], errors };
    }
    errors.push(
      'Falta la columna ci_proyectos.tipo_proyecto (migración 086). Se listan todos los proyectos como módulo integral.',
    );
    const proyectos = (leg.data ?? []).map((r) => ({
      id: String((r as { id: unknown }).id),
      nombre: String((r as { nombre?: unknown }).nombre ?? 'Sin nombre').trim() || 'Sin nombre',
    }));
    proyectos.sort(
      (a, b) =>
        prioridadSmartRrhh(a.nombre) - prioridadSmartRrhh(b.nombre) ||
        a.nombre.localeCompare(b.nombre, 'es'),
    );
    return { proyectos, errors };
  }

  if (res.error) {
    errors.push(res.error.message ?? 'No se pudieron cargar proyectos (integral).');
    return { proyectos: [], errors };
  }

  let proyectos = mapFilasModuloIntegral(
    (res.data ?? []) as { id: unknown; nombre?: unknown; tipo_proyecto?: string | null }[],
  );

  if (proyectos.length === 0) {
    const any = await supabase
      .from('ci_proyectos')
      .select('id,nombre,tipo_proyecto')
      .order('nombre', { ascending: true })
      .limit(250);
    if (any.error) {
      errors.push(any.error.message ?? 'No se pudieron cargar proyectos.');
    } else {
      proyectos = mapFilasModuloIntegral(
        (any.data ?? []) as { id: unknown; nombre?: unknown; tipo_proyecto?: string | null }[],
      );
    }
  }

  proyectos.sort(
    (a, b) =>
      prioridadSmartRrhh(a.nombre) - prioridadSmartRrhh(b.nombre) ||
      a.nombre.localeCompare(b.nombre, 'es'),
  );

  return { proyectos, errors };
}

/** Proyectos visibles en `/rrhh/hojas-vida` (p. ej. Video de frente, Rancho Flamboyant). */
export function esProyectoSmartRrhhPorNombre(nombre: string): boolean {
  return prioridadSmartRrhh(nombre) === 0;
}

/**
 * Cuadros SMART RRHH: prioriza obras por nombre (frente / flamboyant), integral o Talento.
 */
export async function loadProyectosSmartRrhhHojasVida(
  supabase: SupabaseClient,
): Promise<{ proyectos: ProyectoModuloIntegral[]; errors: string[] }> {
  const errors: string[] = [];
  const { data, error } = await supabase
    .from('ci_proyectos')
    .select('id,nombre,tipo_proyecto,entidad_id')
    .order('nombre', { ascending: true })
    .limit(250);

  if (error) {
    if (esColumnaTipoProyectoAusente(error.message ?? '')) {
      return loadProyectosModuloIntegral(supabase);
    }
    errors.push(error.message ?? 'No se pudieron cargar proyectos.');
    return { proyectos: [], errors };
  }

  const porNombre = mapFilasModuloIntegral(
    ((data ?? []) as { id: unknown; nombre?: unknown; tipo_proyecto?: string | null; entidad_id?: string | null }[]).filter(
      (r) => esProyectoSmartRrhhPorNombre(String(r.nombre ?? '')),
    ),
  );

  if (porNombre.length > 0) {
    porNombre.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    return { proyectos: porNombre, errors };
  }

  return loadProyectosModuloIntegral(supabase);
}

/**
 * Opciones para selects de reclutamiento (vacantes): lee `ci_proyectos` por `tipo_proyecto`.
 */
function esColumnaTipoProyectoAusente(msg: string): boolean {
  const m = (msg ?? '').toLowerCase();
  return m.includes('does not exist') && m.includes('tipo_proyecto');
}

function esColumnaObraEstadoLegacyAusente(msg: string): boolean {
  const m = (msg ?? '').toLowerCase();
  return m.includes('does not exist') && m.includes('obra_estado_legacy');
}

function esColumnaInexistente(msg: string): boolean {
  const m = (msg ?? '').toLowerCase();
  return m.includes('does not exist') || m.includes('42703') || m.includes('schema cache');
}

export async function loadOpcionesProyectoReclutamiento(
  supabase: SupabaseClient,
  opts?: LoadOpcionesProyectoReclutamientoOpts,
): Promise<{ opciones: OpcionProyectoReclutamiento[]; errors: string[] }> {
  const errors: string[] = [];
  let intQuery = supabase
    .from('ci_proyectos')
    .select('id,nombre')
    .eq('tipo_proyecto', 'integral')
    .order('created_at', { ascending: false })
    .limit(250);
  let talQuery = supabase
    .from('ci_proyectos')
    .select('id,nombre,obra_estado_legacy')
    .eq('tipo_proyecto', 'talento')
    .order('created_at', { ascending: false })
    .limit(250);
  if (opts?.soloObrasActivas) {
    talQuery = talQuery.eq('obra_estado_legacy', 'activa');
  }
  const [modRes, obrRes] = await Promise.all([intQuery, talQuery]);

  const opciones: OpcionProyectoReclutamiento[] = [];

  const fallbackSin086 =
    (modRes.error && esColumnaTipoProyectoAusente(modRes.error.message ?? '')) ||
    (obrRes.error && esColumnaTipoProyectoAusente(obrRes.error.message ?? ''));

  if (fallbackSin086) {
    const { data, error } = await supabase
      .from('ci_proyectos')
      .select('id,nombre')
      .order('created_at', { ascending: false })
      .limit(250);
    if (error) {
      errors.push(error.message ?? 'No se pudieron cargar proyectos.');
    } else {
      errors.push(
        'Falta la columna ci_proyectos.tipo_proyecto (migración 086). Se listan todos los proyectos como integral; no hay distinción Talento hasta aplicar la migración.',
      );
      for (const r of data ?? []) {
        const id = String((r as { id: unknown }).id);
        const nombre = String((r as { nombre?: unknown }).nombre ?? 'Sin nombre');
        opciones.push({
          key: `i:${id}`,
          etiqueta: `${nombre} · ${etiquetaFuenteProyecto('integral')}`,
          fuente: 'integral',
          proyectoModuloId: id,
          proyectoObraId: null,
        });
      }
    }
    return { opciones, errors };
  }

  if (modRes.error) {
    errors.push(modRes.error.message ?? 'No se pudieron cargar proyectos (integral).');
  } else {
    for (const r of modRes.data ?? []) {
      const id = String((r as { id: unknown }).id);
      const nombre = String((r as { nombre?: unknown }).nombre ?? 'Sin nombre');
      opciones.push({
        key: `i:${id}`,
        etiqueta: `${nombre} · ${etiquetaFuenteProyecto('integral')}`,
        fuente: 'integral',
        proyectoModuloId: id,
        proyectoObraId: null,
      });
    }
  }

  if (obrRes.error) {
    const msg = obrRes.error.message ?? '';
    if (esColumnaObraEstadoLegacyAusente(msg) || (esColumnaInexistente(msg) && msg.includes('obra_estado'))) {
      let retry = supabase
        .from('ci_proyectos')
        .select('id,nombre')
        .eq('tipo_proyecto', 'talento')
        .order('created_at', { ascending: false })
        .limit(250);
      const retryRes = await retry;
      if (retryRes.error) {
        errors.push('No se pudieron cargar obras Talento (columna obra_estado_legacy ausente).');
      } else {
        for (const r of retryRes.data ?? []) {
          const id = String((r as { id: unknown }).id);
          const nombre = String((r as { nombre?: unknown }).nombre ?? 'Sin nombre');
          opciones.push({
            key: `t:${id}`,
            etiqueta: `${nombre} · ${etiquetaFuenteProyecto('talento')}`,
            fuente: 'talento',
            proyectoModuloId: null,
            proyectoObraId: id,
          });
        }
      }
    } else {
      errors.push(obrRes.error.message ?? 'No se pudieron cargar proyectos (Talento).');
    }
  } else {
    for (const r of obrRes.data ?? []) {
      const id = String((r as { id: unknown }).id);
      const nombre = String((r as { nombre?: unknown }).nombre ?? 'Sin nombre');
      opciones.push({
        key: `t:${id}`,
        etiqueta: `${nombre} · ${etiquetaFuenteProyecto('talento')}`,
        fuente: 'talento',
        proyectoModuloId: null,
        proyectoObraId: id,
      });
    }
  }

  if (opciones.length === 0 && errors.length === 0) {
    const { data, error } = await supabase
      .from('ci_proyectos')
      .select('id,nombre')
      .order('created_at', { ascending: false })
      .limit(250);
    if (error) {
      errors.push(error.message ?? 'No se pudieron cargar proyectos.');
    } else {
      for (const r of data ?? []) {
        const id = String((r as { id: unknown }).id);
        const nombre = String((r as { nombre?: unknown }).nombre ?? 'Sin nombre');
        opciones.push({
          key: `i:${id}`,
          etiqueta: nombre,
          fuente: 'integral',
          proyectoModuloId: id,
          proyectoObraId: null,
        });
      }
    }
  }

  return { opciones, errors };
}

/** Catálogo id + nombre para selects (compras, almacén, etc.). */
export type ProyectoCatalogo = { id: string; nombre: string; entidad_id?: string | null };

/** Video de frente y Rancho Flamboyant primero; el resto por nombre. Proyectos nuevos en BD al recargar. */
export function ordenarProyectosCatalogoApp(proyectos: ProyectoCatalogo[]): ProyectoCatalogo[] {
  return [...proyectos].sort(
    (a, b) =>
      prioridadSmartRrhh(a.nombre) - prioridadSmartRrhh(b.nombre) ||
      a.nombre.localeCompare(b.nombre, 'es'),
  );
}

export async function loadCatalogoProyectosApp(
  supabase: SupabaseClient,
): Promise<{ proyectos: ProyectoCatalogo[]; error: string | null }> {
  const { data, error } = await supabase
    .from('ci_proyectos')
    .select('id,nombre,entidad_id')
    .limit(1000);

  if (error) {
    return { proyectos: [], error: error.message ?? 'No se pudieron cargar proyectos.' };
  }

  const proyectos = ordenarProyectosCatalogoApp(
    (data ?? []).map((r) => ({
      id: String((r as { id: unknown }).id),
      nombre: String((r as { nombre?: unknown }).nombre ?? 'Sin nombre').trim() || 'Sin nombre',
      entidad_id:
        (r as { entidad_id?: unknown }).entidad_id != null
          ? String((r as { entidad_id: unknown }).entidad_id)
          : null,
    })),
  );

  return { proyectos, error: null };
}

export function mergeProyectosCatalogo(
  actual: ProyectoCatalogo[],
  extra: ProyectoCatalogo[],
): ProyectoCatalogo[] {
  const map = new Map<string, ProyectoCatalogo>();
  for (const p of [...actual, ...extra]) {
    if (p.id) map.set(p.id, p);
  }
  return ordenarProyectosCatalogoApp(Array.from(map.values()));
}
