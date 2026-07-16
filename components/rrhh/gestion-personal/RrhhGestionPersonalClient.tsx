'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Copy, MessageCircle, Trash2 } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { coincideEspecialidad, esObreroDisponible } from '@/lib/rrhh/laborPersonnel';
import { projectIdsAlcanceLaborDesdeModulos } from '@/lib/rrhh/alcanceLaborProyectos';
import { loadProyectosModuloIntegralPorEntidad } from '@/lib/proyectos/proyectosUnificados';
import { publicRegistroOrigin } from '@/lib/registro/publicRegistroOrigin';
import { createClient } from '@/lib/supabase/client';
import ResumenObrerosProyectoModulo from '@/components/proyectos/ResumenObrerosProyectoModulo';
import { hrefSolicitudPersonalObrero } from '@/lib/rrhh/hrefSolicitudPersonal';
import Link from 'next/link';
import { ResumenSolicitadosOficiosToolbar } from '@/components/rrhh/gestion-personal/ResumenSolicitadosOficiosToolbar';
import BonoUsdEditor from '@/components/rrhh/BonoUsdEditor';
import { isBonoColumnMissingError, parseBonoUsd } from '@/lib/rrhh/projectAssignmentBono';
import { idsObrerosConContratoSuscrito } from '@/lib/rrhh/obreroContratoSuscrito';

type LaborRequestRow = {
  id: string;
  project_id: string;
  specialty_codigo: string;
  specialty_nombre: string | null;
  quantity_requested: number;
  status: string;
  notes: string | null;
  created_at: string;
};

type AssignmentRow = {
  id: string;
  labor_request_id: string;
  worker_id: string;
  project_id: string;
  created_at: string;
  bono_usd: number;
};

type EmpleadoRow = {
  id: string;
  nombre_completo: string;
  email?: string | null;
  documento?: string | null;
  telefono?: string | null;
  cargo_codigo?: string | null;
  cargo_nombre?: string | null;
  estado: string | null;
  estatus?: string | null;
  rol_examen?: string | null;
  created_at?: string | null;
};

async function contarAsignaciones(
  supabase: ReturnType<typeof createClient>,
  laborRequestId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from('project_assignments')
    .select('id', { count: 'exact', head: true })
    .eq('labor_request_id', laborRequestId);
  if (error) return 0;
  return count ?? 0;
}

const ASSIGN_SELECT_BASE = 'id,labor_request_id,worker_id,project_id,created_at';
const ASSIGN_SELECT_BONO = `${ASSIGN_SELECT_BASE},bono_usd`;

function filaAsignacion(raw: Record<string, unknown>): AssignmentRow {
  const bonoRaw = raw.bono_usd;
  const bono =
    typeof bonoRaw === 'number' && Number.isFinite(bonoRaw)
      ? Math.max(0, Math.round(bonoRaw * 100) / 100)
      : 0;
  return {
    id: String(raw.id ?? ''),
    labor_request_id: String(raw.labor_request_id ?? ''),
    worker_id: String(raw.worker_id ?? ''),
    project_id: String(raw.project_id ?? ''),
    created_at: String(raw.created_at ?? ''),
    bono_usd: bono,
  };
}

async function cargarAsignaciones(
  supabase: ReturnType<typeof createClient>,
  filtro?: { laborRequestIds?: string[]; projectIds?: string[] | null; limit?: number },
): Promise<AssignmentRow[]> {
  const cols = ASSIGN_SELECT_BONO;
  let q = supabase.from('project_assignments').select(cols).order('created_at', { ascending: false });
  if (filtro?.limit) q = q.limit(filtro.limit);
  if (filtro?.laborRequestIds?.length) q = q.in('labor_request_id', filtro.laborRequestIds);
  if (filtro?.projectIds != null && filtro.projectIds.length > 0) q = q.in('project_id', filtro.projectIds);
  const res = await q;
  let rowsRaw: Record<string, unknown>[] = (res.data ?? []) as Record<string, unknown>[];
  let loadErr = res.error;
  if (loadErr && isBonoColumnMissingError(loadErr.message)) {
    let q2 = supabase.from('project_assignments').select(ASSIGN_SELECT_BASE).order('created_at', { ascending: false });
    if (filtro?.limit) q2 = q2.limit(filtro.limit);
    if (filtro?.laborRequestIds?.length) q2 = q2.in('labor_request_id', filtro.laborRequestIds);
    if (filtro?.projectIds != null && filtro.projectIds.length > 0) q2 = q2.in('project_id', filtro.projectIds);
    const res2 = await q2;
    rowsRaw = (res2.data ?? []) as Record<string, unknown>[];
    loadErr = res2.error;
  }
  if (loadErr) return [];
  return rowsRaw.map((r) => filaAsignacion(r));
}

const TABS = ['pendientes', 'obra'] as const;
type GestionPersonalTab = (typeof TABS)[number];

function tabFromInitial(raw: string | undefined): GestionPersonalTab {
  if (raw === 'obra' || raw === 'pendientes') return raw;
  return 'pendientes';
}

function hrefFormatoHojaVidaLabor(projectId: string, codigoOficio: string): string {
  const base = publicRegistroOrigin().replace(/\/$/, '');
  return `${base}/registro?prj=${encodeURIComponent(projectId.trim())}&role=${encodeURIComponent(codigoOficio.trim())}`;
}

function mensajeWhatsAppPlanilla(link: string, specialtyNombre: string | null, codigo: string): string {
  const cargo = (specialtyNombre ?? '').trim() || codigo.trim();
  return `Hola, Casa Inteligente te invita a completar la hoja de vida / planilla para el oficio «${cargo}». Enlace:\n${link}`;
}

type RrhhGestionPersonalClientProps = {
  /** Resuelto en el Server Component desde `searchParams` (fiable en primer paint y SSR). */
  soloPendientesInitial?: boolean;
  /** Formulario de solicitud obrero (oficio) + listado de solicitados. */
  vistaSolicitudInitial?: boolean;
  tabInitial?: string;
  /** Filtra solicitudes y asignaciones al módulo integral y sus obras Talento (`proyecto_modulo_origen_id`). */
  proyectoModuloInitial?: string;
  /** Filtra a un solo `ci_proyectos.id` (obra o módulo). */
  proyectoObraInitial?: string;
};

export default function RrhhGestionPersonalClient({
  soloPendientesInitial = false,
  vistaSolicitudInitial = false,
  tabInitial,
  proyectoModuloInitial,
  proyectoObraInitial,
}: RrhhGestionPersonalClientProps) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const searchParams = useSearchParams();
  const soloFromClient = searchParams.get('solo') === 'pendientes';
  const vistaSolicitudFromClient = searchParams.get('vista') === 'solicitud';
  /** Si servidor y cliente difieren (hook desfasado), prevalece el valor del Server Component. */
  const soloPendientes =
    soloPendientesInitial === soloFromClient ? soloFromClient : soloPendientesInitial;
  const vistaSolicitud = vistaSolicitudInitial || vistaSolicitudFromClient;

  const tabInitialResolved = tabFromInitial(tabInitial);
  const rawTab = searchParams.get('tab');
  const tabFromUrl: GestionPersonalTab | null =
    rawTab === 'obra' || rawTab === 'pendientes' ? rawTab : null;
  const tab: GestionPersonalTab = soloPendientes ? 'pendientes' : tabFromUrl ?? tabInitialResolved;

  const proyectoModuloFiltro = (searchParams.get('proyecto_modulo') ?? proyectoModuloInitial ?? '').trim();
  const proyectoObraFiltro = (searchParams.get('proyecto') ?? proyectoObraInitial ?? '').trim();
  const todosProyectosFiltro = searchParams.get('todos') === '1';
  const entidadFiltro = (searchParams.get('entidad') ?? '').trim();
  const proyectoModuloIdsFiltro = useMemo(() => {
    const raw = searchParams.get('proyecto_modulo_ids')?.trim() ?? '';
    if (!raw) return [];
    return raw.split(',').map((s) => s.trim()).filter(Boolean);
  }, [searchParams]);

  const replaceGestionUrl = useCallback(
    (patch: Record<string, string | null | undefined>) => {
      const p = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v == null || v === '') p.delete(k);
        else p.set(k, v);
      }
      const qs = p.toString();
      router.replace(qs ? `/rrhh/gestion-personal?${qs}` : '/rrhh/gestion-personal', { scroll: false });
    },
    [router, searchParams],
  );

  const [tick, setTick] = useState(0);
  const [alcanceNombre, setAlcanceNombre] = useState<string | null>(null);
  const [pending, setPending] = useState<LaborRequestRow[]>([]);
  const [loadingPending, setLoadingPending] = useState(true);

  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [nombreProyecto, setNombreProyecto] = useState<Map<string, string>>(new Map());
  const [nombreEmpleado, setNombreEmpleado] = useState<Map<string, string>>(new Map());
  const [loadingObra, setLoadingObra] = useState(true);

  const [dialogReq, setDialogReq] = useState<LaborRequestRow | null>(null);
  const [candidatos, setCandidatos] = useState<EmpleadoRow[]>([]);
  const [yaAsignados, setYaAsignados] = useState(0);
  const [loadingDialog, setLoadingDialog] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());
  /** Bono USD por obrero al asignar (worker_id → texto del input). */
  const [bonoPorObrero, setBonoPorObrero] = useState<Record<string, string>>({});
  const [asignadosPorSolicitud, setAsignadosPorSolicitud] = useState<Map<string, AssignmentRow[]>>(new Map());
  /** Obreros con contrato ya suscrito: el bono de la asignación queda en solo lectura. */
  const [obrerosConContrato, setObrerosConContrato] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    const workerIds = Array.from(
      new Set([
        ...assignments.map((a) => a.worker_id),
        ...Array.from(asignadosPorSolicitud.values())
          .flat()
          .map((a) => a.worker_id),
      ]),
    );
    if (!workerIds.length) {
      setObrerosConContrato(new Set());
      return;
    }
    let alive = true;
    void idsObrerosConContratoSuscrito(supabase, workerIds).then((s) => {
      if (alive) setObrerosConContrato(s);
    });
    return () => {
      alive = false;
    };
  }, [supabase, assignments, asignadosPorSolicitud, tick]);

  const copiarEnlaceHojaVida = useCallback(async (r: LaborRequestRow) => {
    const href = hrefFormatoHojaVidaLabor(r.project_id, r.specialty_codigo);
    try {
      await navigator.clipboard.writeText(href);
      toast.success('Enlace del formato de hoja de vida copiado.');
    } catch {
      toast.error('No se pudo copiar al portapapeles.');
    }
  }, []);

  const abrirWhatsAppPlanilla = useCallback((r: LaborRequestRow) => {
    const href = hrefFormatoHojaVidaLabor(r.project_id, r.specialty_codigo);
    const text = mensajeWhatsAppPlanilla(href, r.specialty_nombre, r.specialty_codigo);
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  }, []);

  const borrarSolicitud = useCallback(
    async (r: LaborRequestRow) => {
      const n = await contarAsignaciones(supabase, r.id);
      const msg =
        n > 0
          ? `Esta solicitud tiene ${n} asignación(es) en obra. Al borrarla se eliminarán esas filas (cascade). Los obreros sin otra asignación volverán a estatus «disponible». ¿Continuar?`
          : '¿Borrar esta solicitud de obreros? No se puede deshacer.';
      if (!window.confirm(msg)) return;

      const { data: asgRows, error: fetchAsgErr } = await supabase
        .from('project_assignments')
        .select('worker_id')
        .eq('labor_request_id', r.id);
      if (fetchAsgErr) {
        toast.error(fetchAsgErr.message);
        return;
      }
      const workerIdsAfectados = Array.from(
        new Set(
          (asgRows ?? [])
            .map((row) => (row as { worker_id?: string }).worker_id)
            .filter((id): id is string => typeof id === 'string' && id.length > 0),
        ),
      );

      const { error } = await supabase.from('labor_requests').delete().eq('id', r.id);
      if (error) {
        toast.error(error.message);
        return;
      }

      for (const wid of workerIdsAfectados) {
        const { count, error: cErr } = await supabase
          .from('project_assignments')
          .select('id', { count: 'exact', head: true })
          .eq('worker_id', wid);
        if (cErr) continue;
        if ((count ?? 0) === 0) {
          await supabase.from('ci_empleados').update({ estatus: 'disponible' }).eq('id', wid);
        }
      }

      if (dialogReq?.id === r.id) setDialogReq(null);
      toast.success('Solicitud eliminada.');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('ci-resumen-obreros-refresh'));
      }
      refresh();
    },
    [supabase, dialogReq, refresh],
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoadingPending(true);

      let scope: string[] | null = null;
      let nombreAlcance: string | null = null;
      const pm = proyectoModuloFiltro;
      const po = proyectoObraFiltro;
      if (entidadFiltro) {
        const { proyectos, errors: entErr } = await loadProyectosModuloIntegralPorEntidad(
          supabase,
          entidadFiltro,
        );
        if (!alive) return;
        if (entErr.length && !proyectos.length) {
          setPending([]);
          setLoadingPending(false);
          return;
        }
        const modulos = proyectos.map((p) => p.id);
        scope = modulos.length ? await projectIdsAlcanceLaborDesdeModulos(supabase, modulos) : [];
        const { data: ent } = await supabase
          .from('ci_entidades')
          .select('nombre')
          .eq('id', entidadFiltro)
          .maybeSingle();
        if (!alive) return;
        const nomEnt = ((ent as { nombre?: string | null } | null)?.nombre ?? '').trim();
        nombreAlcance = nomEnt
          ? `Todos los proyectos · ${nomEnt}`
          : 'Todos los proyectos de la entidad';
      } else if (todosProyectosFiltro) {
        scope = null;
        nombreAlcance = 'Todos los proyectos';
      } else if (proyectoModuloIdsFiltro.length > 0) {
        scope = await projectIdsAlcanceLaborDesdeModulos(supabase, proyectoModuloIdsFiltro);
        if (!alive) return;
        nombreAlcance =
          proyectoModuloIdsFiltro.length === 1
            ? (
                await supabase
                  .from('ci_proyectos')
                  .select('nombre')
                  .eq('id', proyectoModuloIdsFiltro[0]!)
                  .maybeSingle()
              ).data?.nombre?.trim() || null
            : `Todos los proyectos (${proyectoModuloIdsFiltro.length})`;
      } else if (pm) {
        scope = await projectIdsAlcanceLaborDesdeModulos(supabase, [pm]);
        if (!alive) return;
        const { data: nom } = await supabase.from('ci_proyectos').select('nombre').eq('id', pm).maybeSingle();
        if (!alive) return;
        nombreAlcance = ((nom as { nombre?: string | null } | null)?.nombre ?? '').trim() || null;
      } else if (po) {
        scope = [po];
        const { data: nom } = await supabase.from('ci_proyectos').select('nombre').eq('id', po).maybeSingle();
        if (!alive) return;
        nombreAlcance = ((nom as { nombre?: string | null } | null)?.nombre ?? '').trim() || null;
      } else {
        scope = null;
        nombreAlcance = 'Todos los proyectos';
      }

      setAlcanceNombre(nombreAlcance);

      let q = supabase
        .from('labor_requests')
        .select('id,project_id,specialty_codigo,specialty_nombre,quantity_requested,status,notes,created_at')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      if (scope != null && scope.length > 0) {
        q = q.in('project_id', scope);
      }
      const { data, error } = await q;
      if (!alive) return;
      if (error) {
        setPending([]);
        if (!(error.message ?? '').toLowerCase().includes('labor_requests')) toast.error(error.message);
      } else {
        const pend = (data ?? []) as LaborRequestRow[];
        setPending(pend);
        const pids = Array.from(new Set(pend.map((p) => p.project_id)));
        if (pids.length) {
          const { data: ps } = await supabase.from('ci_proyectos').select('id,nombre').in('id', pids);
          if (!alive) return;
          setNombreProyecto((prev) => {
            const m = new Map(prev);
            for (const raw of ps ?? []) {
              const r = raw as { id: string; nombre?: string | null };
              m.set(r.id, (r.nombre ?? '').trim() || r.id.slice(0, 8));
            }
            return m;
          });
        }
        const reqIds = pend.map((p) => p.id);
        if (reqIds.length) {
          const asgRows = await cargarAsignaciones(supabase, { laborRequestIds: reqIds });
          if (!alive) return;
          const porReq = new Map<string, AssignmentRow[]>();
          for (const a of asgRows) {
            if (!porReq.has(a.labor_request_id)) porReq.set(a.labor_request_id, []);
            porReq.get(a.labor_request_id)!.push(a);
          }
          setAsignadosPorSolicitud(porReq);
          const eids = Array.from(new Set(asgRows.map((a) => a.worker_id)));
          if (eids.length) {
            const { data: emps } = await supabase
              .from('ci_empleados')
              .select('id,nombre_completo')
              .in('id', eids);
            if (!alive) return;
            setNombreEmpleado((prev) => {
              const m = new Map(prev);
              for (const raw of emps ?? []) {
                const r = raw as { id: string; nombre_completo?: string | null };
                m.set(r.id, (r.nombre_completo ?? '').trim() || r.id.slice(0, 8));
              }
              return m;
            });
          }
        } else {
          setAsignadosPorSolicitud(new Map());
        }
      }
      setLoadingPending(false);
    })();
    return () => {
      alive = false;
    };
  }, [
    supabase,
    tick,
    proyectoModuloFiltro,
    proyectoObraFiltro,
    todosProyectosFiltro,
    entidadFiltro,
    proyectoModuloIdsFiltro,
  ]);

  useEffect(() => {
    if (soloPendientes) {
      setLoadingObra(false);
      setAssignments([]);
      setNombreEmpleado(new Map());
      return;
    }
    let alive = true;
    (async () => {
      setLoadingObra(true);
      let scopeIds: string[] | null = null;
      const pm = proyectoModuloFiltro;
      const po = proyectoObraFiltro;
      if (entidadFiltro) {
        const { proyectos } = await loadProyectosModuloIntegralPorEntidad(supabase, entidadFiltro);
        if (!alive) return;
        const modulos = proyectos.map((p) => p.id);
        scopeIds = modulos.length ? await projectIdsAlcanceLaborDesdeModulos(supabase, modulos) : [];
      } else if (todosProyectosFiltro) {
        scopeIds = null;
      } else if (proyectoModuloIdsFiltro.length > 0) {
        scopeIds = await projectIdsAlcanceLaborDesdeModulos(supabase, proyectoModuloIdsFiltro);
        if (!alive) return;
      } else if (pm) {
        scopeIds = await projectIdsAlcanceLaborDesdeModulos(supabase, [pm]);
        if (!alive) return;
      } else if (po) {
        scopeIds = [po];
      }
      const rows = await cargarAsignaciones(supabase, {
        projectIds: scopeIds,
        limit: 800,
      });
      if (!alive) return;
      setAssignments(rows);
      const pids = Array.from(new Set(rows.map((r) => r.project_id)));
      const eids = Array.from(new Set(rows.map((r) => r.worker_id)));
      const em = new Map<string, string>();
      if (pids.length) {
        const { data: ps } = await supabase.from('ci_proyectos').select('id,nombre').in('id', pids);
        if (!alive) return;
        setNombreProyecto((prev) => {
          const pm = new Map(prev);
          for (const p of ps ?? []) {
            const r = p as { id: string; nombre?: string | null };
            pm.set(r.id, (r.nombre ?? '').trim() || r.id.slice(0, 8));
          }
          return pm;
        });
      }
      if (eids.length) {
        const { data: es } = await supabase.from('ci_empleados').select('id,nombre_completo').in('id', eids);
        for (const p of es ?? []) {
          const r = p as { id: string; nombre_completo?: string | null };
          em.set(r.id, (r.nombre_completo ?? '').trim() || r.id.slice(0, 8));
        }
      }
      if (!alive) return;
      setNombreEmpleado(em);
      setLoadingObra(false);
    })();
    return () => {
      alive = false;
    };
  }, [
    supabase,
    tick,
    soloPendientes,
    proyectoModuloFiltro,
    proyectoObraFiltro,
    todosProyectosFiltro,
    entidadFiltro,
    proyectoModuloIdsFiltro,
  ]);

  const asignacionesPorProyecto = useMemo(() => {
    const m = new Map<string, AssignmentRow[]>();
    for (const a of assignments) {
      const k = a.project_id;
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(a);
    }
    return Array.from(m.entries()).sort(([a], [b]) => {
      const na = nombreProyecto.get(a) ?? a;
      const nb = nombreProyecto.get(b) ?? b;
      return na.localeCompare(nb, 'es');
    });
  }, [assignments, nombreProyecto]);

  async function abrirAsignacion(req: LaborRequestRow) {
    setDialogReq(req);
    setSel(new Set());
    setBonoPorObrero({});
    setLoadingDialog(true);
    const n = await contarAsignaciones(supabase, req.id);
    setYaAsignados(n);

    const { data, error } = await supabase
      .from('ci_empleados')
      .select('id,nombre_completo,cargo_codigo,cargo_nombre,estado,estatus,rol_examen')
      .eq('rol_examen', 'obrero')
      .eq('estado', 'aprobado')
      .or('estatus.is.null,estatus.eq.disponible');

    if (error) {
      toast.error(error.message);
      setCandidatos([]);
    } else {
      const assignedIds = new Set(
        (await supabase.from('project_assignments').select('worker_id').eq('labor_request_id', req.id)).data?.map(
          (r) => (r as { worker_id: string }).worker_id,
        ) ?? [],
      );
      const list = ((data ?? []) as EmpleadoRow[]).filter(
        (row) =>
          esObreroDisponible(row) &&
          coincideEspecialidad(req.specialty_codigo, row) &&
          !assignedIds.has(row.id),
      );
      setCandidatos(list);
    }
    setLoadingDialog(false);
  }

  const cupoRestante = dialogReq ? Math.max(0, dialogReq.quantity_requested - yaAsignados) : 0;

  function toggleSel(id: string) {
    setSel((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        setBonoPorObrero((b) => {
          const copy = { ...b };
          delete copy[id];
          return copy;
        });
      } else {
        if (next.size >= cupoRestante) {
          toast.message('Cupo completo', { description: `Solo puedes asignar ${cupoRestante} obrero(s) más.` });
          return prev;
        }
        next.add(id);
        setBonoPorObrero((b) => ({ ...b, [id]: b[id] ?? '0' }));
      }
      return next;
    });
  }

  function actualizarBonoLocal(assignmentId: string, laborRequestId: string, bono: number) {
    setAsignadosPorSolicitud((prev) => {
      const m = new Map(prev);
      const list = m.get(laborRequestId);
      if (!list) return prev;
      m.set(
        laborRequestId,
        list.map((a) => (a.id === assignmentId ? { ...a, bono_usd: bono } : a)),
      );
      return m;
    });
    setAssignments((prev) => prev.map((a) => (a.id === assignmentId ? { ...a, bono_usd: bono } : a)));
  }

  async function confirmarAsignacion() {
    if (!dialogReq || sel.size === 0) return;
    if (sel.size > cupoRestante) {
      toast.error('No puedes asignar más obreros de los solicitados.');
      return;
    }
    setSubmitting(true);
    const req = dialogReq;
    const ids = Array.from(sel);
    try {
      for (const wid of ids) {
        const bono = parseBonoUsd(bonoPorObrero[wid] ?? '0');
        const { error: ins } = await supabase.from('project_assignments').insert({
          labor_request_id: req.id,
          worker_id: wid,
          project_id: req.project_id,
          bono_usd: bono,
        });
        if (ins) {
          if (isBonoColumnMissingError(ins.message)) {
            const { error: ins2 } = await supabase.from('project_assignments').insert({
              labor_request_id: req.id,
              worker_id: wid,
              project_id: req.project_id,
            });
            if (ins2) throw new Error(ins2.message);
          } else {
            throw new Error(ins.message);
          }
        }
        const { error: up } = await supabase.from('ci_empleados').update({ estatus: 'asignado' }).eq('id', wid);
        if (up) throw new Error(up.message);
      }
      const total = yaAsignados + ids.length;
      if (total >= req.quantity_requested) {
        const { error: fu } = await supabase
          .from('labor_requests')
          .update({ status: 'fulfilled', updated_at: new Date().toISOString() })
          .eq('id', req.id);
        if (fu) throw new Error(fu.message);
      }
      toast.success('Asignación registrada.');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('ci-resumen-obreros-refresh'));
      }
      setDialogReq(null);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al asignar.');
    } finally {
      setSubmitting(false);
    }
  }

  const hayFiltroAlcance = Boolean(
    proyectoModuloFiltro ||
      proyectoObraFiltro ||
      todosProyectosFiltro ||
      entidadFiltro ||
      proyectoModuloIdsFiltro.length > 0,
  );
  const alcanceTodosProyectos =
    todosProyectosFiltro ||
    (!proyectoModuloFiltro &&
      !proyectoObraFiltro &&
      !entidadFiltro &&
      proyectoModuloIdsFiltro.length === 0);

  const resumenOficiosSolicitados = useMemo(() => {
    const map = new Map<
      string,
      { codigo: string; nombre: string | null; plazas: number; solicitudes: number }
    >();
    for (const r of pending) {
      const cod = r.specialty_codigo.trim() || '—';
      const cur = map.get(cod) ?? {
        codigo: cod,
        nombre: r.specialty_nombre,
        plazas: 0,
        solicitudes: 0,
      };
      cur.plazas += Math.max(0, r.quantity_requested);
      cur.solicitudes += 1;
      map.set(cod, cur);
    }
    return Array.from(map.values()).sort((a, b) => a.codigo.localeCompare(b.codigo, 'es'));
  }, [pending]);

  const totalPlazasPendientes = useMemo(
    () => pending.reduce((a, r) => a + Math.max(0, r.quantity_requested), 0),
    [pending],
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.location.hash !== '#cuadro-solicitados') return;
    const t = window.setTimeout(() => {
      document.getElementById('cuadro-solicitados')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 250);
    return () => window.clearTimeout(t);
  }, [loadingPending, proyectoModuloFiltro, proyectoObraFiltro]);

  const bannerAlcanceLabor = hayFiltroAlcance ? (
    <div className="mb-4 flex flex-col gap-2 rounded-lg border border-sky-500/30 bg-sky-950/40 px-3 py-2 text-sm text-sky-100 sm:flex-row sm:items-center sm:justify-between">
      <p>
        <span className="font-semibold text-white">SOLICITADOS.</span>{' '}
        {alcanceNombre ?? 'Seleccionado'}
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="shrink-0 border-white/10 text-zinc-300 hover:bg-white/5 backdrop-blur-sm"
        onClick={() => replaceGestionUrl({ proyecto_modulo: null, proyecto: null })}
      >
        Ver todo (todos los proyectos)
      </Button>
    </div>
  ) : null;

  const pendientesInner = (
    <>
      {!soloPendientes ? (
        <div className="mb-6">
          <h2 className="text-2xl font-bold tracking-tight text-white">Cuadro de solicitados</h2>
          {!hayFiltroAlcance ? (
            <p className="mt-1 text-sm text-zinc-400">
              Gestión de personal requerido por oficio (tabulador GOE).
            </p>
          ) : null}
        </div>
      ) : null}

      {hayFiltroAlcance && !loadingPending && resumenOficiosSolicitados.length > 0 ? (
        <section className="mb-6 overflow-hidden rounded-2xl border border-violet-500/35 bg-violet-950/25">
          <div className={`border-b border-violet-500/25 ${soloPendientes ? 'px-3 py-2 sm:px-4' : 'px-4 py-3 sm:px-5'}`}>
            <div
              className={
                soloPendientes
                  ? 'flex justify-end'
                  : 'flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'
              }
            >
              {!soloPendientes ? (
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wide text-violet-200">Resumen por oficio</h3>
                  <p className="mt-0.5 text-xs text-zinc-400">
                    {totalPlazasPendientes} plaza(s) en {pending.length} solicitud(es) pendiente(s)
                  </p>
                </div>
              ) : null}
              <ResumenSolicitadosOficiosToolbar
                proyectoModuloId={proyectoModuloFiltro || undefined}
                proyectoObraId={proyectoObraFiltro || undefined}
                proyectoModuloIds={
                  proyectoModuloIdsFiltro.length > 1 ? proyectoModuloIdsFiltro : undefined
                }
                entidadId={entidadFiltro || undefined}
                todosLosProyectos={alcanceTodosProyectos}
                alcanceNombre={alcanceNombre}
                iconsOnly={soloPendientes}
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-[10px] font-bold uppercase tracking-wide text-zinc-500">
                  <th className="px-4 py-2.5 sm:px-5">Plazas · oficio (tabulador)</th>
                  <th className="px-4 py-2.5 text-right sm:pr-5">Solicitudes</th>
                </tr>
              </thead>
              <tbody>
                {resumenOficiosSolicitados.map((row) => (
                  <tr key={row.codigo} className="border-b border-white/5 last:border-0">
                    <td className="px-4 py-3 sm:px-5">
                      <p className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-sm leading-snug">
                        <span className="tabular-nums font-bold text-white">{row.plazas}</span>
                        <span className="text-zinc-600" aria-hidden>
                          ·
                        </span>
                        <span className="font-mono font-semibold text-violet-100">{row.codigo}</span>
                        {row.nombre ? (
                          <span className="text-zinc-400">— {row.nombre}</span>
                        ) : null}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-zinc-300 sm:pr-5">{row.solicitudes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {loadingPending ? (
        <p className="text-sm text-zinc-500">Cargando…</p>
      ) : pending.length === 0 ? (
        <p className="text-sm text-zinc-500">
          {hayFiltroAlcance
            ? 'No hay solicitudes pendientes para el alcance de este proyecto.'
            : 'No hay solicitudes en estado pending.'}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence>
            {pending.map((r) => (
              <motion.div
                key={r.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="group relative overflow-hidden rounded-2xl border border-white/5 bg-gradient-to-br from-zinc-900/50 to-zinc-950/50 p-5 backdrop-blur-xl transition-all duration-300 hover:border-white/10 hover:shadow-2xl hover:shadow-sky-500/5"
              >
                <div className="absolute inset-0 -z-10 bg-gradient-to-br from-sky-500/5 to-purple-500/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                
                <h3 className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-base font-bold leading-snug tracking-tight text-white sm:text-lg">
                  <span className="tabular-nums text-sky-300">{r.quantity_requested}</span>
                  <span className="font-normal text-zinc-600" aria-hidden>
                    ·
                  </span>
                  <span className="font-mono text-violet-100">{r.specialty_codigo}</span>
                  <span className="font-normal text-zinc-400">
                    — {r.specialty_nombre ?? 'Sin nombre de especialidad'}
                  </span>
                </h3>

                <div className="mt-4 grid grid-cols-1 gap-2 text-xs text-zinc-500">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-zinc-400">Proyecto:</span>
                    <span className="truncate" title={r.project_id}>
                      {nombreProyecto.get(r.project_id) ?? r.project_id.slice(0, 8)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-zinc-400">Fecha:</span>
                    <span>{new Date(r.created_at).toLocaleString('es-VE')}</span>
                  </div>
                </div>

                {(asignadosPorSolicitud.get(r.id) ?? []).length > 0 ? (
                  <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-950/20 px-3 py-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-amber-300/90">
                      Obreros asignados · Bono (USD)
                    </p>
                    <p className="text-[9px] text-zinc-600">
                      Editable hasta que el obrero suscriba el contrato; después queda fijo.
                    </p>
                    <ul className="mt-2 space-y-2">
                      {(asignadosPorSolicitud.get(r.id) ?? []).map((a) => (
                        <li
                          key={a.id}
                          className="flex flex-wrap items-center justify-between gap-2 text-xs"
                        >
                          <span className="min-w-0 font-medium text-zinc-200">
                            {nombreEmpleado.get(a.worker_id) ?? a.worker_id.slice(0, 8)}
                            {!obrerosConContrato.has(a.worker_id) ? (
                              <Link
                                href={`/rrhh/registro?worker=${encodeURIComponent(a.worker_id)}&proyecto=${encodeURIComponent(r.project_id)}`}
                                className="mt-0.5 block text-[10px] font-semibold text-sky-400/90 hover:text-sky-300"
                              >
                                Generar contrato express →
                              </Link>
                            ) : (
                              <span className="mt-0.5 block text-[10px] text-zinc-600">Contrato suscrito</span>
                            )}
                          </span>
                          <BonoUsdEditor
                            assignmentId={a.id}
                            value={a.bono_usd}
                            compact
                            readOnly={obrerosConContrato.has(a.worker_id)}
                            onSaved={(bono) => actualizarBonoLocal(a.id, r.id, bono)}
                          />
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <div className="mt-5 flex flex-wrap items-center justify-end gap-2 border-t border-white/5 pt-4">
                  <Button
                    type="button"
                    size="sm"
                    variant="elite"
                    className="gap-1.5 h-8 text-xs"
                    title="Copiar enlace público del formato de hoja de vida"
                    onClick={() => void copiarEnlaceHojaVida(r)}
                  >
                    <Copy className="h-3 w-3" aria-hidden />
                    Enlace HV
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="elite"
                    className="gap-1.5 h-8 text-xs border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10"
                    title="Abrir WhatsApp con mensaje e enlace"
                    onClick={() => abrirWhatsAppPlanilla(r)}
                  >
                    <MessageCircle className="h-3 w-3" aria-hidden />
                    WhatsApp
                  </Button>
                  <Button 
                    type="button" 
                    size="sm" 
                    variant="elitePrimary" 
                    className="h-8 text-xs bg-sky-600 hover:bg-sky-700 text-white"
                    onClick={() => void abrirAsignacion(r)}
                  >
                    Asignar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs border-red-500/20 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                    title="Eliminar solicitud"
                    onClick={() => void borrarSolicitud(r)}
                  >
                    <Trash2 className="h-3 w-3" aria-hidden />
                    Borrar
                  </Button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </>
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 text-white">
      {vistaSolicitud ? (
        <div className="mb-6">
          <div className="mb-3 flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 shrink-0 border-white/15 bg-zinc-900/50 text-zinc-200 hover:bg-white/10"
              asChild
            >
              <Link href="/rrhh/hojas-vida" aria-label="Volver a RRHH">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">RRHH</p>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Solicitud de personal obrero</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Registra plazas por oficio (tabulador) y revisa los solicitados pendientes de asignación.
          </p>
        </div>
      ) : null}

      {!soloPendientes ? bannerAlcanceLabor : null}

      {proyectoModuloFiltro && !vistaSolicitud && !soloPendientes ? (
        <div className="mb-6">
          <ResumenObrerosProyectoModulo proyectoModuloId={proyectoModuloFiltro} />
        </div>
      ) : null}

      {vistaSolicitud ? (
        <div className="space-y-8">
          <section className="rounded-2xl border border-violet-500/25 bg-violet-950/15 p-6 shadow-2xl shadow-black/40">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-violet-100">Nueva solicitud (oficio)</h2>
                <p className="mt-1 text-sm text-zinc-400">
                  Registra plazas por oficio y cantidad en el tabulador GOE 6.752.
                </p>
              </div>
              <Link
                href={hrefSolicitudPersonalObrero({
                  proyectoModuloId: proyectoModuloFiltro || null,
                  proyectoObraId: proyectoObraFiltro || null,
                })}
                className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-violet-400/50 bg-violet-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-violet-500"
              >
                Solicitud de personal obrero
              </Link>
            </div>
          </section>
          <section className="rounded-2xl border border-white/5 bg-zinc-900/20 backdrop-blur-xl p-6 shadow-2xl shadow-black/40">
            {pendientesInner}
          </section>
        </div>
      ) : soloPendientes ? (
        <>
          <header className="mb-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 shrink-0 border-white/15 bg-zinc-900/50 text-zinc-200 hover:bg-white/10"
                  asChild
                >
                  <Link href="/rrhh/hojas-vida" aria-label="Volver a RRHH">
                    <ArrowLeft className="h-5 w-5" />
                  </Link>
                </Button>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">RRHH</p>
              </div>
              <div className="min-w-0 text-right">
                <h1 className="text-2xl font-bold tracking-tight text-white">Cuadro de solicitados</h1>
                <p className="mt-1 text-sm text-zinc-400">
                  Proyecto:{' '}
                  <span className="font-semibold text-white">
                    {alcanceNombre?.trim() || 'Todos los proyectos'}
                  </span>
                </p>
              </div>
            </div>
          </header>
          <div
            id="cuadro-solicitados"
            className="scroll-mt-24 rounded-2xl border border-white/5 bg-zinc-900/20 backdrop-blur-xl p-6 shadow-2xl shadow-black/40"
          >
            {pendientesInner}
          </div>
        </>
      ) : (
        <Tabs
          value={tab}
          onValueChange={(v) => {
            replaceGestionUrl({ tab: v });
          }}
          className="w-full"
        >
          <TabsList className="grid w-full max-w-2xl grid-cols-2 bg-zinc-900/50 p-1 rounded-xl border border-white/5 mb-6">
            <TabsTrigger value="pendientes" className="rounded-lg data-[state=active]:bg-sky-600 data-[state=active]:text-white">Solicitudes pendientes</TabsTrigger>
            <TabsTrigger value="obra" className="rounded-lg data-[state=active]:bg-sky-600 data-[state=active]:text-white">Personal en obra</TabsTrigger>
          </TabsList>

          <TabsContent value="pendientes" className="rounded-2xl border border-white/5 bg-zinc-900/20 backdrop-blur-xl p-6 shadow-2xl shadow-black/40">
            {pendientesInner}
          </TabsContent>

          <TabsContent value="obra" className="rounded-2xl border border-white/5 bg-zinc-900/20 backdrop-blur-xl p-6 shadow-2xl shadow-black/40">
          {loadingObra ? (
            <p className="text-sm text-zinc-500">Cargando…</p>
          ) : asignacionesPorProyecto.length === 0 ? (
            <p className="text-sm text-zinc-500">No hay asignaciones registradas.</p>
          ) : (
            <div className="space-y-8">
              {asignacionesPorProyecto.map(([pid, rows]) => (
                <div key={pid}>
                  <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-zinc-400">
                    {nombreProyecto.get(pid) ?? pid}
                  </h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Obrero</TableHead>
                        <TableHead>Bono (USD)</TableHead>
                        <TableHead>Solicitud</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((a) => (
                        <TableRow key={a.id}>
                          <TableCell className="text-zinc-400">{new Date(a.created_at).toLocaleString('es-VE')}</TableCell>
                          <TableCell className="font-medium text-white">
                            {nombreEmpleado.get(a.worker_id) ?? a.worker_id.slice(0, 8)}
                          </TableCell>
                          <TableCell>
                            <BonoUsdEditor
                              assignmentId={a.id}
                              value={a.bono_usd}
                              readOnly={obrerosConContrato.has(a.worker_id)}
                              onSaved={(bono) => actualizarBonoLocal(a.id, a.labor_request_id, bono)}
                            />
                          </TableCell>
                          <TableCell className="font-mono text-xs text-zinc-500">{a.labor_request_id.slice(0, 8)}…</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
      )}

      <Dialog open={!!dialogReq} onOpenChange={(o) => !o && setDialogReq(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Asignar obreros</DialogTitle>
            <DialogDescription>
              {dialogReq ? (
                <>
                  Especialidad <strong className="text-zinc-200">{dialogReq.specialty_codigo}</strong> · Solicitados:{' '}
                  {dialogReq.quantity_requested} · Ya asignados: {yaAsignados} · Cupo:{' '}
                  <strong className="text-zinc-200">{cupoRestante}</strong>
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          {dialogReq && (asignadosPorSolicitud.get(dialogReq.id) ?? []).length > 0 ? (
            <div className="mb-4 rounded-lg border border-amber-500/25 bg-amber-950/25 px-3 py-2">
              <p className="text-[10px] font-bold uppercase tracking-wide text-amber-300/90">Ya asignados</p>
              <ul className="mt-2 space-y-2">
                {(asignadosPorSolicitud.get(dialogReq.id) ?? []).map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="text-zinc-200">
                      {nombreEmpleado.get(a.worker_id) ?? a.worker_id.slice(0, 8)}
                    </span>
                    <BonoUsdEditor
                      assignmentId={a.id}
                      value={a.bono_usd}
                      compact
                      readOnly={obrerosConContrato.has(a.worker_id)}
                      onSaved={(bono) => actualizarBonoLocal(a.id, dialogReq.id, bono)}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {loadingDialog ? (
            <p className="text-sm text-zinc-500">Cargando candidatos…</p>
          ) : candidatos.length === 0 ? (
            <p className="text-sm text-zinc-500">No hay obreros disponibles con esa especialidad.</p>
          ) : (
            <ul className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
              {candidatos.map((w) => (
                <li
                  key={w.id}
                  className={`rounded-lg border px-3 py-2 ${
                    sel.has(w.id)
                      ? 'border-sky-500/40 bg-sky-950/30'
                      : 'border-zinc-800 bg-zinc-900/60'
                  }`}
                >
                  <div
                    className="flex cursor-pointer items-center gap-3 hover:opacity-90"
                    onClick={() => toggleSel(w.id)}
                  >
                    <input
                      type="checkbox"
                      readOnly
                      checked={sel.has(w.id)}
                      className="h-4 w-4 rounded border-zinc-600"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-white">{w.nombre_completo}</p>
                      <p className="truncate text-xs text-zinc-500">
                        {(w.cargo_codigo ?? '').trim()} · {(w.cargo_nombre ?? '').trim()}
                      </p>
                    </div>
                  </div>
                  {sel.has(w.id) ? (
                    <div
                      className="mt-2 flex items-center justify-end gap-2 border-t border-white/5 pt-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span className="text-[10px] font-semibold uppercase text-amber-400/90">Bono USD</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={bonoPorObrero[w.id] ?? '0'}
                        onChange={(e) =>
                          setBonoPorObrero((b) => ({ ...b, [w.id]: e.target.value }))
                        }
                        className="w-24 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1 text-right text-sm font-semibold tabular-nums text-amber-200 focus:border-amber-500/50 focus:outline-none"
                        aria-label={`Bono USD para ${w.nombre_completo}`}
                      />
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" className="border-zinc-600" onClick={() => setDialogReq(null)}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="elitePrimary"
              disabled={submitting || sel.size === 0 || cupoRestante === 0}
              onClick={() => void confirmarAsignacion()}
            >
              {submitting ? 'Guardando…' : `Confirmar (${sel.size})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
