'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { Briefcase, ChevronRight, Link2, Loader2, Sparkles, User } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import CandidateSheetDocuments from '@/components/reclutamiento/CandidateSheetDocuments';
import {
  canAssignToObra,
  type PersonCandidateDocumentRow,
} from '@/lib/reclutamiento/personCandidateDocuments';

type LaborRequestActive = {
  id: string;
  project_id: string;
  specialty_codigo: string;
  specialty_nombre: string | null;
  quantity_requested: number;
  status: string;
  proyecto_nombre: string | null;
};

export type PersonPipelineRow = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  is_candidate: boolean;
  pipeline_stage: 'postulado' | 'entrevistado' | 'aprobado';
  cv_data: Record<string, unknown> | null;
  specialty_codigo: string | null;
  specialty_nombre: string | null;
  salary_expectation: number | null;
};

const STAGES: { key: PersonPipelineRow['pipeline_stage']; label: string; hint: string }[] = [
  { key: 'postulado', label: 'Postulados', hint: 'Nuevos ingresos' },
  { key: 'entrevistado', label: 'Entrevistados', hint: 'Primer filtro superado' },
  { key: 'aprobado', label: 'Aprobados', hint: 'Listos para obra' },
];

function sortRequestsBySpecialtyMatch(requests: LaborRequestActive[], codigo: string | null): LaborRequestActive[] {
  if (!codigo?.trim()) return requests;
  const c = codigo.trim().toLowerCase();
  return [...requests].sort((a, b) => {
    const am = a.specialty_codigo?.toLowerCase() === c ? 0 : 1;
    const bm = b.specialty_codigo?.toLowerCase() === c ? 0 : 1;
    return am - bm;
  });
}

export default function ReclutamientoPipelineClient() {
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [schemaError, setSchemaError] = useState<string | null>(null);
  const [requests, setRequests] = useState<LaborRequestActive[]>([]);
  const [assignCounts, setAssignCounts] = useState<Record<string, number>>({});
  const [persons, setPersons] = useState<PersonPipelineRow[]>([]);
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [openMenuPersonId, setOpenMenuPersonId] = useState<string | null>(null);
  const [sheetPerson, setSheetPerson] = useState<PersonPipelineRow | null>(null);
  const [docsByPerson, setDocsByPerson] = useState<Record<string, PersonCandidateDocumentRow[]>>({});
  const openSheetPersonIdRef = useRef<string | null>(null);
  openSheetPersonIdRef.current = sheetPerson?.id ?? null;

  const reloadPersonDocs = useCallback(
    async (personId: string) => {
      const { data, error } = await supabase
        .from('person_candidate_documents')
        .select(
          'id, person_id, storage_bucket, storage_path, document_kind, mime_type, original_filename, validated_at, expiry_date, created_at, updated_at',
        )
        .eq('person_id', personId)
        .order('created_at', { ascending: false });
      if (error) return;
      setDocsByPerson((prev) => ({
        ...prev,
        [personId]: (data ?? []) as PersonCandidateDocumentRow[],
      }));
    },
    [supabase],
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    setSchemaError(null);
    try {
      const { data: lrRows, error: lrErr } = await supabase
        .from('labor_requests')
        .select('id, project_id, specialty_codigo, specialty_nombre, quantity_requested, status')
        .in('status', ['pending', 'in_progress'])
        .order('created_at', { ascending: false })
        .limit(48);

      if (lrErr) {
        const m = lrErr.message ?? '';
        if (/labor_requests|does not exist|schema cache/i.test(m)) {
          setSchemaError(
            'No existe el esquema de solicitudes laborales. Aplica en Supabase: supabase/migrations/104_labor_requests_project_assignments.sql',
          );
        } else {
          setSchemaError(m);
        }
        setRequests([]);
        setPersons([]);
        setAssignCounts({});
        setDocsByPerson({});
        return;
      }

      const lr = (lrRows ?? []) as Omit<LaborRequestActive, 'proyecto_nombre'>[];
      const pids = Array.from(new Set(lr.map((r) => r.project_id)));
      let nombrePorId: Record<string, string> = {};
      if (pids.length > 0) {
        const { data: prows } = await supabase.from('ci_proyectos').select('id,nombre').in('id', pids);
        for (const p of (prows ?? []) as { id: string; nombre: string | null }[]) {
          nombrePorId[p.id] = (p.nombre ?? '').trim() || p.id.slice(0, 8);
        }
      }

      const enriched: LaborRequestActive[] = lr.map((r) => ({
        ...r,
        proyecto_nombre: nombrePorId[r.project_id] ?? null,
      }));
      setRequests(enriched);

      const ids = enriched.map((r) => r.id);
      const counts: Record<string, number> = {};
      if (ids.length > 0) {
        const { data: paRows, error: paErr } = await supabase
          .from('project_assignments')
          .select('labor_request_id')
          .in('labor_request_id', ids)
          .is('end_date', null);
        if (!paErr && paRows) {
          for (const row of paRows as { labor_request_id: string }[]) {
            const k = row.labor_request_id;
            counts[k] = (counts[k] ?? 0) + 1;
          }
        }
      }
      setAssignCounts(counts);

      const { data: perRows, error: pErr } = await supabase
        .from('persons')
        .select(
          'id, full_name, email, phone, is_candidate, pipeline_stage, cv_data, specialty_codigo, specialty_nombre, salary_expectation',
        )
        .eq('is_candidate', true)
        .order('updated_at', { ascending: false })
        .limit(200);

      if (pErr) {
        setPersons([]);
        setDocsByPerson({});
        setSchemaError(
          'No se pudo leer candidatos (tabla persons). Aplica en Supabase: supabase/migrations/108_reclutamiento_persons_pipeline.sql',
        );
        return;
      }

      const personsList = (perRows ?? []) as PersonPipelineRow[];
      setPersons(personsList);

      const personIds = personsList.map((p) => p.id);
      if (personIds.length === 0) {
        setDocsByPerson({});
      } else {
        const { data: docRows, error: docErr } = await supabase
          .from('person_candidate_documents')
          .select(
            'id, person_id, storage_bucket, storage_path, document_kind, mime_type, original_filename, validated_at, expiry_date, created_at, updated_at',
          )
          .in('person_id', personIds)
          .order('created_at', { ascending: false });
        if (docErr) {
          setDocsByPerson({});
        } else {
          const map: Record<string, PersonCandidateDocumentRow[]> = {};
          for (const row of (docRows ?? []) as PersonCandidateDocumentRow[]) {
            const pid = row.person_id;
            if (!map[pid]) map[pid] = [];
            map[pid].push(row);
          }
          for (const pid of personIds) {
            if (!map[pid]) map[pid] = [];
          }
          for (const pid of Object.keys(map)) {
            map[pid].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          }
          setDocsByPerson(map);
        }
      }

      const sid = openSheetPersonIdRef.current;
      if (sid) {
        const { data: oneRows, error: oneErr } = await supabase
          .from('person_candidate_documents')
          .select(
            'id, person_id, storage_bucket, storage_path, document_kind, mime_type, original_filename, validated_at, expiry_date, created_at, updated_at',
          )
          .eq('person_id', sid)
          .order('created_at', { ascending: false });
        if (!oneErr && oneRows) {
          setDocsByPerson((prev) => ({
            ...prev,
            [sid]: (oneRows ?? []) as PersonCandidateDocumentRow[],
          }));
        }
      }
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const id = sheetPerson?.id;
    if (!id) return;
    void reloadPersonDocs(id);
  }, [sheetPerson?.id, reloadPersonDocs]);

  useEffect(() => {
    if (!openMenuPersonId) return;
    const onDoc = (e: MouseEvent) => {
      const el = document.getElementById('recruitment-link-dropdown');
      if (el && !el.contains(e.target as Node)) setOpenMenuPersonId(null);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [openMenuPersonId]);

  const personsByStage = useMemo(() => {
    const m: Record<string, PersonPipelineRow[]> = { postulado: [], entrevistado: [], aprobado: [] };
    for (const p of persons) {
      const s = p.pipeline_stage;
      if (m[s]) m[s].push(p);
    }
    return m;
  }, [persons]);

  async function advanceStage(person: PersonPipelineRow, next: PersonPipelineRow['pipeline_stage']) {
    try {
      const { error } = await supabase
        .from('persons')
        .update({ pipeline_stage: next, updated_at: new Date().toISOString() })
        .eq('id', person.id);
      if (error) throw new Error(error.message);
      toast.success('Etapa actualizada');
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo actualizar');
    }
  }

  async function vincularASolicitud(person: PersonPipelineRow, req: LaborRequestActive) {
    if (!canAssignToObra(docsByPerson[person.id] ?? [])) {
      toast.error(
        'No se puede asignar: valida cédula y curso con vigencia, y asegúrate de que el curso no venza en menos de 7 días (ni esté vencido).',
      );
      return;
    }
    setLinkingId(person.id);
    setOpenMenuPersonId(null);
    try {
      const { error: ins } = await supabase.from('project_assignments').insert({
        labor_request_id: req.id,
        project_id: req.project_id,
        worker_id: null,
        person_id: person.id,
      });
      if (ins) throw new Error(ins.message);

      const { error: up } = await supabase
        .from('persons')
        .update({ is_candidate: false, updated_at: new Date().toISOString() })
        .eq('id', person.id);
      if (up) throw new Error(up.message);

      const assigned = (assignCounts[req.id] ?? 0) + 1;
      if (assigned >= req.quantity_requested) {
        await supabase
          .from('labor_requests')
          .update({ status: 'fulfilled', updated_at: new Date().toISOString() })
          .eq('id', req.id);
      }

      toast.success('Candidato vinculado a la solicitud');
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al vincular');
    } finally {
      setLinkingId(null);
    }
  }

  return (
    <div className="min-h-screen text-white" style={{ background: 'var(--bg-primary)' }}>
      <header className="border-b border-white/10 bg-black/40 px-4 py-3 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white">Pipeline de reclutamiento operativo</h1>
            <p className="mt-0.5 text-[11px] text-zinc-500">
              Solicitudes activas y candidatos. Entrevista pública: enlace con{' '}
              <code className="text-zinc-400">?need=</code>, <code className="text-zinc-400">?session=</code> o{' '}
              <code className="text-zinc-400">?empleado_id=</code>.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" className="border-white/15 bg-white/5 text-xs" asChild>
              <Link href="/reclutamiento/requisicion">Requisición</Link>
            </Button>
            <Button type="button" variant="outline" size="sm" className="border-white/15 bg-white/5 text-xs" asChild>
              <Link href="/rrhh/gestion-personal?solo=pendientes">Gestión laboral</Link>
            </Button>
            <Button
              type="button"
              size="sm"
              className="bg-[#007AFF] text-xs font-semibold text-white hover:bg-[#0062CC]"
              onClick={() => void refresh()}
              disabled={loading}
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Actualizar'}
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-5 px-4 py-5">
        {schemaError ? (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-amber-500/40 bg-amber-950/30 px-4 py-3 text-sm text-amber-100"
          >
            {schemaError}
          </motion.div>
        ) : null}

        <section>
          <div className="mb-2 flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-sky-400" aria-hidden />
            <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-400">Solicitudes activas</h2>
          </div>
          {loading && requests.length === 0 ? (
            <div className="flex items-center gap-2 py-8 text-sm text-zinc-500">
              <Loader2 className="h-5 w-5 animate-spin" /> Cargando solicitudes…
            </div>
          ) : requests.length === 0 ? (
            <p className="rounded-xl border border-white/10 bg-zinc-950/60 py-6 text-center text-sm text-zinc-500">
              No hay solicitudes en estado pendiente o en proceso.
            </p>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-2 pt-1 [scrollbar-width:thin]">
              <AnimatePresence initial={false}>
                {requests.map((r) => {
                  const done = assignCounts[r.id] ?? 0;
                  const total = Math.max(1, r.quantity_requested);
                  const pct = Math.min(100, Math.round((done / total) * 100));
                  return (
                    <motion.article
                      key={r.id}
                      layout
                      initial={{ opacity: 0, scale: 0.97 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                      className="min-w-[220px] max-w-[260px] shrink-0 rounded-xl border border-white/10 bg-zinc-950/80 p-3 shadow-lg shadow-black/30"
                    >
                      <p className="text-[10px] font-bold uppercase tracking-wide text-sky-400/90">
                        {r.proyecto_nombre ?? 'Proyecto'}
                      </p>
                      <p className="mt-1 line-clamp-2 text-sm font-semibold text-white">
                        {r.specialty_nombre?.trim() || r.specialty_codigo}
                      </p>
                      <p className="mt-0.5 text-[10px] text-zinc-500">
                        Estado: <span className="text-zinc-300">{r.status}</span>
                      </p>
                      <div className="mt-2">
                        <div className="mb-1 flex justify-between text-[10px] text-zinc-500">
                          <span>Cobertura</span>
                          <span>
                            {done}/{total}
                          </span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
                          <motion.div
                            className="h-full rounded-full bg-gradient-to-r from-sky-500 to-emerald-400"
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.35 }}
                          />
                        </div>
                      </div>
                    </motion.article>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </section>

        <section>
          <div className="mb-2 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-emerald-400" aria-hidden />
            <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-400">Candidatos</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {STAGES.map((col) => (
              <motion.div
                key={col.key}
                layout
                className="rounded-xl border border-white/10 bg-zinc-950/50 p-2"
              >
                <div className="border-b border-white/5 px-2 py-2">
                  <p className="text-xs font-bold text-white">{col.label}</p>
                  <p className="text-[10px] text-zinc-500">{col.hint}</p>
                </div>
                <div className="max-h-[min(62vh,520px)] space-y-2 overflow-y-auto p-2 [scrollbar-width:thin]">
                  {(personsByStage[col.key] ?? []).map((p) => {
                    const sortedReq = sortRequestsBySpecialtyMatch(requests, p.specialty_codigo);
                    const matchHint =
                      p.specialty_codigo &&
                      sortedReq[0]?.specialty_codigo?.toLowerCase() === p.specialty_codigo.toLowerCase();
                    const assignReady = canAssignToObra(docsByPerson[p.id] ?? []);
                    return (
                      <motion.div
                        key={p.id}
                        layout
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="rounded-lg border border-white/10 bg-black/30 p-2.5"
                      >
                        <button
                          type="button"
                          onClick={() => setSheetPerson(p)}
                          className="flex w-full items-start gap-2 text-left"
                        >
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-500/20 text-sky-300">
                            <User className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-white">{p.full_name}</p>
                            {p.specialty_codigo ? (
                              <p className="truncate text-[10px] text-zinc-500">
                                {p.specialty_nombre ?? p.specialty_codigo}
                              </p>
                            ) : null}
                            {matchHint ? (
                              <p className="mt-0.5 flex items-center gap-1 text-[10px] font-medium text-emerald-400/90">
                                <Sparkles className="h-3 w-3" /> Coincide con solicitud activa
                              </p>
                            ) : null}
                          </div>
                          <ChevronRight className="h-4 w-4 shrink-0 text-zinc-600" />
                        </button>

                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {col.key === 'postulado' ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 border-white/15 bg-white/5 px-2 text-[10px]"
                              onClick={() => void advanceStage(p, 'entrevistado')}
                            >
                              Marcar entrevistado
                            </Button>
                          ) : null}
                          {col.key === 'entrevistado' ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 border-emerald-500/30 bg-emerald-950/30 px-2 text-[10px] text-emerald-100"
                              onClick={() => void advanceStage(p, 'aprobado')}
                            >
                              Aprobar
                            </Button>
                          ) : null}
                          {col.key === 'aprobado' ? (
                            <div className="relative w-full">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-7 w-full border-sky-500/40 bg-sky-950/30 px-2 text-[10px] text-sky-100"
                                disabled={linkingId === p.id || requests.length === 0 || !assignReady}
                                title={
                                  !assignReady
                                    ? 'Requisitos: cédula y curso validados; curso con vigencia ≥ 7 días.'
                                    : undefined
                                }
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenMenuPersonId((id) => (id === p.id ? null : p.id));
                                }}
                              >
                                <Link2 className="mr-1 inline h-3 w-3" />
                                Asignar a obra
                              </Button>
                              {openMenuPersonId === p.id ? (
                                <motion.div
                                  id="recruitment-link-dropdown"
                                  initial={{ opacity: 0, y: -4 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  onMouseDown={(e) => e.stopPropagation()}
                                  className="absolute left-0 right-0 top-full z-20 mt-1 max-h-48 overflow-y-auto rounded-lg border border-white/15 bg-zinc-900 py-1 shadow-xl"
                                >
                                  {sortedReq.length === 0 ? (
                                    <p className="px-2 py-2 text-[10px] text-zinc-500">Sin solicitudes activas</p>
                                  ) : (
                                    sortedReq.map((req) => (
                                      <button
                                        key={req.id}
                                        type="button"
                                        className="block w-full px-2 py-1.5 text-left text-[11px] text-zinc-200 hover:bg-white/10"
                                        onClick={() => void vincularASolicitud(p, req)}
                                      >
                                        <span className="font-semibold text-white">
                                          {req.proyecto_nombre ?? req.project_id.slice(0, 8)}
                                        </span>
                                        <span className="block text-zinc-500">
                                          {req.specialty_nombre ?? req.specialty_codigo} ·{' '}
                                          {assignCounts[req.id] ?? 0}/{req.quantity_requested}
                                        </span>
                                      </button>
                                    ))
                                  )}
                                </motion.div>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      </div>

      <Dialog open={!!sheetPerson} onOpenChange={(o) => !o && setSheetPerson(null)}>
        <DialogContent className="fixed left-auto right-0 top-0 h-full max-h-[100dvh] w-full max-w-md translate-x-0 translate-y-0 overflow-y-auto rounded-none border-l border-zinc-700 p-0 data-[state=closed]:zoom-out-100 data-[state=open]:zoom-in-100 sm:max-w-lg sm:rounded-l-xl">
          {sheetPerson ? (
            <div className="p-5 pt-12">
              <DialogHeader>
                <DialogTitle className="pr-8">{sheetPerson.full_name}</DialogTitle>
              </DialogHeader>
              <div className="mt-4 space-y-3 text-sm">
                <div>
                  <p className="text-[10px] font-bold uppercase text-zinc-500">Contacto</p>
                  <p className="text-zinc-300">{sheetPerson.email ?? '—'}</p>
                  <p className="text-zinc-300">{sheetPerson.phone ?? '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-zinc-500">Especialidad</p>
                  <p className="text-zinc-200">
                    {sheetPerson.specialty_nombre ?? sheetPerson.specialty_codigo ?? '—'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-zinc-500">Pretensión salarial</p>
                  <p className="text-zinc-200">
                    {sheetPerson.salary_expectation != null
                      ? `${Number(sheetPerson.salary_expectation).toLocaleString('es-VE', { minimumFractionDigits: 0 })} (referencia)`
                      : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-zinc-500">Hoja de vida (cv_data)</p>
                  <pre className="mt-1 max-h-64 overflow-auto rounded-lg border border-white/10 bg-black/40 p-3 text-[11px] leading-relaxed text-zinc-400">
                    {JSON.stringify(sheetPerson.cv_data ?? {}, null, 2)}
                  </pre>
                </div>

                <CandidateSheetDocuments
                  personId={sheetPerson.id}
                  documents={docsByPerson[sheetPerson.id] ?? []}
                  onDocumentsChange={() => void reloadPersonDocs(sheetPerson.id)}
                />

                {sheetPerson.pipeline_stage === 'aprobado' ? (
                  <p className="text-[10px] text-zinc-500">
                    {canAssignToObra(docsByPerson[sheetPerson.id] ?? [])
                      ? 'Documentación crítica validada y curso con al menos 7 días de vigencia. Puedes usar Asignar a obra en el tablero.'
                      : 'Para asignar a obra: cédula y curso validados, vigencia del curso ≥ 7 días (no vencido ni por vencer de inmediato).'}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
