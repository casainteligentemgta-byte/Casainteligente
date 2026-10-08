import type { SupabaseClient } from '@supabase/supabase-js';
import { idsObrasHijasDesdeModuloIntegral } from '@/lib/proyectos/obraHijasDesdeModulo';
import { normCedulaToken } from '@/lib/talento/cedulaAuth';
import { esContratoExpressAdministracionDelegada } from '@/lib/talento/filtrarContratosExpressObrero';
import { montoArregloValido } from '@/lib/nomina/arregloPago';

/** Contratos del flujo anterior que cuentan como vigentes para la nómina. */
const ESTADOS_CONTRATO_VIGENTE = ['firmado_activo', 'firmado_y_archivado'];

export type FilaNominaContratado = {
  id: string;
  nombres: string;
  apellidos: string;
  cedula: string;
  bonoUsd: number;
  fechaIngreso: string | null;
  cargoCodigo: string | null;
  cargoNombre: string | null;
  /** `false` si el contrato firmado aún no se cargó (alerta; no impide pagar). */
  contratoCargado?: boolean;
  /** Arreglo de pago pactado en el contrato (USD). `null`: monto por defecto del oficio. */
  arregloSemanalUsd?: number | null;
  arregloMensualUsd?: number | null;
  /** Id del contrato de trabajo que lo trae a la nómina. */
  contratoExpressId?: string | null;
};

function sTrim(v: unknown): string {
  if (v == null) return '';
  return String(v).trim();
}

function cedulaNorm(raw: string): string {
  if (!raw.trim()) return '';
  try {
    return normCedulaToken(raw);
  } catch {
    return raw.replace(/\s/g, '').toLowerCase();
  }
}

function apellidosDesdeEmpleado(row: {
  primer_apellido?: string | null;
  segundo_apellido?: string | null;
  nombre_completo?: string | null;
  nombres?: string | null;
}): string {
  const ap1 = sTrim(row.primer_apellido);
  const ap2 = sTrim(row.segundo_apellido);
  const joined = [ap1, ap2].filter(Boolean).join(' ');
  if (joined) return joined;
  const full = sTrim(row.nombre_completo);
  const comma = full.indexOf(',');
  if (comma > 0) return full.slice(0, comma).trim();
  const parts = full.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return parts[parts.length - 1] ?? '';
  return '';
}

function nombresDesdeEmpleado(row: {
  nombres?: string | null;
  nombre_completo?: string | null;
  primer_apellido?: string | null;
  segundo_apellido?: string | null;
}): string {
  const n = sTrim(row.nombres);
  if (n) return n;
  const full = sTrim(row.nombre_completo);
  const comma = full.indexOf(',');
  if (comma > 0) return full.slice(comma + 1).trim();
  const parts = full.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return parts.slice(0, -1).join(' ');
  return full;
}

function esColumnaInexistente(message: string | undefined, columna: string): boolean {
  const m = (message ?? '').toLowerCase();
  const col = columna.toLowerCase();
  if (!m.includes(col)) return false;
  return (
    m.includes('does not exist') ||
    m.includes('could not find') ||
    m.includes('schema cache')
  );
}

/**
 * IDs de proyecto para el cuadro de nómina.
 * Por defecto solo el proyecto elegido (sin obras hijas): si Asfaltado quedó
 * vinculado como hija de Flamboyant, no debe aparecer en la nómina del rancho.
 * Con `incluirObrasHijas: true` se mantiene el alcance módulo + hijas Talento.
 */
async function projectIdsAlcance(
  supabase: SupabaseClient,
  proyectoModuloId?: string,
  opts?: { incluirObrasHijas?: boolean },
): Promise<string[] | null> {
  const pid = proyectoModuloId?.trim();
  if (!pid) return null;
  if (!opts?.incluirObrasHijas) return [pid];
  const hijas = await idsObrasHijasDesdeModuloIntegral(supabase, pid);
  return Array.from(new Set([pid, ...hijas]));
}

type ContratoActivoRow = {
  empleado_id?: unknown;
  fecha_ingreso?: unknown;
  obra_id?: unknown;
  proyecto_id?: unknown;
  estado_contrato?: unknown;
};

/**
 * Lista contratos firmados activos.
 * Compat: algunos entornos solo tienen `proyecto_id` (sin `obra_id`).
 * No pedir `created_at`: en prod esa columna no existe en ci_contratos_empleado_obra.
 */
async function listarContratosFirmadosActivos(
  supabase: SupabaseClient,
  projectIds: string[] | null,
): Promise<ContratoActivoRow[]> {
  const selectConObra = 'empleado_id,fecha_ingreso,obra_id,proyecto_id,estado_contrato';
  const selectSoloProyecto = 'empleado_id,fecha_ingreso,proyecto_id,estado_contrato';

  let q = supabase
    .from('ci_contratos_empleado_obra')
    .select(selectConObra)
    .in('estado_contrato', ESTADOS_CONTRATO_VIGENTE);

  if (projectIds?.length) {
    // obra_id o proyecto_id pueden apuntar al mismo módulo / obra hija.
    const orParts = [
      ...projectIds.map((id) => `obra_id.eq.${id}`),
      ...projectIds.map((id) => `proyecto_id.eq.${id}`),
    ];
    q = q.or(orParts.join(','));
  }

  const first = await q;
  if (!first.error) return (first.data ?? []) as ContratoActivoRow[];

  if (
    !esColumnaInexistente(first.error.message, 'obra_id') &&
    !esColumnaInexistente(first.error.message, 'proyecto_id')
  ) {
    throw new Error(first.error.message);
  }

  // Reintento sin obra_id (esquema legacy / prod desalineado).
  let q2 = supabase
    .from('ci_contratos_empleado_obra')
    .select(selectSoloProyecto)
    .in('estado_contrato', ESTADOS_CONTRATO_VIGENTE);
  if (projectIds?.length) {
    q2 = q2.in('proyecto_id', projectIds);
  }
  const second = await q2;
  if (second.error) {
    // Último intento: solo obra_id (por si falta proyecto_id).
    if (!esColumnaInexistente(second.error.message, 'proyecto_id')) {
      throw new Error(second.error.message);
    }
    let q3 = supabase
      .from('ci_contratos_empleado_obra')
      .select('empleado_id,fecha_ingreso,obra_id,estado_contrato')
      .in('estado_contrato', ESTADOS_CONTRATO_VIGENTE);
    if (projectIds?.length) q3 = q3.in('obra_id', projectIds);
    const third = await q3;
    if (third.error) throw new Error(third.error.message);
    return (third.data ?? []) as ContratoActivoRow[];
  }
  return (second.data ?? []) as ContratoActivoRow[];
}

type ContratoTrabajoRow = {
  id?: unknown;
  obrero_nombre?: unknown;
  obrero_cedula?: unknown;
  bono_manual_usd?: unknown;
  created_at?: unknown;
  formalizado_empleado_id?: unknown;
  proyecto_id?: unknown;
  tipo_contrato?: unknown;
  fecha_ingreso?: unknown;
  pdf_firmado_storage_path?: unknown;
  cargo_nombre_snapshot?: unknown;
  arreglo_semanal_usd?: unknown;
  arreglo_mensual_usd?: unknown;
};

/**
 * Contratos de trabajo de obrero de la obra (los de administración delegada no son de personal).
 * Compat: si faltan columnas recientes, se reintenta con la lista corta.
 */
async function listarContratosTrabajoObra(
  supabase: SupabaseClient,
  projectIds: string[] | null,
): Promise<ContratoTrabajoRow[]> {
  const selects = [
    'id,obrero_nombre,obrero_cedula,bono_manual_usd,created_at,formalizado_empleado_id,proyecto_id,tipo_contrato,fecha_ingreso,pdf_firmado_storage_path,cargo_nombre_snapshot,arreglo_semanal_usd,arreglo_mensual_usd',
    'id,obrero_nombre,obrero_cedula,bono_manual_usd,created_at,formalizado_empleado_id,proyecto_id,tipo_contrato,pdf_firmado_storage_path,cargo_nombre_snapshot',
    'id,obrero_nombre,obrero_cedula,bono_manual_usd,created_at,formalizado_empleado_id,proyecto_id',
  ];
  for (const sel of selects) {
    let q = supabase.from('ci_contratos_express').select(sel).order('created_at', { ascending: false });
    if (projectIds?.length) q = q.in('proyecto_id', projectIds);
    const res: { data: unknown[] | null; error: { message: string } | null } = await q;
    if (res.error) continue;
    return ((res.data ?? []) as ContratoTrabajoRow[]).filter(
      (r) => !esContratoExpressAdministracionDelegada(r as Parameters<typeof esContratoExpressAdministracionDelegada>[0]),
    );
  }
  return [];
}

export async function fetchCuadroContratados(
  supabase: SupabaseClient,
  opts?: { proyectoModuloId?: string; incluirObrasHijas?: boolean },
): Promise<FilaNominaContratado[]> {
  const projectIds = await projectIdsAlcance(supabase, opts?.proyectoModuloId, {
    incluirObrasHijas: opts?.incluirObrasHijas === true,
  });

  const contratos = await listarContratosFirmadosActivos(supabase, projectIds);
  const expressRows = await listarContratosTrabajoObra(supabase, projectIds);

  /** Empleados con contrato del flujo anterior (firmado y archivado). */
  const empleadoIdsContratoObra = Array.from(
    new Set(
      (contratos ?? [])
        .map((r) => sTrim((r as { empleado_id?: unknown }).empleado_id))
        .filter(Boolean),
    ),
  );
  /** Contrato de trabajo vigente por empleado (el más reciente manda). */
  const expressPorEmpleado = new Map<string, ContratoTrabajoRow>();
  for (const r of expressRows) {
    const eid = sTrim(r.formalizado_empleado_id);
    if (eid && !expressPorEmpleado.has(eid)) expressPorEmpleado.set(eid, r);
  }
  const empleadoIds = Array.from(new Set([...empleadoIdsContratoObra, ...Array.from(expressPorEmpleado.keys())]));

  const fechaIngresoPorEmpleado = new Map<string, string>();
  for (const raw of contratos ?? []) {
    const eid = sTrim((raw as { empleado_id?: unknown }).empleado_id);
    if (!eid) continue;
    const fi = sTrim((raw as { fecha_ingreso?: unknown }).fecha_ingreso);
    if (fi && !fechaIngresoPorEmpleado.has(eid)) {
      fechaIngresoPorEmpleado.set(eid, fi.slice(0, 10));
    }
  }

  const empleadosMap = new Map<
    string,
    {
      nombres: string;
      apellidos: string;
      cedula: string;
      cedulaNorm: string;
      cargoCodigo: string | null;
      cargoNombre: string | null;
    }
  >();

  if (empleadoIds.length > 0) {
    const selCargo =
      'id,nombres,primer_apellido,segundo_apellido,nombre_completo,cedula,documento,cargo_codigo,cargo_nombre';
    const selBare = 'id,nombres,primer_apellido,segundo_apellido,nombre_completo,cedula,documento';
    // Las dos consultas devuelven columnas distintas: se tipa solo lo que se usa.
    let empsRes: { data: unknown[] | null; error: { message: string } | null } = await supabase
      .from('ci_empleados')
      .select(selCargo)
      .in('id', empleadoIds);
    if (
      empsRes.error &&
      (esColumnaInexistente(empsRes.error.message, 'cargo_codigo') ||
        esColumnaInexistente(empsRes.error.message, 'cargo_nombre'))
    ) {
      empsRes = await supabase.from('ci_empleados').select(selBare).in('id', empleadoIds);
    }
    if (empsRes.error) throw new Error(empsRes.error.message);

    for (const raw of empsRes.data ?? []) {
      const id = sTrim((raw as { id?: unknown }).id);
      if (!id) continue;
      const cedula = sTrim((raw as { cedula?: unknown }).cedula ?? (raw as { documento?: unknown }).documento);
      empleadosMap.set(id, {
        nombres: nombresDesdeEmpleado(raw as Parameters<typeof nombresDesdeEmpleado>[0]),
        apellidos: apellidosDesdeEmpleado(raw as Parameters<typeof apellidosDesdeEmpleado>[0]),
        cedula: cedula || '—',
        cedulaNorm: cedulaNorm(cedula),
        cargoCodigo: sTrim((raw as { cargo_codigo?: unknown }).cargo_codigo) || null,
        cargoNombre: sTrim((raw as { cargo_nombre?: unknown }).cargo_nombre) || null,
      });
    }
  }

  const bonoPorEmpleado = new Map<string, number>();
  if (empleadoIds.length > 0) {
    let asgQuery = supabase
      .from('project_assignments')
      .select('worker_id,bono_usd,created_at')
      .in('worker_id', empleadoIds)
      .order('created_at', { ascending: false });
    if (projectIds?.length) asgQuery = asgQuery.in('project_id', projectIds);
    const { data: asgRows } = await asgQuery;
    for (const raw of asgRows ?? []) {
      const wid = sTrim((raw as { worker_id?: unknown }).worker_id);
      if (!wid || bonoPorEmpleado.has(wid)) continue;
      const b = Number((raw as { bono_usd?: unknown }).bono_usd);
      bonoPorEmpleado.set(wid, Number.isFinite(b) ? Math.max(0, Math.round(b * 100) / 100) : 0);
    }

    let oeQuery = supabase
      .from('ci_obra_empleados')
      .select('empleado_id,honorarios_acordados_usd')
      .in('empleado_id', empleadoIds);
    if (projectIds?.length) oeQuery = oeQuery.in('obra_id', projectIds);
    const { data: oeRows } = await oeQuery;
    for (const raw of oeRows ?? []) {
      const eid = sTrim((raw as { empleado_id?: unknown }).empleado_id);
      if (!eid) continue;
      const prev = bonoPorEmpleado.get(eid) ?? 0;
      if (prev > 0) continue;
      const h = Number((raw as { honorarios_acordados_usd?: unknown }).honorarios_acordados_usd);
      if (Number.isFinite(h) && h > 0) {
        bonoPorEmpleado.set(eid, Math.round(h * 100) / 100);
      }
    }
  }

  const filas: FilaNominaContratado[] = [];
  const vistos = new Set<string>();

  for (const eid of empleadoIds) {
    const emp = empleadosMap.get(eid);
    if (!emp) continue;
    vistos.add(eid);
    const ex = expressPorEmpleado.get(eid) ?? null;
    const tieneContratoObra = empleadoIdsContratoObra.includes(eid);
    const ingresoEx = ex ? sTrim(ex.fecha_ingreso).slice(0, 10) || sTrim(ex.created_at).slice(0, 10) : '';
    filas.push({
      id: eid,
      nombres: emp.nombres || '—',
      apellidos: emp.apellidos || '—',
      cedula: emp.cedula,
      bonoUsd: bonoPorEmpleado.get(eid) ?? 0,
      fechaIngreso: fechaIngresoPorEmpleado.get(eid) ?? (ingresoEx || null),
      cargoCodigo: emp.cargoCodigo,
      cargoNombre: emp.cargoNombre ?? (ex ? sTrim(ex.cargo_nombre_snapshot) || null : null),
      // El contrato del flujo anterior solo llega aquí ya firmado y archivado.
      contratoCargado: tieneContratoObra || Boolean(ex && sTrim(ex.pdf_firmado_storage_path)),
      arregloSemanalUsd: ex ? montoArregloValido(ex.arreglo_semanal_usd) : null,
      arregloMensualUsd: ex ? montoArregloValido(ex.arreglo_mensual_usd) : null,
      contratoExpressId: ex ? sTrim(ex.id) || null : null,
    });
  }

  for (const raw of expressRows) {
    // Con expediente del trabajador ya entró arriba, por su id de empleado.
    if (sTrim(raw.formalizado_empleado_id)) continue;
    const exId = sTrim((raw as { id?: unknown }).id);
    const cedula = sTrim((raw as { obrero_cedula?: unknown }).obrero_cedula);
    const ck = cedulaNorm(cedula);
    const dupEmp = Array.from(empleadosMap.entries()).find(([, e]) => e.cedulaNorm && e.cedulaNorm === ck);
    if (dupEmp && vistos.has(dupEmp[0])) continue;

    const nom = sTrim((raw as { obrero_nombre?: unknown }).obrero_nombre);
    const parts = nom.split(/\s+/).filter(Boolean);
    const nombres = parts.length >= 2 ? parts.slice(0, -1).join(' ') : parts[0] || '—';
    const apellidos = parts.length >= 2 ? (parts[parts.length - 1] ?? '—') : '—';
    const bono = Number((raw as { bono_manual_usd?: unknown }).bono_manual_usd);
    const created = sTrim((raw as { created_at?: unknown }).created_at);

    filas.push({
      id: exId ? `express-${exId}` : `express-${ck || nom}`,
      nombres,
      apellidos,
      cedula: cedula || '—',
      bonoUsd: Number.isFinite(bono) ? Math.max(0, Math.round(bono * 100) / 100) : 0,
      fechaIngreso: sTrim(raw.fecha_ingreso).slice(0, 10) || (created ? created.slice(0, 10) : null),
      cargoCodigo: null,
      cargoNombre: sTrim(raw.cargo_nombre_snapshot) || null,
      contratoCargado: Boolean(sTrim(raw.pdf_firmado_storage_path)),
      arregloSemanalUsd: montoArregloValido(raw.arreglo_semanal_usd),
      arregloMensualUsd: montoArregloValido(raw.arreglo_mensual_usd),
      contratoExpressId: exId || null,
    });
  }

  filas.sort((a, b) => {
    const ap = `${a.apellidos} ${a.nombres}`.localeCompare(`${b.apellidos} ${b.nombres}`, 'es', {
      sensitivity: 'base',
    });
    return ap;
  });

  return filas;
}
