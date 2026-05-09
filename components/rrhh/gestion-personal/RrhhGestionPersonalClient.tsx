'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { CARGOS_OBREROS } from '@/lib/constants/cargosObreros';
import { coincideEspecialidad, esObreroDisponible } from '@/lib/rrhh/laborPersonnel';
import { createClient } from '@/lib/supabase/client';

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

const TABS = ['pendientes', 'obra', 'maestro'] as const;
type GestionPersonalTab = (typeof TABS)[number];

function tabFromSearchParams(searchParams: ReturnType<typeof useSearchParams>): GestionPersonalTab {
  const t = searchParams.get('tab');
  if (t === 'obra' || t === 'maestro' || t === 'pendientes') return t;
  return 'pendientes';
}

export default function RrhhGestionPersonalClient() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = useMemo(() => tabFromSearchParams(searchParams), [searchParams]);
  const [tick, setTick] = useState(0);

  const [pending, setPending] = useState<LaborRequestRow[]>([]);
  const [loadingPending, setLoadingPending] = useState(true);

  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [nombreProyecto, setNombreProyecto] = useState<Map<string, string>>(new Map());
  const [nombreEmpleado, setNombreEmpleado] = useState<Map<string, string>>(new Map());
  const [loadingObra, setLoadingObra] = useState(true);

  const [empleados, setEmpleados] = useState<EmpleadoRow[]>([]);
  const [loadingMaestro, setLoadingMaestro] = useState(true);

  const [dialogReq, setDialogReq] = useState<LaborRequestRow | null>(null);
  const [candidatos, setCandidatos] = useState<EmpleadoRow[]>([]);
  const [yaAsignados, setYaAsignados] = useState(0);
  const [loadingDialog, setLoadingDialog] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  const [editEmp, setEditEmp] = useState<EmpleadoRow | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [formNombre, setFormNombre] = useState('');
  const [formDoc, setFormDoc] = useState('');
  const [formTel, setFormTel] = useState('');
  const [formCargo, setFormCargo] = useState('');
  const [formEstado, setFormEstado] = useState('aprobado');
  const [formEstatus, setFormEstatus] = useState('disponible');
  const [savingEmp, setSavingEmp] = useState(false);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoadingPending(true);
      const { data, error } = await supabase
        .from('labor_requests')
        .select('id,project_id,specialty_codigo,specialty_nombre,quantity_requested,status,notes,created_at')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
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
      }
      setLoadingPending(false);
    })();
    return () => {
      alive = false;
    };
  }, [supabase, tick]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoadingObra(true);
      const { data: asg, error: e1 } = await supabase
        .from('project_assignments')
        .select('id,labor_request_id,worker_id,project_id,created_at')
        .order('created_at', { ascending: false })
        .limit(800);
      if (!alive) return;
      if (e1) {
        setAssignments([]);
        setLoadingObra(false);
        return;
      }
      const rows = (asg ?? []) as AssignmentRow[];
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
  }, [supabase, tick]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoadingMaestro(true);
      const cols =
        'id,nombre_completo,email,documento,telefono,cargo_codigo,cargo_nombre,estado,estatus,rol_examen,created_at';
      const { data, error } = await supabase.from('ci_empleados').select(cols).order('created_at', { ascending: false }).limit(400);
      if (!alive) return;
      if (error) {
        setEmpleados([]);
      } else {
        setEmpleados((data ?? []) as EmpleadoRow[]);
      }
      setLoadingMaestro(false);
    })();
    return () => {
      alive = false;
    };
  }, [supabase, tick]);

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
      if (next.has(id)) next.delete(id);
      else {
        if (next.size >= cupoRestante) {
          toast.message('Cupo completo', { description: `Solo puedes asignar ${cupoRestante} obrero(s) más.` });
          return prev;
        }
        next.add(id);
      }
      return next;
    });
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
        const { error: ins } = await supabase.from('project_assignments').insert({
          labor_request_id: req.id,
          worker_id: wid,
          project_id: req.project_id,
        });
        if (ins) throw new Error(ins.message);
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

  async function guardarEmpleado() {
    if (!formNombre.trim()) {
      toast.error('El nombre es obligatorio.');
      return;
    }
    setSavingEmp(true);
    try {
      if (editEmp) {
        const { error } = await supabase
          .from('ci_empleados')
          .update({
            nombre_completo: formNombre.trim(),
            documento: formDoc.trim() || null,
            telefono: formTel.trim() || null,
            cargo_codigo: formCargo.trim() || null,
            cargo_nombre: (CARGOS_OBREROS.find((c) => c.codigo === formCargo.trim())?.nombre ?? null) as string | null,
            estado: formEstado,
            estatus: formEstatus,
          })
          .eq('id', editEmp.id);
        if (error) throw new Error(error.message);
        toast.success('Obrero actualizado.');
        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('ci-resumen-obreros-refresh'));
        setEditEmp(null);
      } else {
        const { error } = await supabase.from('ci_empleados').insert({
          nombre_completo: formNombre.trim(),
          documento: formDoc.trim() || null,
          telefono: formTel.trim() || null,
          cargo_codigo: formCargo.trim() || null,
          cargo_nombre: (CARGOS_OBREROS.find((c) => c.codigo === formCargo.trim())?.nombre ?? null) as string | null,
          rol_examen: 'obrero',
          estado: formEstado,
          estatus: formEstatus,
          estado_proceso: 'cv_completado',
          respuestas_personalidad: [],
          respuestas_logica: [],
        });
        if (error) throw new Error(error.message);
        toast.success('Obrero creado.');
        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('ci-resumen-obreros-refresh'));
        setCreateOpen(false);
      }
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar.');
    } finally {
      setSavingEmp(false);
    }
  }

  async function eliminarEmpleado(id: string) {
    if (!window.confirm('¿Eliminar este registro de ci_empleados? No se puede deshacer.')) return;
    const { error } = await supabase.from('ci_empleados').delete().eq('id', id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Eliminado.');
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('ci-resumen-obreros-refresh'));
    refresh();
  }

  function openEdit(e: EmpleadoRow) {
    setEditEmp(e);
    setFormNombre(e.nombre_completo ?? '');
    setFormDoc((e.documento ?? '').trim());
    setFormTel((e.telefono ?? '').trim());
    setFormCargo((e.cargo_codigo ?? '').trim());
    setFormEstado((e.estado ?? 'aprobado').trim());
    setFormEstatus((e.estatus ?? 'disponible').trim() || 'disponible');
    setCreateOpen(true);
  }

  function openCreate() {
    setEditEmp(null);
    setFormNombre('');
    setFormDoc('');
    setFormTel('');
    setFormCargo('');
    setFormEstado('aprobado');
    setFormEstatus('disponible');
    setCreateOpen(true);
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 text-white">
      <Tabs
        value={tab}
        onValueChange={(v) => {
          router.replace(`/rrhh/gestion-personal?tab=${encodeURIComponent(v)}`, { scroll: false });
        }}
        className="w-full"
      >
        <TabsList className="grid w-full max-w-2xl grid-cols-3">
          <TabsTrigger value="pendientes">Solicitudes pendientes</TabsTrigger>
          <TabsTrigger value="obra">Personal en obra</TabsTrigger>
          <TabsTrigger value="maestro">Maestro obreros</TabsTrigger>
        </TabsList>

        <TabsContent value="pendientes" className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-4">
          {loadingPending ? (
            <p className="text-sm text-zinc-500">Cargando…</p>
          ) : pending.length === 0 ? (
            <p className="text-sm text-zinc-500">No hay solicitudes en estado pending.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Especialidad</TableHead>
                  <TableHead>Cantidad</TableHead>
                  <TableHead>Proyecto</TableHead>
                  <TableHead className="text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pending.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-zinc-300">{new Date(r.created_at).toLocaleString('es-VE')}</TableCell>
                    <TableCell>
                      <span className="font-medium text-white">{r.specialty_codigo}</span>
                      <span className="ml-2 text-xs text-zinc-500">{r.specialty_nombre ?? ''}</span>
                    </TableCell>
                    <TableCell className="tabular-nums">{r.quantity_requested}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-zinc-400" title={r.project_id}>
                      {nombreProyecto.get(r.project_id) ?? r.project_id.slice(0, 8)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button type="button" size="sm" variant="elitePrimary" onClick={() => void abrirAsignacion(r)}>
                        Asignar obreros
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>

        <TabsContent value="obra" className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-4">
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

        <TabsContent value="maestro" className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-4">
          <div className="mb-4 flex justify-end">
            <Button type="button" variant="elitePrimary" onClick={openCreate}>
              Nuevo obrero
            </Button>
          </div>
          {loadingMaestro ? (
            <p className="text-sm text-zinc-500">Cargando…</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Documento</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Estatus</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {empleados.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium text-white">{e.nombre_completo}</TableCell>
                    <TableCell className="text-zinc-400">{(e.documento ?? '—').trim() || '—'}</TableCell>
                    <TableCell className="text-zinc-300">
                      {(e.cargo_codigo ?? '').trim() || '—'} {(e.cargo_nombre ?? '').trim()}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="border-zinc-600 text-zinc-300">
                        {e.estado ?? '—'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-zinc-400">{e.estatus ?? '—'}</TableCell>
                    <TableCell className="text-right">
                      <Button type="button" size="sm" variant="ghost" className="text-sky-400" onClick={() => openEdit(e)}>
                        Editar
                      </Button>{' '}
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-red-400"
                        onClick={() => void eliminarEmpleado(e.id)}
                      >
                        Eliminar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>
      </Tabs>

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
          {loadingDialog ? (
            <p className="text-sm text-zinc-500">Cargando candidatos…</p>
          ) : candidatos.length === 0 ? (
            <p className="text-sm text-zinc-500">No hay obreros disponibles con esa especialidad.</p>
          ) : (
            <ul className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
              {candidatos.map((w) => (
                <li
                  key={w.id}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 hover:bg-zinc-800/80"
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

      <Dialog
        open={createOpen}
        onOpenChange={(o) => {
          if (!o) {
            setCreateOpen(false);
            setEditEmp(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editEmp ? 'Editar obrero' : 'Nuevo obrero'}</DialogTitle>
            <DialogDescription>Registro en ci_empleados (rol obrero).</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div>
              <Label>Nombre completo</Label>
              <Input value={formNombre} onChange={(e) => setFormNombre(e.target.value)} className="mt-1 border-zinc-600 bg-zinc-900 text-white" />
            </div>
            <div>
              <Label>Documento / cédula</Label>
              <Input value={formDoc} onChange={(e) => setFormDoc(e.target.value)} className="mt-1 border-zinc-600 bg-zinc-900 text-white" />
            </div>
            <div>
              <Label>Teléfono</Label>
              <Input value={formTel} onChange={(e) => setFormTel(e.target.value)} className="mt-1 border-zinc-600 bg-zinc-900 text-white" />
            </div>
            <div>
              <Label>Especialidad (código GOE)</Label>
              <select
                value={formCargo}
                onChange={(e) => setFormCargo(e.target.value)}
                style={{ colorScheme: 'dark' }}
                className="mt-1 w-full rounded-md border border-zinc-600 bg-zinc-900 px-3 py-2 text-sm text-white"
              >
                <option value="">—</option>
                {CARGOS_OBREROS.map((c) => (
                  <option key={c.codigo} value={c.codigo} className="bg-zinc-900">
                    {c.codigo} — {c.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Estado</Label>
                <select
                  value={formEstado}
                  onChange={(e) => setFormEstado(e.target.value)}
                  style={{ colorScheme: 'dark' }}
                  className="mt-1 w-full rounded-md border border-zinc-600 bg-zinc-900 px-2 py-2 text-sm text-white"
                >
                  <option value="aprobado">aprobado</option>
                  <option value="evaluacion_pendiente">evaluacion_pendiente</option>
                  <option value="rechazado">rechazado</option>
                </select>
              </div>
              <div>
                <Label>Estatus cuadrilla</Label>
                <select
                  value={formEstatus}
                  onChange={(e) => setFormEstatus(e.target.value)}
                  style={{ colorScheme: 'dark' }}
                  className="mt-1 w-full rounded-md border border-zinc-600 bg-zinc-900 px-2 py-2 text-sm text-white"
                >
                  <option value="disponible">disponible</option>
                  <option value="asignado">asignado</option>
                  <option value="no_disponible">no_disponible</option>
                </select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" className="border-zinc-600" onClick={() => (setCreateOpen(false), setEditEmp(null))}>
              Cerrar
            </Button>
            <Button type="button" variant="elitePrimary" disabled={savingEmp} onClick={() => void guardarEmpleado()}>
              {savingEmp ? 'Guardando…' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
