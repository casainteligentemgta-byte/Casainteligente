'use client';

import Link from 'next/link';
import { ClipboardList, FileText, Trash2, UserCheck, UserMinus, Users, UserX } from 'lucide-react';
import AccionesContratoPdfFila from '@/components/rrhh/AccionesContratoPdfFila';
import ContratosExpressModuloPanel from '@/components/proyectos/ContratosExpressModuloPanel';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { hrefGestionPersonalSolicitados } from '@/lib/rrhh/hrefSolicitudPersonal';
import { idsObrasHijasDesdeModuloIntegral } from '@/lib/proyectos/obraHijasDesdeModulo';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export type ResumenObrerosProyectoModuloProps = {
  proyectoModuloId: string;
  /** Mismo tick que vacantes (p. ej. `rrhhVacantesTick`) para refrescar tras altas. */
  listaRefresco?: number;
  /** Valor de `?tab=` en la URL; al cambiar se vuelve a cargar el cuadro (p. ej. vista RRHH directa). */
  tabUrl?: string;
  /**
   * Solo pruebas: con `?demo_listas=1` en la URL del módulo, cada modal (En carpeta, Inactivos, Por contratar)
   * muestra un obrero ficticio y los contadores de esas tarjetas son al menos 1.
   */
  demoListasObrero?: boolean;
  /** Título del bloque (p. ej. «SMART RRHH» en `/rrhh/hojas-vida`). */
  tituloSeccion?: string;
  /** Párrafo bajo el título; `null` lo oculta. */
  subtituloSeccion?: string | null;
  /** Oculta el enlace «Hojas de vida RRHH» (p. ej. en la propia pantalla de hojas de vida). */
  ocultarEnlaceHojasVida?: boolean;
  /** Varios módulos: agrega datos (p. ej. «Todos» en SMART RRHH). Si no se pasa, solo `proyectoModuloId`. */
  proyectosModuloIds?: string[];
  /** Filtro en enlaces del cuadro; `null` = sin filtro por proyecto (alcance «Todos»). */
  proyectoModuloIdFiltroEnlaces?: string | null;
  /** Selector de obra junto al título (controlado desde la página). */
  selectorObra?: {
    valor: string;
    onChange: (value: string) => void;
    opciones: { id: string; nombre: string }[];
    mostrarTodos: boolean;
  };
};

/** Fila ficticia para pruebas UI (no persiste en BD). UUID solo para keys/links estables en demo. */
const OBRERO_DEMO_LISTA: EmpleadoLite = {
  id: '00000000-0000-4000-8000-000000000001',
  nombre_completo: 'Obrero demo (prueba)',
  nombres: 'Obrero',
  primer_apellido: 'Demo',
  segundo_apellido: 'Prueba',
  cedula: 'V-12345678',
  documento: 'V-12345678',
  celular: '04141234567',
  telefono: '04141234567',
  cargo_nombre: 'Oficial',
  cargo_codigo: 'OFICIAL',
  estado: 'aprobado',
  estado_proceso: 'cv_completado',
  recruitment_need_id: null,
  status_evaluacion: 'verde',
  rol_examen: 'obrero',
};

/** Demo «Por contratar»: vigilante aprobado sin contrato (rol técnico + oficio vigilancia). */
const LUS_VICENTE_MATA_DEMO: EmpleadoLite = {
  id: '00000000-0000-4000-8000-000000000002',
  nombre_completo: 'Luis Vicente Mata',
  nombres: 'Luis Vicente',
  primer_apellido: 'Mata',
  segundo_apellido: null,
  cedula: 'V-00000000',
  documento: 'V-00000000',
  celular: '04140000000',
  telefono: '04140000000',
  cargo_nombre: 'Vigilante',
  cargo_codigo: 'VIGILANTE',
  estado: 'aprobado',
  estado_proceso: 'cv_completado',
  recruitment_need_id: null,
  status_evaluacion: 'verde',
  rol_examen: 'tecnico',
};

const IDS_DEMO_FILA = new Set([OBRERO_DEMO_LISTA.id, LUS_VICENTE_MATA_DEMO.id]);

type NeedLite = {
  id: string;
  cantidad_requerida: number | null;
  protocol_active: boolean | null;
  cargo_nombre: string | null;
  title: string | null;
};

type EmpleadoLite = {
  id: string;
  nombre_completo: string | null;
  nombres: string | null;
  primer_apellido: string | null;
  segundo_apellido: string | null;
  cedula: string | null;
  documento: string | null;
  celular: string | null;
  telefono: string | null;
  cargo_nombre: string | null;
  cargo_codigo: string | null;
  estado: string | null;
  estado_proceso: string | null;
  recruitment_need_id: string | null;
  /** Legacy RRHH: verde = apto, rojo/rechazado = no apto, amarillo = en curso. */
  status_evaluacion: string | null;
  /** `obrero` | `programador` | `tecnico` — «por contratar» incluye obra y vigilancia (técnico + oficio). */
  rol_examen: string | null;
};

type FilaContratoObra = {
  obra_id: string | null;
  estado_contrato: string;
};

type ListaModalTipo = 'enCarpeta' | 'activos' | 'inactivos' | 'porContratar';

type LaborRequestLite = {
  id: string;
  specialty_codigo: string;
  specialty_nombre: string | null;
  quantity_requested: number;
  status: string;
};

/** Evita `.trim()` sobre no-string (p. ej. número desde PostgREST), que rompe React con pantalla en blanco. */
function sTrim(v: unknown): string {
  if (v == null) return '';
  return String(v).trim();
}

function nombreApellidoDesdeEmpleado(row: EmpleadoLite): { nombre: string; apellido: string } {
  const nombre = sTrim(row.nombres);
  const ap1 = sTrim(row.primer_apellido);
  const ap2 = sTrim(row.segundo_apellido);
  const apellido = [ap1, ap2].filter(Boolean).join(' ');
  if (nombre || apellido) {
    return { nombre: nombre || '—', apellido: apellido || '—' };
  }
  const full = sTrim(row.nombre_completo);
  const comma = full.indexOf(',');
  if (comma > 0) {
    return {
      apellido: full.slice(0, comma).trim() || '—',
      nombre: full.slice(comma + 1).trim() || '—',
    };
  }
  const parts = full.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return { nombre: parts.slice(0, -1).join(' '), apellido: parts[parts.length - 1] ?? '—' };
  }
  return { nombre: full || '—', apellido: '—' };
}

function cedulaDesdeEmpleado(row: EmpleadoLite): string {
  const v = sTrim(row.cedula ?? row.documento);
  return v || '—';
}

function telefonoDesdeEmpleado(row: EmpleadoLite): string {
  const v = sTrim(row.celular ?? row.telefono);
  return v || '—';
}

function oficioDesdeEmpleado(row: EmpleadoLite): string {
  const v = sTrim(row.cargo_nombre ?? row.cargo_codigo);
  return v || '—';
}

function mergePorId<T extends { id: string }>(a: T[], b: T[]): T[] {
  const m = new Map<string, T>();
  for (const x of a) m.set(x.id, x);
  for (const x of b) {
    if (!m.has(x.id)) m.set(x.id, x);
  }
  return Array.from(m.values());
}

/** Fila derivada de `ci_contratos_express` (sin `ci_empleados` hasta formalizar). */
const CI_EXPRESS_EMPLEADO_ID_PREFIX = 'ci-express-';

function esEmpleadoContratoExpress(row: { id: string }): boolean {
  return row.id.startsWith(CI_EXPRESS_EMPLEADO_ID_PREFIX);
}

function empleadoLiteDesdeContratoExpress(raw: Record<string, unknown>): EmpleadoLite | null {
  const exId = typeof raw.id === 'string' ? raw.id : '';
  if (!exId) return null;
  if (raw.formalizado_empleado_id) return null;
  const nom = sTrim(raw.obrero_nombre);
  const ced = sTrim(raw.obrero_cedula);
  const parts = nom.split(/\s+/).filter(Boolean);
  const nombres = parts.length >= 2 ? parts.slice(0, -1).join(' ') : parts[0] || '—';
  const primer_apellido = parts.length >= 2 ? (parts[parts.length - 1] ?? '—') : '—';
  const cargo = sTrim(raw.cargo_nombre_snapshot) || 'Contrato express (fast-track)';
  return {
    id: `${CI_EXPRESS_EMPLEADO_ID_PREFIX}${exId}`,
    nombre_completo: nom || 'Obrero (contrato express)',
    nombres,
    primer_apellido,
    segundo_apellido: null,
    cedula: ced || null,
    documento: ced || null,
    celular: null,
    telefono: null,
    cargo_nombre: cargo,
    cargo_codigo: 'EXPRESS',
    estado: 'aprobado',
    estado_proceso: 'cv_completado',
    recruitment_need_id: null,
    status_evaluacion: 'pendiente_regularizar',
    rol_examen: 'obrero',
  };
}

function plazasPorNecesidad(n: Pick<NeedLite, 'cantidad_requerida'>): number {
  const r = n.cantidad_requerida;
  if (typeof r === 'number' && Number.isFinite(r) && r >= 1) return Math.min(500, Math.floor(r));
  return 1;
}

function necesidadActiva(n: NeedLite): boolean {
  return n.protocol_active !== false;
}

function bucketContrato(estados: string[]): 'contratado_activo' | 'en_tramite' | 'sin_contrato' {
  const norm = estados.map((e) => (e ?? '').trim().toLowerCase()).filter(Boolean);
  if (norm.some((e) => e === 'firmado_activo')) return 'contratado_activo';
  if (norm.length > 0) return 'en_tramite';
  return 'sin_contrato';
}

function statusEvaluacionCodigo(row: EmpleadoLite): string {
  return sTrim(row.status_evaluacion).toLowerCase();
}

function evaluacionAprobada(row: EmpleadoLite): boolean {
  return statusEvaluacionCodigo(row) === 'verde';
}

/** Sin evaluación completada o express pendiente de examen. */
function evaluacionNoAprobada(row: EmpleadoLite): boolean {
  const s = statusEvaluacionCodigo(row);
  if (s === 'pendiente_regularizar') return true;
  return s === 'rojo' || s === 'rechazado';
}

/** Apto para contratar obra: semáforo verde o, si no hay rojo explícito, empleado marcado aprobado en RRHH. */
function evaluacionAptaPorContratar(row: EmpleadoLite): boolean {
  if (evaluacionAprobada(row)) return true;
  if (evaluacionNoAprobada(row)) return false;
  return sTrim(row.estado).toLowerCase() === 'aprobado';
}

/**
 * Personal de campo que puede figurar en «por contratar»: obreros de obra y vigilancia (suelen ir como `tecnico` en talento).
 * Excluye programadores.
 */
function esPersonalCampoPorContratar(row: EmpleadoLite): boolean {
  const r = sTrim(row.rol_examen).toLowerCase();
  if (r === 'programador') return false;
  if (r === 'obrero') return true;
  if (r === 'tecnico') {
    const cargo = `${sTrim(row.cargo_nombre)} ${sTrim(row.cargo_codigo)}`.toLowerCase();
    return /vigil|seguridad|custod|guardia|porter/.test(cargo);
  }
  return false;
}

function entraEnListaPorContratar(row: EmpleadoLite, contrMap: Map<string, string[]>): boolean {
  const b = bucketContrato(contrMap.get(row.id) ?? []);
  return esPersonalCampoPorContratar(row) && evaluacionAptaPorContratar(row) && b !== 'contratado_activo';
}

function entraEnListaContratadosActivos(row: EmpleadoLite, contrMap: Map<string, string[]>): boolean {
  return bucketContrato(contrMap.get(row.id) ?? []) === 'contratado_activo';
}

/** Contratado en firma activa sobre obra aún abierta (no cuenta como «inactivo por obra cerrada»). */
function tieneContratoActivoEnObraAbierta(
  eid: string,
  filasPorEmpleado: Map<string, FilaContratoObra[]>,
  obraEstadoPorId: Map<string, string>,
): boolean {
  const filas = filasPorEmpleado.get(eid) ?? [];
  for (const f of filas) {
    const oid = f.obra_id ? String(f.obra_id) : '';
    if (!oid) continue;
    const estObra = sTrim(obraEstadoPorId.get(oid)).toLowerCase();
    const ec = sTrim(f.estado_contrato).toLowerCase();
    if (ec === 'firmado_activo' && estObra === 'activa') return true;
  }
  return false;
}

/** Contratado en algún momento y la obra del contrato figura como cerrada; sin contrato activo en obra abierta. */
function esInactivoPorObraCulminada(
  eid: string,
  filasPorEmpleado: Map<string, FilaContratoObra[]>,
  obraEstadoPorId: Map<string, string>,
): boolean {
  const filas = filasPorEmpleado.get(eid) ?? [];
  if (filas.length === 0) return false;
  let hayContratoEnObraCerrada = false;
  for (const f of filas) {
    const oid = f.obra_id ? String(f.obra_id) : '';
    if (!oid) continue;
    const estObra = sTrim(obraEstadoPorId.get(oid)).toLowerCase();
    if (estObra === 'cerrada') {
      hayContratoEnObraCerrada = true;
      break;
    }
  }
  if (!hayContratoEnObraCerrada) return false;
  return !tieneContratoActivoEnObraAbierta(eid, filasPorEmpleado, obraEstadoPorId);
}

const SUBTITULO_CUADRO_DEFAULT =
  'Plazas solicitadas, obreros no aprobados en evaluación, contratos activos en obra vinculada y contratos express (fast-track) del mismo proyecto u obras hijas.';

export default function ResumenObrerosProyectoModulo({
  proyectoModuloId,
  listaRefresco = 0,
  tabUrl = '',
  demoListasObrero = false,
  tituloSeccion = 'Cuadro de obreros — RRHH del proyecto',
  subtituloSeccion = SUBTITULO_CUADRO_DEFAULT,
  ocultarEnlaceHojasVida = false,
  proyectosModuloIds,
  proyectoModuloIdFiltroEnlaces,
  selectorObra,
}: ResumenObrerosProyectoModuloProps) {
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** Obreros con asignación a solicitud de personal (`project_assignments`) en este módulo/proyectos hijos. */
  const [solicitadosPlazas, setSolicitadosPlazas] = useState(0);
  /** Plazas declaradas en vacantes activas (referencia). */
  const [plazasVacantesResumen, setPlazasVacantesResumen] = useState(0);
  const [vacantesActivas, setVacantesActivas] = useState(0);
  const [enCarpeta, setEnCarpeta] = useState(0);
  const [contratadosActivos, setContratadosActivos] = useState(0);
  const [empleados, setEmpleados] = useState<EmpleadoLite[]>([]);
  const [contratoPorEmpleado, setContratoPorEmpleado] = useState<Map<string, string[]>>(new Map());
  const [filasContratoPorEmpleado, setFilasContratoPorEmpleado] = useState<Map<string, FilaContratoObra[]>>(() => new Map());
  const [obraEstadoPorId, setObraEstadoPorId] = useState<Map<string, string>>(() => new Map());
  const [listaModal, setListaModal] = useState<ListaModalTipo | null>(null);
  const [expressPanelAbierto, setExpressPanelAbierto] = useState(false);
  const [contratosExpressCount, setContratosExpressCount] = useState(0);
  const [proyectoIdsExpressAlcance, setProyectoIdsExpressAlcance] = useState<string[]>([]);
  const [viewportTick, setViewportTick] = useState(0);
  /** Solicitudes `labor_requests` pendientes (director) en módulo u obras hijas. */
  const [cuadroPlazasLaborPendientes, setCuadroPlazasLaborPendientes] = useState(0);
  const [cuadroAsignadosLabor, setCuadroAsignadosLabor] = useState(0);
  /** Proyectos (módulo + obras hijas) para borrar `project_assignments` al quitar asignación. */
  const [projectIdsForLabor, setProjectIdsForLabor] = useState<string[]>([]);
  /** Obreros con fila en `project_assignments` para este alcance (muestra botón quitar asignación). */
  const [solicitadosWorkerIdSet, setSolicitadosWorkerIdSet] = useState<Set<string>>(() => new Set());
  /** Modo demo: fila ficticia oculta por lista tras pulsar Eliminar. */
  const [demoEliminadoPorLista, setDemoEliminadoPorLista] = useState<Partial<Record<ListaModalTipo, boolean>>>({});
  const [eliminandoWorkerId, setEliminandoWorkerId] = useState<string | null>(null);

  useEffect(() => {
    setDemoEliminadoPorLista({});
  }, [proyectoModuloId, demoListasObrero]);

  useEffect(() => {
    const bump = () => setViewportTick((t) => t + 1);
    const onVis = () => {
      if (document.visibilityState === 'visible') bump();
    };
    const onCustom = () => bump();
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', bump);
    window.addEventListener('ci-resumen-obreros-refresh', onCustom);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', bump);
      window.removeEventListener('ci-resumen-obreros-refresh', onCustom);
    };
  }, []);

  const moduloIdsAlcance = useMemo(() => {
    const extra = (proyectosModuloIds ?? []).map((s) => s.trim()).filter(Boolean);
    if (extra.length > 0) return Array.from(new Set(extra));
    const one = proyectoModuloId.trim();
    return one ? [one] : [];
  }, [proyectoModuloId, proyectosModuloIds]);

  const idFiltroEnlaces = proyectoModuloIdFiltroEnlaces?.trim() || null;

  useEffect(() => {
    if (!moduloIdsAlcance.length) {
      setLoading(false);
      setError('Proyecto no válido.');
      setProjectIdsForLabor([]);
      setSolicitadosWorkerIdSet(new Set());
      setProyectoIdsExpressAlcance([]);
      return;
    }

    let alive = true;
    let requestId = 0;
    (async () => {
      const myRequest = ++requestId;
      setLoading(true);
      setError(null);

      try {
        const obraHijaIdsSet = new Set<string>();
        for (const mid of moduloIdsAlcance) {
          const hijas = await idsObrasHijasDesdeModuloIntegral(supabase, mid);
          for (const h of hijas) obraHijaIdsSet.add(h);
        }
        const obraHijaIds = Array.from(obraHijaIdsSet);
        if (!alive) return;

        const filtroOr = moduloIdsAlcance.flatMap((mid) => [
          `proyecto_modulo_id.eq.${mid}`,
          `proyecto_id.eq.${mid}`,
        ]);
        const filtroModulo = filtroOr.join(',');
        const selNeeds = 'id,cantidad_requerida,protocol_active,cargo_nombre,title,created_at';
        const r1 = await supabase.from('recruitment_needs').select(selNeeds).or(filtroModulo).order('created_at', { ascending: false });

        let needs: NeedLite[] = ((r1.data ?? []) as NeedLite[]).map((n) => ({
          ...n,
          cantidad_requerida: n.cantidad_requerida,
        }));

        if (obraHijaIds.length > 0) {
          const r2 = await supabase
            .from('recruitment_needs')
            .select(selNeeds)
            .in('proyecto_id', obraHijaIds)
            .order('created_at', { ascending: false });
          if (!alive) return;
          if (!r2.error && r2.data?.length) {
            needs = mergePorId(
              needs,
              r2.data as NeedLite[],
            );
          }
        }

        const needsActivas = needs.filter(necesidadActiva);
        const plazas = needsActivas.reduce((acc, n) => acc + plazasPorNecesidad(n), 0);
        const needIds = needsActivas.map((n) => n.id);

        const selEmp =
          'id,nombre_completo,nombres,primer_apellido,segundo_apellido,cedula,documento,celular,telefono,cargo_nombre,cargo_codigo,estado,estado_proceso,recruitment_need_id,status_evaluacion,rol_examen,created_at';
        const e1 = await supabase.from('ci_empleados').select(selEmp).in('proyecto_modulo_id', moduloIdsAlcance).order('nombre_completo');
        if (!alive) return;

        let emps: EmpleadoLite[] = (e1.data ?? []) as EmpleadoLite[];
        if (needIds.length > 0) {
          const e2 = await supabase.from('ci_empleados').select(selEmp).in('recruitment_need_id', needIds).order('nombre_completo');
          if (!alive) return;
          if (!e2.error && e2.data?.length) {
            emps = mergePorId(emps, e2.data as EmpleadoLite[]);
          }
        }

        if (obraHijaIds.length > 0) {
          const asg = await supabase.from('ci_obra_empleados').select('empleado_id').in('obra_id', obraHijaIds);
          if (!alive) return;
          if (!asg.error && asg.data?.length) {
            const asignados = Array.from(
              new Set(
                (asg.data ?? [])
                  .map((r) =>
                    typeof (r as { empleado_id?: unknown }).empleado_id === 'string'
                      ? (r as { empleado_id: string }).empleado_id
                      : '',
                  )
                  .filter(Boolean),
              ),
            );
            if (asignados.length > 0) {
              const e3 = await supabase.from('ci_empleados').select(selEmp).in('id', asignados).order('nombre_completo');
              if (!alive) return;
              if (!e3.error && e3.data?.length) {
                emps = mergePorId(emps, e3.data as EmpleadoLite[]);
              }
            }
          }
        }

        /** Obreros asignados vía `project_assignments` (solicitud de personal); suelen no tener `proyecto_modulo_id`. */
        const projectIdsAsignacion = Array.from(new Set([...moduloIdsAlcance, ...obraHijaIds]));
        setProjectIdsForLabor(projectIdsAsignacion);
        setProyectoIdsExpressAlcance(projectIdsAsignacion);

        let laborPendientesRows: LaborRequestLite[] = [];
        const { data: lrData, error: lrErr } = await supabase
          .from('labor_requests')
          .select('id,specialty_codigo,specialty_nombre,quantity_requested,status')
          .in('project_id', projectIdsAsignacion)
          .eq('status', 'pending');
        if (!alive) return;
        if (!lrErr && lrData?.length) {
          laborPendientesRows = (lrData as LaborRequestLite[])
            .map((raw) => {
              const lid = typeof raw.id === 'string' ? raw.id : '';
              const qty =
                typeof raw.quantity_requested === 'number' && Number.isFinite(raw.quantity_requested)
                  ? Math.max(1, Math.min(500, Math.floor(raw.quantity_requested)))
                  : 1;
              return {
                id: lid,
                specialty_codigo: sTrim(raw.specialty_codigo),
                specialty_nombre: raw.specialty_nombre ?? null,
                quantity_requested: qty,
                status: sTrim(raw.status) || 'pending',
              };
            })
            .filter((r) => r.id && sTrim(r.status).toLowerCase() === 'pending');
        }

        const solicitadosIds = new Set<string>();
        const { data: pasg, error: pasgErr } = await supabase
          .from('project_assignments')
          .select('worker_id')
          .in('project_id', projectIdsAsignacion);
        if (!alive) return;
        if (!pasgErr && pasg?.length) {
          for (const r of pasg ?? []) {
            const wid = typeof (r as { worker_id?: unknown }).worker_id === 'string' ? (r as { worker_id: string }).worker_id : '';
            if (wid) solicitadosIds.add(wid);
          }
          const conocidos = new Set(emps.map((e) => e.id));
          const workerIds = Array.from(solicitadosIds).filter((wid) => !conocidos.has(wid));
          if (workerIds.length > 0) {
            const e4 = await supabase.from('ci_empleados').select(selEmp).in('id', workerIds).order('nombre_completo');
            if (!alive) return;
            if (!e4.error && e4.data?.length) {
              emps = mergePorId(emps, e4.data as EmpleadoLite[]);
            }
          }
        }
        setSolicitadosWorkerIdSet(new Set(solicitadosIds));

        let expressTotalFilas = 0;
        const proyectoIdsExpress = projectIdsAsignacion;
        if (proyectoIdsExpress.length > 0) {
          const rExFull = await supabase
            .from('ci_contratos_express')
            .select('id,obrero_nombre,obrero_cedula,proyecto_id,formalizado_empleado_id,cargo_nombre_snapshot')
            .in('proyecto_id', proyectoIdsExpress);
          const exMsgFull = (rExFull.error?.message ?? '').toLowerCase();
          const rExMid =
            rExFull.error &&
            /formalizado_empleado_id|cargo_nombre_snapshot|42703|column|does not exist|schema cache/i.test(exMsgFull)
              ? await supabase
                  .from('ci_contratos_express')
                  .select('id,obrero_nombre,obrero_cedula,proyecto_id,formalizado_empleado_id')
                  .in('proyecto_id', proyectoIdsExpress)
              : null;
          const exMsgMid = (rExMid?.error?.message ?? '').toLowerCase();
          const rExBare =
            rExMid?.error && /formalizado_empleado_id|42703|column|does not exist|schema cache/i.test(exMsgMid)
              ? await supabase
                  .from('ci_contratos_express')
                  .select('id,obrero_nombre,obrero_cedula,proyecto_id')
                  .in('proyecto_id', proyectoIdsExpress)
              : null;

          const exChosen =
            !rExFull.error && rExFull.data?.length !== undefined
              ? rExFull
              : rExMid && !rExMid.error && rExMid.data?.length !== undefined
                ? rExMid
                : rExBare;

          const exData = exChosen && !exChosen.error ? (exChosen.data ?? []) : [];
          expressTotalFilas = exData.length;
          if (exData.length > 0) {
            const cedNorm = (v: string) => v.replace(/\s/g, '').toLowerCase();
            const cedulasEmp = new Set(emps.map((e) => cedNorm(sTrim(e.cedula ?? e.documento))).filter(Boolean));
            const expressExtras: EmpleadoLite[] = [];
            for (const raw of exData as Record<string, unknown>[]) {
              if (raw.formalizado_empleado_id) continue;
              const rowLite = empleadoLiteDesdeContratoExpress(raw);
              if (!rowLite) continue;
              const ck = cedNorm(sTrim(rowLite.cedula ?? rowLite.documento));
              if (ck && cedulasEmp.has(ck)) continue;
              if (ck) cedulasEmp.add(ck);
              expressExtras.push(rowLite);
            }
            if (expressExtras.length) {
              emps = mergePorId(emps, expressExtras);
            }
          }
        }

        emps.sort((a, b) =>
          sTrim(a.nombre_completo).localeCompare(sTrim(b.nombre_completo), 'es', { sensitivity: 'base' }),
        );

        const empIdsParaContratosObra = emps.filter((e) => !esEmpleadoContratoExpress(e)).map((e) => e.id);
        const contrMap = new Map<string, string[]>();
        const filasContratoPorEmpleado = new Map<string, FilaContratoObra[]>();
        if (empIdsParaContratosObra.length > 0) {
          const ctr = await supabase
            .from('ci_contratos_empleado_obra')
            .select('empleado_id,estado_contrato,obra_id')
            .in('empleado_id', empIdsParaContratosObra);
          if (!alive) return;
          for (const row of ctr.data ?? []) {
            const eid = String((row as { empleado_id?: unknown }).empleado_id ?? '');
            const st = String((row as { estado_contrato?: unknown }).estado_contrato ?? '');
            const oidRaw = (row as { obra_id?: unknown }).obra_id;
            const obra_id = typeof oidRaw === 'string' && oidRaw ? oidRaw : null;
            if (!eid) continue;
            const arr = contrMap.get(eid) ?? [];
            arr.push(st);
            contrMap.set(eid, arr);
            const det = filasContratoPorEmpleado.get(eid) ?? [];
            det.push({ obra_id, estado_contrato: st });
            filasContratoPorEmpleado.set(eid, det);
          }
        }

        for (const e of emps) {
          if (!esEmpleadoContratoExpress(e)) continue;
          const arr = contrMap.get(e.id) ?? [];
          if (!arr.includes('firmado_activo')) {
            arr.push('firmado_activo');
            contrMap.set(e.id, arr);
          }
          const det = filasContratoPorEmpleado.get(e.id) ?? [];
          det.push({ obra_id: null, estado_contrato: 'firmado_activo' });
          filasContratoPorEmpleado.set(e.id, det);
        }

        const obraIdsContratos = new Set<string>();
        for (const filas of Array.from(filasContratoPorEmpleado.values())) {
          for (const f of filas) {
            if (f.obra_id) obraIdsContratos.add(f.obra_id);
          }
        }
        const obraEstadoMap = new Map<string, string>();
        if (obraIdsContratos.size > 0) {
          const { data: obrasRows, error: obrasErr } = await supabase
            .from('ci_obras')
            .select('id,estado')
            .in('id', Array.from(obraIdsContratos));
          if (!alive) return;
          if (!obrasErr && obrasRows?.length) {
            for (const orow of obrasRows as { id?: unknown; estado?: unknown }[]) {
              const oid = typeof orow.id === 'string' ? orow.id : '';
              if (!oid) continue;
              obraEstadoMap.set(oid, sTrim(orow.estado));
            }
          }
        }

        const activos = emps.filter((e) => bucketContrato(contrMap.get(e.id) ?? []) === 'contratado_activo').length;
        const enCarpetaEval = emps.filter((e) => evaluacionNoAprobada(e)).length;
        const solicitadosEnLista = emps.filter((e) => solicitadosIds.has(e.id)).length;
        const laborPlazasPendCount = laborPendientesRows.reduce((a, r) => a + r.quantity_requested, 0);
        /** Plazas en solicitud RRHH pendientes; si no hay, el número muestra obreros ya asignados en obra. */
        const solicitadosTarjetaNum = laborPlazasPendCount > 0 ? laborPlazasPendCount : solicitadosEnLista;

        emps = emps.map((row) => ({
          ...row,
          status_evaluacion: (row as { status_evaluacion?: string | null }).status_evaluacion ?? null,
          rol_examen: (row as { rol_examen?: string | null }).rol_examen ?? null,
        })) as EmpleadoLite[];

        if (!alive) return;
        setPlazasVacantesResumen(plazas);
        setSolicitadosPlazas(solicitadosTarjetaNum);
        setCuadroPlazasLaborPendientes(laborPlazasPendCount);
        setCuadroAsignadosLabor(solicitadosEnLista);
        setVacantesActivas(needsActivas.length);
        setEnCarpeta(enCarpetaEval);
        setContratosExpressCount(expressTotalFilas);
        setContratadosActivos(activos);
        setEmpleados(emps);
        setContratoPorEmpleado(contrMap);
        setFilasContratoPorEmpleado(new Map(filasContratoPorEmpleado));
        setObraEstadoPorId(new Map(obraEstadoMap));
      } catch (err: any) {
        if (!alive) return;
        console.error('Error en ResumenObrerosProyectoModulo:', err);
        setError(`No se pudo cargar el resumen de obreros: ${err.message || err}`);
        setProjectIdsForLabor([]);
        setSolicitadosWorkerIdSet(new Set());
        setSolicitadosPlazas(0);
        setCuadroPlazasLaborPendientes(0);
        setCuadroAsignadosLabor(0);
        setPlazasVacantesResumen(0);
        setVacantesActivas(0);
        setEnCarpeta(0);
        setContratosExpressCount(0);
        setContratadosActivos(0);
        setEmpleados([]);
        setContratoPorEmpleado(new Map());
        setFilasContratoPorEmpleado(new Map());
        setObraEstadoPorId(new Map());
        setProyectoIdsExpressAlcance([]);
      } finally {
        if (alive && myRequest === requestId) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [moduloIdsAlcance, supabase, listaRefresco, viewportTick, tabUrl]);

  const tituloId = `resumen-obreros-${moduloIdsAlcance.join('-').slice(0, 40) || 'proyecto'}`;
  const numResumen = (n: number) => (loading ? '…' : String(n));

  const porContratarObrerosCount = useMemo(
    () => empleados.filter((e) => entraEnListaPorContratar(e, contratoPorEmpleado)).length,
    [empleados, contratoPorEmpleado],
  );

  const quitarAsignacionLaboral = useCallback(
    async (workerId: string) => {
      const wid = workerId.trim();
      if (!wid) return;
      if (projectIdsForLabor.length === 0) {
        toast.error('No hay proyectos en alcance para esta acción.');
        return;
      }
      setEliminandoWorkerId(wid);
      try {
        const { data: removed, error } = await supabase
          .from('project_assignments')
          .delete()
          .eq('worker_id', wid)
          .in('project_id', projectIdsForLabor)
          .select('id,labor_request_id');
        if (error) throw error;
        const rows = (removed ?? []) as { labor_request_id?: string }[];
        if (rows.length === 0) {
          toast.message('Sin asignación', {
            description: 'Este obrero no tiene asignación a solicitud en este módulo u obras vinculadas.',
          });
          return;
        }
        const lrIds = Array.from(
          new Set(rows.map((r) => (typeof r.labor_request_id === 'string' ? r.labor_request_id : '')).filter(Boolean)),
        );
        for (const lid of lrIds) {
          const { data: lr } = await supabase
            .from('labor_requests')
            .select('id,quantity_requested,status')
            .eq('id', lid)
            .maybeSingle();
          const qty =
            lr && typeof lr.quantity_requested === 'number' && Number.isFinite(lr.quantity_requested)
              ? Math.max(1, Math.min(500, Math.floor(lr.quantity_requested)))
              : 1;
          const { count, error: cErr } = await supabase
            .from('project_assignments')
            .select('id', { count: 'exact', head: true })
            .eq('labor_request_id', lid);
          if (cErr) continue;
          const c = count ?? 0;
          const st = sTrim((lr as { status?: string } | null)?.status).toLowerCase();
          if (st === 'fulfilled' && c < qty) {
            await supabase
              .from('labor_requests')
              .update({ status: 'pending', updated_at: new Date().toISOString() })
              .eq('id', lid);
          }
        }
        const { count: totalAsg, error: aErr } = await supabase
          .from('project_assignments')
          .select('id', { count: 'exact', head: true })
          .eq('worker_id', wid);
        if (!aErr && (totalAsg ?? 0) === 0) {
          await supabase.from('ci_empleados').update({ estatus: 'disponible' }).eq('id', wid);
        }
        toast.success('Asignación a solicitud quitada.');
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('ci-resumen-obreros-refresh'));
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'No se pudo quitar la asignación.');
      } finally {
        setEliminandoWorkerId(null);
      }
    },
    [projectIdsForLabor, supabase],
  );

  const contratadosInactivos = useMemo(
    () =>
      empleados.filter((e) => esInactivoPorObraCulminada(e.id, filasContratoPorEmpleado, obraEstadoPorId)).length,
    [empleados, filasContratoPorEmpleado, obraEstadoPorId],
  );

  const filasListaModal = useMemo(() => {
    if (!listaModal) return [];
    if (demoListasObrero && listaModal === 'porContratar') {
      const reales = empleados.filter((e) => entraEnListaPorContratar(e, contratoPorEmpleado));
      if (demoEliminadoPorLista.porContratar) return reales;
      if (reales.length > 0) return reales;
      return [LUS_VICENTE_MATA_DEMO];
    }
    if (demoListasObrero && (listaModal === 'enCarpeta' || listaModal === 'inactivos')) {
      if (demoEliminadoPorLista[listaModal]) return [];
      return [OBRERO_DEMO_LISTA];
    }
    return empleados.filter((e) => {
      switch (listaModal) {
        case 'enCarpeta':
          return evaluacionNoAprobada(e);
        case 'activos':
          return entraEnListaContratadosActivos(e, contratoPorEmpleado);
        case 'inactivos':
          return esInactivoPorObraCulminada(e.id, filasContratoPorEmpleado, obraEstadoPorId);
        case 'porContratar':
          return entraEnListaPorContratar(e, contratoPorEmpleado);
        default:
          return false;
      }
    });
  }, [
    listaModal,
    empleados,
    contratoPorEmpleado,
    filasContratoPorEmpleado,
    obraEstadoPorId,
    demoListasObrero,
    demoEliminadoPorLista,
  ]);

  const enCarpetaMostrar =
    demoListasObrero && !demoEliminadoPorLista.enCarpeta ? Math.max(enCarpeta, 1) : enCarpeta;
  const contratadosInactivosMostrar =
    demoListasObrero && !demoEliminadoPorLista.inactivos ? Math.max(contratadosInactivos, 1) : contratadosInactivos;
  const porContratarMostrar =
    demoListasObrero && !demoEliminadoPorLista.porContratar
      ? Math.max(porContratarObrerosCount, 1)
      : porContratarObrerosCount;

  const tituloListaModal = useMemo(() => {
    switch (listaModal) {
      case 'enCarpeta':
        return 'NO APROBADO — No Aprobaron La Evaluación.';
      case 'activos':
        return 'Contratados activos — con contrato vigente';
      case 'inactivos':
        return 'Contratados inactivos (obra culminada)';
      case 'porContratar':
        return 'Por contratar — personal de obra / vigilancia, apto, sin contrato activo';
      default:
        return '';
    }
  }, [listaModal]);

  return (
    <section
      className="rounded-2xl border border-fuchsia-500/25 bg-gradient-to-b from-fuchsia-950/40 to-zinc-950/80 p-5 shadow-[0_0_32px_rgba(192,38,211,0.08)] backdrop-blur-xl"
      aria-labelledby={tituloId}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 pb-4">
        <div className="flex gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-fuchsia-500/40 bg-fuchsia-500/15">
            <Users className="h-5 w-5 text-fuchsia-200" aria-hidden />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <h2 id={tituloId} className="text-base font-bold tracking-tight text-white">
                {tituloSeccion}
              </h2>
              {selectorObra && selectorObra.opciones.length > 0 ? (
                <label className="inline-flex items-center gap-2">
                  <span className="sr-only">Obra o alcance</span>
                  <select
                    value={selectorObra.valor}
                    onChange={(e) => selectorObra.onChange(e.target.value)}
                    className="max-w-[min(100%,14rem)] rounded-lg border border-fuchsia-500/35 bg-zinc-900/80 px-2.5 py-1.5 text-xs font-semibold text-fuchsia-100 outline-none ring-offset-zinc-950 focus:border-fuchsia-400/60 focus:ring-2 focus:ring-fuchsia-500/25"
                    aria-label="Filtrar cuadro SMART RRHH por obra"
                  >
                    {selectorObra.mostrarTodos ? <option value="">Todos</option> : null}
                    {selectorObra.opciones.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.nombre}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>
            {subtituloSeccion ? (
              <p className="mt-0.5 text-[11px] text-zinc-500">{subtituloSeccion}</p>
            ) : null}
            {demoListasObrero ? (
              <p className="mt-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[10px] font-semibold text-amber-200">
                Modo prueba: listas simuladas (<code className="font-mono text-amber-100/90">?demo_listas=1</code>)
              </p>
            ) : null}
          </div>
        </div>
        {!ocultarEnlaceHojasVida ? (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            <Link
              href="/rrhh/hojas-vida/archivo"
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-fuchsia-100 hover:bg-white/10"
            >
              Hojas de vida
            </Link>
          </div>
        ) : null}
      </div>

      {error ? (
        <p className="mt-4 rounded-lg border border-red-500/30 bg-red-950/30 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      ) : null}
      {loading ? <p className="mt-2 text-xs text-zinc-500">Actualizando contadores…</p> : null}

      <div
        className={`mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 ${loading ? 'opacity-90' : ''}`}
      >
            <Link
              href={hrefGestionPersonalSolicitados({ proyectoModuloId: idFiltroEnlaces })}
              className="block w-full rounded-xl border border-violet-500/35 bg-violet-500/10 p-4 text-left transition hover:border-violet-400/50 hover:bg-violet-500/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/40"
              title="Ver solicitudes de personal por oficio y asignar obreros"
            >
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wide text-violet-300/90">
                <ClipboardList className="h-3.5 w-3.5" aria-hidden />
                Solicitados
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums text-white">{numResumen(solicitadosPlazas)}</p>
              <p className="mt-1 text-[10px] leading-snug text-zinc-500">
                {cuadroPlazasLaborPendientes > 0
                  ? 'Plazas pedidas por oficio (tabulador) pendientes de asignar en este módulo u obras hijas. Clic: ver listado.'
                  : cuadroAsignadosLabor > 0
                    ? `Obreros ya asignados a solicitudes de personal. Clic: ver listado (${cuadroAsignadosLabor} en obra).`
                    : 'Solicitudes de personal obrero (oficio y cantidad). Clic: ver listado y registrar nuevas.'}
              </p>
            </Link>
            <button
              type="button"
              onClick={() => setListaModal('enCarpeta')}
              title="No Aprobaron La Evaluación"
              className="w-full rounded-xl border border-sky-500/35 bg-sky-500/10 p-4 text-left transition hover:border-sky-400/50 hover:bg-sky-500/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/40"
            >
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wide text-sky-300/90">
                <Users className="h-3.5 w-3.5" aria-hidden />
                NO APROBADO
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums text-white">{numResumen(enCarpetaMostrar)}</p>
              <p className="mt-1 text-[10px] text-zinc-500">
                No Aprobaron La Evaluación. Clic: ver lista.
              </p>
            </button>
            <div className="w-full overflow-hidden rounded-xl border border-emerald-500/35 bg-emerald-500/10 text-left transition hover:border-emerald-400/50 hover:bg-emerald-500/15 focus-within:ring-2 focus-within:ring-emerald-400/40">
              <button
                type="button"
                onClick={() => setListaModal('activos')}
                className="block w-full p-4 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40"
                title="Ver cuadro de obreros con contrato activo"
              >
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wide text-emerald-300/90">
                  <UserCheck className="h-3.5 w-3.5" aria-hidden />
                  Contratados activos
                </div>
                <p className="mt-2 text-2xl font-bold tabular-nums text-white">{numResumen(contratadosActivos)}</p>
                <p className="mt-1 text-[10px] text-zinc-500">
                  Contrato obra «firmado activo» o express vigente. Clic: ver cuadro de obreros con contrato.
                </p>
              </button>
              <div className="border-t border-emerald-500/25 px-3 pb-3 pt-2">
                <button
                  type="button"
                  onClick={() => setExpressPanelAbierto(true)}
                  className="flex w-full items-center justify-between gap-2 rounded-lg border border-amber-500/40 bg-amber-950/45 px-3 py-2.5 text-left transition hover:border-amber-400/55 hover:bg-amber-900/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/40"
                  title="Ver cuadro de obreros — contratos express (fast-track)"
                >
                  <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wide text-amber-100/95">
                    <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    Contratados express
                  </span>
                  <span className="rounded-md bg-amber-500/20 px-2 py-0.5 text-sm font-bold tabular-nums text-amber-50">
                    {numResumen(contratosExpressCount)}
                  </span>
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setListaModal('inactivos')}
              className="w-full rounded-xl border border-rose-500/35 bg-rose-500/10 p-4 text-left transition hover:border-rose-400/50 hover:bg-rose-500/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/40"
            >
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wide text-rose-200/90">
                <UserX className="h-3.5 w-3.5" aria-hidden />
                Contratados inactivos
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums text-white">{numResumen(contratadosInactivosMostrar)}</p>
              <p className="mt-1 text-[10px] text-zinc-500">
                Contrato vinculado a obra en estado «cerrada» y sin contrato activo en obra abierta. Clic: lista.
              </p>
            </button>
            <button
              type="button"
              onClick={() => setListaModal('porContratar')}
              className="w-full rounded-xl border border-amber-500/35 bg-amber-500/10 p-4 text-left transition hover:border-amber-400/50 hover:bg-amber-500/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/40"
            >
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wide text-amber-200/90">
                <UserMinus className="h-3.5 w-3.5" aria-hidden />
                Por contratar
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums text-white">{numResumen(porContratarMostrar)}</p>
              <p className="mt-1 text-[10px] leading-snug text-zinc-500">
                <span className="font-semibold text-zinc-400">Obrero</span> o{' '}
                <span className="font-semibold text-zinc-400">vigilancia</span> (técnico + oficio), apto (verde o
                estado aprobado sin rojo) y sin contrato obra «firmado activo». Clic: lista.
              </p>
            </button>
      </div>

      <Dialog open={listaModal !== null} onOpenChange={(open) => !open && setListaModal(null)}>
            <DialogContent className="max-h-[85vh] overflow-hidden border-fuchsia-500/20 bg-zinc-950 p-0 sm:max-w-[min(96vw,900px)]">
              <DialogHeader className="border-b border-white/10 px-5 py-4 pr-12">
                <DialogTitle className="text-base">{tituloListaModal || 'Listado'}</DialogTitle>
                {(listaModal === 'porContratar' || listaModal === 'inactivos') && (
                  <p className="text-xs text-zinc-500">
                    {listaModal === 'porContratar' &&
                      'Criterio: rol «obrero», o «tecnico» con oficio de vigilancia/seguridad; apto (evaluación verde o estado aprobado sin rechazo); sin contrato obra «firmado_activo». No incluye programadores ni quienes solo tienen contrato express (cuentan como contratados activos).'}
                    {listaModal === 'inactivos' &&
                      'Criterio: al menos un contrato obra cuya obra está «cerrada» en ci_obras, y sin contrato activo en obra «activa».'}
                  </p>
                )}
              </DialogHeader>
              <div className="max-h-[60vh] overflow-auto px-2 pb-4 sm:px-4">
                {filasListaModal.length === 0 ? (
                  <p className="px-3 py-8 text-center text-sm text-zinc-500">No hay registros en esta categoría.</p>
                ) : (
                  <table className="w-full min-w-[720px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-[10px] font-bold uppercase tracking-wide text-zinc-500">
                        <th className="sticky top-0 bg-zinc-950 px-3 py-2">Nombre</th>
                        <th className="sticky top-0 bg-zinc-950 px-3 py-2">Apellido</th>
                        <th className="sticky top-0 bg-zinc-950 px-3 py-2">Cédula</th>
                        <th className="sticky top-0 bg-zinc-950 px-3 py-2">Teléfono</th>
                        <th className="sticky top-0 bg-zinc-950 px-3 py-2">Oficio</th>
                        {listaModal === 'activos' ? (
                          <th className="sticky top-0 bg-zinc-950 px-3 py-2 text-center">Contrato</th>
                        ) : null}
                        <th className="sticky top-0 bg-zinc-950 px-3 py-2 text-right">Eliminar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filasListaModal.map((row) => {
                        const { nombre, apellido } = nombreApellidoDesdeEmpleado(row);
                        const puedeEliminar = demoListasObrero || solicitadosWorkerIdSet.has(row.id);
                        const esDemoFila = demoListasObrero && IDS_DEMO_FILA.has(row.id);
                        return (
                          <tr key={row.id} className="border-b border-white/[0.06] hover:bg-white/5">
                            <td className="px-3 py-2 font-medium text-zinc-100">
                              {esEmpleadoContratoExpress(row) ? (
                                <Link
                                  href={`/proyectos/modulo/${encodeURIComponent(proyectoModuloId)}?tab=solicitados`}
                                  className="text-amber-200 underline decoration-amber-500/40 hover:text-amber-100"
                                  title="Contrato express: cuadro en el módulo (Solicitados)"
                                >
                                  {nombre}
                                </Link>
                              ) : (
                                <Link
                                  href={`/empleados/${encodeURIComponent(row.id)}`}
                                  className="text-sky-300 underline decoration-sky-500/40 hover:text-sky-200"
                                >
                                  {nombre}
                                </Link>
                              )}
                            </td>
                            <td className="px-3 py-2 text-zinc-200">{apellido}</td>
                            <td className="px-3 py-2 tabular-nums text-zinc-300">{cedulaDesdeEmpleado(row)}</td>
                            <td className="px-3 py-2 tabular-nums text-zinc-300">{telefonoDesdeEmpleado(row)}</td>
                            <td className="px-3 py-2 text-zinc-300">{oficioDesdeEmpleado(row)}</td>
                            {listaModal === 'activos' ? (
                              <td className="px-3 py-2 text-center">
                                <AccionesContratoPdfFila
                                  empleadoRowId={row.id}
                                  nombreObrero={[nombre, apellido].filter((x) => x && x !== '—').join(' ')}
                                />
                              </td>
                            ) : null}
                            <td className="px-3 py-2 text-right">
                              {puedeEliminar ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 gap-1.5 text-rose-300 hover:bg-rose-500/15 hover:text-rose-200"
                                  disabled={eliminandoWorkerId === row.id}
                                  onClick={() => {
                                    if (esDemoFila && listaModal) {
                                      setDemoEliminadoPorLista((p) => ({ ...p, [listaModal]: true }));
                                      toast.success('Fila de prueba ocultada (no afecta la base de datos).');
                                      return;
                                    }
                                    void quitarAsignacionLaboral(row.id);
                                  }}
                                  title={
                                    esDemoFila
                                      ? 'Ocultar la fila ficticia de prueba'
                                      : 'Quitar asignación a solicitud de mano de obra en este módulo'
                                  }
                                >
                                  <Trash2 className="h-4 w-4 shrink-0" aria-hidden />
                                  <span className="hidden sm:inline">Quitar</span>
                                </Button>
                              ) : (
                                <span className="text-xs text-zinc-600">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </DialogContent>
          </Dialog>

      <Dialog open={expressPanelAbierto} onOpenChange={setExpressPanelAbierto}>
        <DialogContent className="max-h-[92vh] overflow-y-auto border-amber-500/25 bg-zinc-950 p-0 sm:max-w-[min(96vw,920px)]">
          <ContratosExpressModuloPanel
            moduloIntegralId={proyectoModuloId}
            proyectoIdsAlcance={proyectoIdsExpressAlcance}
          />
        </DialogContent>
      </Dialog>
    </section>
  );
}
