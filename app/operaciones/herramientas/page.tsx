'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Wrench } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { esObraDemo } from '@/lib/proyectos/costoObra/reglasCostoObra';
import {
  estadoHerramientaObra,
  etiquetaEstadoHerramienta,
  parseCostoDiario,
  payloadAsignarHerramienta,
  payloadDevolverHerramienta,
} from '@/lib/proyectos/herramientas/asignarHerramienta';
import {
  PROYECTO_EQUIPO_SELECT,
  isMaquinariaColumnMissing,
  mapProyectoEquipoRow,
  type ProyectoEquipoRow,
} from '@/lib/proyectos/proyectoEquipos';

type ObraOpt = { id: string; nombre: string };

const SELECT_HERR = `${PROYECTO_EQUIPO_SELECT},entidad_id`;

export default function HerramientasView() {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<ProyectoEquipoRow[]>([]);
  const [obras, setObras] = useState<ObraOpt[]>([]);
  const [obraNombre, setObraNombre] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [asignarId, setAsignarId] = useState<string | null>(null);
  const [obraDestino, setObraDestino] = useState('');
  const [costoDiarioDraft, setCostoDiarioDraft] = useState('');
  const [nueva, setNueva] = useState('');
  const [nuevoCosto, setNuevoCosto] = useState('');
  const [savingNueva, setSavingNueva] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    let q = supabase
      .from('ci_proyecto_equipos')
      .select(SELECT_HERR)
      .in('categoria', ['herramienta', 'equipo'])
      .order('nombre_equipo', { ascending: true });
    const { data, error: qErr } = await q;
    if (qErr && isMaquinariaColumnMissing(qErr.message)) {
      const retry = await supabase
        .from('ci_proyecto_equipos')
        .select('id,proyecto_id,categoria,nombre_equipo,marca,modelo,serial,cantidad,notas,created_at')
        .in('categoria', ['herramienta', 'equipo'])
        .order('nombre_equipo', { ascending: true });
      if (retry.error) {
        setError(
          /costo_diario|fecha_devolucion|schema cache/i.test(retry.error.message)
            ? 'Aplique la migración 389_ci_costo_obra.sql en Supabase para asignar herramientas con costo por día.'
            : retry.error.message,
        );
        setRows([]);
      } else {
        setRows((retry.data ?? []).map((r) => mapProyectoEquipoRow(r as Record<string, unknown>)));
      }
    } else if (qErr) {
      setError(
        /costo_diario|fecha_devolucion|schema cache/i.test(qErr.message)
          ? 'Aplique la migración 389_ci_costo_obra.sql en Supabase para asignar herramientas con costo por día.'
          : qErr.message,
      );
      setRows([]);
    } else {
      setRows((data ?? []).map((r) => mapProyectoEquipoRow(r as Record<string, unknown>)));
    }

    const { data: proy } = await supabase
      .from('ci_proyectos')
      .select('id,nombre')
      .order('nombre', { ascending: true })
      .limit(300);
    const obrasOk = ((proy ?? []) as ObraOpt[]).filter((p) => !esObraDemo(p.nombre));
    setObras(obrasOk);
    const map: Record<string, string> = {};
    for (const p of obrasOk) map[p.id] = p.nombre;
    setObraNombre(map);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  async function asignar(id: string) {
    setBusyId(id);
    try {
      const costo = parseCostoDiario(costoDiarioDraft);
      const payload = payloadAsignarHerramienta({
        proyectoId: obraDestino,
        costoDiario: costo,
      });
      const { error: upErr } = await supabase.from('ci_proyecto_equipos').update(payload).eq('id', id);
      if (upErr) throw new Error(upErr.message);
      toast.success('Herramienta asignada a la obra');
      setAsignarId(null);
      setObraDestino('');
      setCostoDiarioDraft('');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo asignar');
    } finally {
      setBusyId(null);
    }
  }

  async function devolver(id: string) {
    setBusyId(id);
    try {
      const { error: upErr } = await supabase
        .from('ci_proyecto_equipos')
        .update(payloadDevolverHerramienta())
        .eq('id', id);
      if (upErr) throw new Error(upErr.message);
      toast.success('Herramienta devuelta');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo devolver');
    } finally {
      setBusyId(null);
    }
  }

  async function crearNueva(e: React.FormEvent) {
    e.preventDefault();
    const nombre = nueva.trim();
    if (!nombre) return;
    setSavingNueva(true);
    try {
      const payload: Record<string, unknown> = {
        categoria: 'herramienta',
        nombre_equipo: nombre,
        cantidad: 1,
        proyecto_id: null,
        costo_diario: parseCostoDiario(nuevoCosto),
      };
      const { error: insErr } = await supabase.from('ci_proyecto_equipos').insert(payload);
      if (insErr) throw new Error(insErr.message);
      toast.success('Herramienta registrada');
      setNueva('');
      setNuevoCosto('');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo registrar');
    } finally {
      setSavingNueva(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold dark:text-white">Herramientas</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Asigna una herramienta a una obra o devuélvela. El costo por día entra en el costo de esa obra.
        </p>
      </div>

      <form
        onSubmit={(e) => void crearNueva(e)}
        className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950 sm:grid-cols-[1fr_8rem_auto]"
      >
        <input
          value={nueva}
          onChange={(e) => setNueva(e.target.value)}
          placeholder="Nombre (ej. Taladro Bosch)"
          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
        />
        <input
          value={nuevoCosto}
          onChange={(e) => setNuevoCosto(e.target.value)}
          placeholder="USD / día"
          inputMode="decimal"
          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
        />
        <button
          type="submit"
          disabled={savingNueva || !nueva.trim()}
          className="min-h-11 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {savingNueva ? 'Guardando…' : 'Registrar'}
        </button>
      </form>

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </p>
      ) : null}
      {loading ? <p className="text-sm text-slate-500">Cargando herramientas…</p> : null}
      {!loading && rows.length === 0 && !error ? (
        <p className="text-sm text-slate-500">No hay herramientas. Registra la primera arriba.</p>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {rows.map((h) => {
          const estado = estadoHerramientaObra({
            proyecto_id: h.proyecto_id,
            fecha_devolucion: h.fecha_devolucion,
          });
          const enObra = estado === 'en_obra';
          const obraLabel = h.proyecto_id ? obraNombre[h.proyecto_id] ?? 'Obra' : null;
          return (
            <div
              key={h.id}
              className="flex h-full flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950"
            >
              <div>
                <div className="mb-3 flex items-start justify-between">
                  <div className="rounded-lg bg-blue-50 p-2 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
                    <Wrench className="h-5 w-5" />
                  </div>
                  <span
                    className={`rounded-full border px-2.5 py-1 text-xs font-bold ${
                      enObra
                        ? 'border-amber-200 bg-amber-50 text-amber-600 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400'
                        : 'border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400'
                    }`}
                  >
                    {etiquetaEstadoHerramienta(estado)}
                  </span>
                </div>
                <h3 className="mb-1 text-lg font-semibold leading-tight dark:text-white">{h.nombre_equipo}</h3>
                <div className="mt-2 space-y-1 text-sm text-slate-500 dark:text-slate-400">
                  {enObra && obraLabel ? <p>Obra: {obraLabel}</p> : null}
                  {!enObra && h.proyecto_id && h.fecha_devolucion ? (
                    <p>
                      Última obra: {obraLabel} · devuelta {h.fecha_devolucion.slice(0, 10)}
                    </p>
                  ) : null}
                  {h.costo_diario != null ? <p>Costo: ${h.costo_diario}/día</p> : null}
                  {h.serial ? <p>Serial: {h.serial}</p> : null}
                </div>
              </div>

              {asignarId === h.id ? (
                <div className="mt-4 space-y-2">
                  <select
                    value={obraDestino}
                    onChange={(e) => setObraDestino(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  >
                    <option value="">Elige la obra…</option>
                    {obras.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.nombre}
                      </option>
                    ))}
                  </select>
                  <input
                    value={costoDiarioDraft}
                    onChange={(e) => setCostoDiarioDraft(e.target.value)}
                    placeholder="Costo USD por día (opcional)"
                    inputMode="decimal"
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={busyId === h.id || !obraDestino}
                      onClick={() => void asignar(h.id)}
                      className="min-h-11 flex-1 rounded-lg bg-blue-600 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      {busyId === h.id ? '…' : 'Confirmar'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setAsignarId(null)}
                      className="min-h-11 rounded-lg border border-slate-200 px-3 text-sm dark:border-slate-700"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={busyId === h.id}
                  onClick={() => {
                    if (enObra) void devolver(h.id);
                    else {
                      setAsignarId(h.id);
                      setCostoDiarioDraft(h.costo_diario != null ? String(h.costo_diario) : '');
                    }
                  }}
                  className="mt-6 min-h-11 w-full rounded-lg border border-slate-200 bg-slate-50 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  {enObra ? 'Devolver' : 'Asignar a obra'}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
