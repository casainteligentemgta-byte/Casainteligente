'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  HardHat,
  Loader2,
  RefreshCw,
  Users,
  Wallet,
} from 'lucide-react';
import { toast } from 'sonner';
import { DIAS_SEMANA_VE, type JornalesSemanaPayload } from '@/types/jornales';
import {
  etiquetaSemanaVe,
  hoyIsoCaracas,
  lunesDeSemanaJornales,
  sumarDiasIso,
} from '@/lib/proyectos/jornales/semanaJornales';
import { formatApiErrorBody, formatErrorMessage } from '@/lib/utils/formatErrorMessage';
import { parseFetchJson } from '@/lib/utils/parseFetchJson';
import { cn } from '@/lib/utils';

type Props = {
  proyectoId: string;
};

function fmtUsd(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

export default function ControlJornalesObraPanel({ proyectoId }: Props) {
  const [semanaInicio, setSemanaInicio] = useState(() => lunesDeSemanaJornales(hoyIsoCaracas()));
  const [data, setData] = useState<JornalesSemanaPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const load = useCallback(
    async (semana: string) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/proyectos/${encodeURIComponent(proyectoId)}/jornales?semana_inicio=${encodeURIComponent(semana)}`,
          { cache: 'no-store' },
        );
        const json = await parseFetchJson<JornalesSemanaPayload & { error?: string }>(res);
        if (!res.ok) throw new Error(formatApiErrorBody(json, 'No se pudo cargar jornales'));
        setData(json);
        if (json.semana_inicio) setSemanaInicio(json.semana_inicio);
      } catch (e) {
        setError(formatErrorMessage(e));
        setData(null);
      } finally {
        setLoading(false);
      }
    },
    [proyectoId],
  );

  useEffect(() => {
    void load(semanaInicio);
  }, [load, semanaInicio]);

  const post = async (body: Record<string, unknown>, key: string) => {
    setBusyKey(key);
    try {
      const res = await fetch(`/api/proyectos/${encodeURIComponent(proyectoId)}/jornales`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await parseFetchJson<JornalesSemanaPayload & { error?: string; marcados?: number }>(res);
      if (!res.ok) throw new Error(formatApiErrorBody(json, 'No se pudo guardar'));
      setData(json);
      if (json.semana_inicio) setSemanaInicio(json.semana_inicio);
      if (body.accion === 'marcar_hoy') {
        toast.success(
          json.marcados ? `Asistencia de hoy: ${json.marcados} colaborador(es)` : 'Todos ya tenían asistencia hoy',
        );
      }
    } catch (e) {
      toast.error(formatErrorMessage(e));
    } finally {
      setBusyKey(null);
    }
  };

  const kpis = data?.kpis;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-xs text-zinc-500">
          Asistencia semanal de la cuadrilla y costo de jornales en USD. Toque el círculo para marcar el día.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void post({ accion: 'marcar_hoy' }, 'hoy')}
            disabled={busyKey === 'hoy'}
            className="inline-flex select-none items-center gap-1.5 rounded-lg border border-emerald-500/35 bg-emerald-950/40 px-3 py-1.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-900/50 disabled:opacity-60"
          >
            {busyKey === 'hoy' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ClipboardCheck className="h-3.5 w-3.5" />}
            Registrar asistencia diaria
          </button>
          <button
            type="button"
            onClick={() => void load(semanaInicio)}
            className="inline-flex select-none items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-white/[0.08]"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Actualizar
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <KpiCard
          icon={Users}
          label="Total trabajadores activos"
          value={kpis ? String(kpis.trabajadores_activos) : '—'}
          hint="Con al menos un día esta semana"
        />
        <KpiCard
          icon={Wallet}
          label="Costo de mano de obra acumulado"
          value={kpis ? fmtUsd(kpis.costo_mano_obra_acumulado_usd) : '—'}
          hint="Suma de jornales del proyecto"
        />
        <KpiCard
          icon={HardHat}
          label="Promedio por jornal"
          value={kpis ? fmtUsd(kpis.promedio_por_jornal_usd) : '—'}
          hint={`Semana ${kpis ? fmtUsd(kpis.costo_semana_usd) : ''}`}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-zinc-950/50 px-3 py-2">
        <button
          type="button"
          onClick={() => setSemanaInicio((s) => sumarDiasIso(s, -7))}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-zinc-300 hover:bg-white/10"
          aria-label="Semana anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="text-xs font-semibold text-zinc-200">
          {data ? etiquetaSemanaVe(data.semana_inicio, data.semana_fin) : 'Semana'}
        </p>
        <button
          type="button"
          onClick={() => setSemanaInicio((s) => sumarDiasIso(s, 7))}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-zinc-300 hover:bg-white/10"
          aria-label="Semana siguiente"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">{error}</div>
      ) : null}

      {loading && !data ? (
        <p className="py-10 text-center text-sm text-zinc-500" role="status">
          Cargando jornales…
        </p>
      ) : !data?.colaboradores.length ? (
        <p className="rounded-xl border border-white/10 bg-zinc-950/40 px-4 py-8 text-center text-sm text-zinc-500">
          No hay colaboradores asignados a esta obra. Asigne el equipo en RRHH o en la pestaña Equipo.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full min-w-[720px] caption-bottom text-sm">
            <thead>
              <tr className="border-b border-white/10 text-[10px] font-bold uppercase tracking-wide text-zinc-500">
                <th className="px-3 py-2 text-left">Colaborador</th>
                <th className="px-3 py-2 text-right">Jornal diario</th>
                {DIAS_SEMANA_VE.map((d) => (
                  <th key={d} className="px-1 py-2 text-center">
                    {d}
                  </th>
                ))}
                <th className="px-3 py-2 text-center">Asistencias</th>
                <th className="px-3 py-2 text-right">Costo semanal</th>
              </tr>
            </thead>
            <tbody>
              {data.colaboradores.map((c) => (
                <tr key={c.empleado_id} className="border-b border-white/[0.06] hover:bg-white/[0.03]">
                  <td className="px-3 py-2">
                    <p className="text-sm font-semibold text-zinc-100">{c.nombre_completo}</p>
                    <p className="text-[11px] text-zinc-500">{c.cargo_nombre || 'Sin especialidad'}</p>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      defaultValue={c.jornal_diario_usd || ''}
                      key={`${c.empleado_id}-${c.jornal_diario_usd}`}
                      onBlur={(e) => {
                        const v = Number(e.target.value);
                        if (!Number.isFinite(v) || v === c.jornal_diario_usd) return;
                        void post(
                          {
                            accion: 'tarifa',
                            empleado_id: c.empleado_id,
                            costo_jornal_usd: v,
                            aplicar_semana: true,
                            semana_inicio: data.semana_inicio,
                          },
                          `tarifa-${c.empleado_id}`,
                        );
                      }}
                      className="w-24 rounded-md border border-white/10 bg-zinc-900 px-2 py-1 text-right text-xs text-zinc-100 outline-none focus:border-amber-500/50"
                      aria-label={`Jornal diario de ${c.nombre_completo}`}
                    />
                  </td>
                  {c.asistencias.map((a) => {
                    const key = `${c.empleado_id}-${a.fecha}`;
                    const spinning = busyKey === key;
                    return (
                      <td key={a.fecha} className="px-1 py-2 text-center">
                        <button
                          type="button"
                          title={a.presente ? `Trabajó el ${a.fecha}` : `Marcar ${a.fecha}`}
                          disabled={spinning}
                          onClick={() =>
                            void post(
                              {
                                accion: 'toggle',
                                empleado_id: c.empleado_id,
                                fecha: a.fecha,
                                presente: !a.presente,
                                costo_jornal: c.jornal_diario_usd,
                              },
                              key,
                            )
                          }
                          className={cn(
                            'inline-flex h-7 w-7 items-center justify-center rounded-full border transition',
                            a.presente
                              ? 'border-emerald-400/40 bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.35)] hover:bg-emerald-400'
                              : 'border-zinc-600 bg-zinc-800 hover:border-zinc-400 hover:bg-zinc-700',
                          )}
                          aria-pressed={a.presente}
                        >
                          {spinning ? <Loader2 className="h-3 w-3 animate-spin text-white" /> : null}
                        </button>
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 text-center text-sm font-semibold text-zinc-200">{c.dias_asistidos}</td>
                  <td className="px-3 py-2 text-right font-mono text-sm text-zinc-100">
                    {fmtUsd(c.costo_semanal_usd)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-zinc-950/60 p-4">
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
        <Icon className="h-3.5 w-3.5 text-amber-400" />
        {label}
      </div>
      <p className="mt-2 text-2xl font-black text-zinc-100">{value}</p>
      <p className="mt-1 text-[11px] text-zinc-500">{hint}</p>
    </div>
  );
}
