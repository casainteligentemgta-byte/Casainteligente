'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';
import { toast } from 'sonner';
import type { DesviacionPresupuestariaPayload, SaludDesviacion } from '@/types/desviacion';
import { formatApiErrorBody, formatErrorMessage } from '@/lib/utils/formatErrorMessage';
import { parseFetchJson } from '@/lib/utils/parseFetchJson';
import { cn } from '@/lib/utils';

type Props = {
  proyectoId: string;
};

function fmtUsd(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function colorSalud(s: SaludDesviacion) {
  if (s === 'verde') return {
    bar: 'bg-emerald-500',
    text: 'text-emerald-300',
    border: 'border-emerald-500/35',
    bg: 'bg-emerald-950/30',
    label: 'Dentro de presupuesto',
  };
  if (s === 'ambar') return {
    bar: 'bg-amber-400',
    text: 'text-amber-200',
    border: 'border-amber-500/40',
    bg: 'bg-amber-950/30',
    label: 'Cerca del techo',
  };
  return {
    bar: 'bg-red-700',
    text: 'text-red-300',
    border: 'border-red-700/50',
    bg: 'bg-red-950/35',
    label: 'Sobrepresupuesto',
  };
}

function badgeDesviacion(pct: number | null): { text: string; className: string } {
  if (pct == null) return { text: 'Sin base', className: 'border-zinc-600 text-zinc-400' };
  const signo = pct > 0 ? '+' : '';
  if (pct > 0) {
    return {
      text: `${signo}${pct.toFixed(0)}% Desviación`,
      className: 'border-red-700/50 bg-red-950/50 text-red-200',
    };
  }
  return {
    text: `${pct.toFixed(0)}% bajo presupuesto`,
    className: 'border-emerald-500/40 bg-emerald-950/40 text-emerald-200',
  };
}

export default function AlertaDesviacionPresupuestaria({ proyectoId }: Props) {
  const [data, setData] = useState<DesviacionPresupuestariaPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [umbralDraft, setUmbralDraft] = useState('15');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/proyectos/${encodeURIComponent(proyectoId)}/desviacion`, {
        cache: 'no-store',
      });
      const json = await parseFetchJson<DesviacionPresupuestariaPayload & { error?: string }>(res);
      if (!res.ok) throw new Error(formatApiErrorBody(json, 'No se pudo cargar la desviación'));
      setData(json);
      setUmbralDraft(String(json.umbral_pct ?? 15));
    } catch (e) {
      setError(formatErrorMessage(e));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [proyectoId]);

  useEffect(() => {
    void load();
  }, [load]);

  const guardarUmbral = async () => {
    const n = Number(umbralDraft);
    if (!Number.isFinite(n) || n < 0) {
      toast.error('Indique un umbral de 0 o más.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/proyectos/${encodeURIComponent(proyectoId)}/desviacion`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ umbral_pct: n }),
      });
      const json = await parseFetchJson<DesviacionPresupuestariaPayload & { error?: string }>(res);
      if (!res.ok) throw new Error(formatApiErrorBody(json, 'No se pudo guardar el umbral'));
      setData(json);
      toast.success('Umbral actualizado');
    } catch (e) {
      toast.error(formatErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex min-h-[180px] items-center justify-center rounded-2xl border border-white/10 bg-[#0A0A0F]">
        <Loader2 className="h-6 w-6 animate-spin text-amber-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-900/50 bg-red-950/30 p-4 text-sm text-red-200">
        {error}
      </div>
    );
  }

  if (!data) return null;

  const salud = colorSalud(data.salud);
  const ancho = Math.min(130, Math.max(0, data.pct_consumido ?? 0));
  const badge = badgeDesviacion(data.desviacion_pct);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
            Salud presupuestaria
          </p>
          <h2 className="mt-1 text-lg font-bold text-zinc-100">Alerta de desviación</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Ejecutado = jornales + compras contables + egresos de almacén a obra. Montos en USD
            {data.tasa_bcv_ves_por_usd ? ` · BCV ${data.tasa_bcv_ves_por_usd.toFixed(2)}` : ''}.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-white/[0.08]"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Actualizar
        </button>
      </div>

      <div className={cn('rounded-2xl border p-5', salud.border, salud.bg)}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className={cn('text-[10px] font-bold uppercase tracking-widest', salud.text)}>
              {salud.label}
            </p>
            <p className="mt-1 text-3xl font-black text-zinc-50">
              {(data.pct_consumido ?? 0).toFixed(0)}%
              <span className="ml-2 text-sm font-semibold text-zinc-400">consumido</span>
            </p>
          </div>
          <span className={cn('rounded-full border px-2.5 py-0.5 text-[11px] font-bold', badge.className)}>
            {badge.text}
          </span>
        </div>
        <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-black/40">
          <div
            className={cn('h-full rounded-full transition-all duration-700 ease-out', salud.bar)}
            style={{ width: `${ancho}%` }}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <DatoCard label="Presupuesto estimado original" value={fmtUsd(data.presupuesto_estimado_usd)} hint={data.fuente_presupuesto} />
        <DatoCard label="Gasto ejecutado real" value={fmtUsd(data.gasto_ejecutado_usd)} hint="Jornales + materiales + egresos" />
        <DatoCard
          label="Diferencia"
          value={fmtUsd(data.diferencia_usd)}
          hint={data.diferencia_usd > 0 ? 'Sobre el estimado' : 'Bajo el estimado'}
        />
        <div className="rounded-xl border border-white/10 bg-[#0A0A0F] p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Umbral de alerta</p>
          <div className="mt-2 flex items-center gap-2">
            <input
              type="number"
              min={0}
              step="1"
              value={umbralDraft}
              onChange={(e) => setUmbralDraft(e.target.value)}
              className="w-16 rounded-md border border-white/10 bg-zinc-900 px-2 py-1 text-sm text-zinc-100"
              aria-label="Umbral porcentual"
            />
            <span className="text-xs text-zinc-500">%</span>
            <button
              type="button"
              onClick={() => void guardarUmbral()}
              disabled={saving}
              className="rounded-md border border-amber-500/40 bg-amber-950/40 px-2 py-1 text-[11px] font-semibold text-amber-100 hover:bg-amber-900/50 disabled:opacity-60"
            >
              {saving ? '…' : 'Guardar'}
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <Mini label="Mano de obra (jornales)" value={fmtUsd(data.desglose.mano_obra_usd)} />
        <Mini label="Materiales (contabilidad)" value={fmtUsd(data.desglose.materiales_usd)} />
        <Mini label="Egresos de almacén" value={fmtUsd(data.desglose.egresos_almacen_usd)} />
      </div>

      {data.capitulos.length ? (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-[10px] font-bold uppercase tracking-wide text-zinc-500">
                <th className="px-3 py-2 text-left">Capítulo</th>
                <th className="px-3 py-2 text-right">Presupuesto</th>
                <th className="px-3 py-2 text-right">Ejecutado</th>
                <th className="px-3 py-2 text-right">% consumido</th>
              </tr>
            </thead>
            <tbody>
              {data.capitulos.map((c) => (
                <tr key={c.codigo} className="border-b border-white/[0.06]">
                  <td className="px-3 py-2">
                    <span className="font-mono text-[11px] text-zinc-500">{c.codigo}</span>{' '}
                    <span className="text-zinc-200">{c.descripcion}</span>
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-zinc-300">{fmtUsd(c.presupuesto_usd)}</td>
                  <td className="px-3 py-2 text-right font-mono text-zinc-300">{fmtUsd(c.ejecutado_usd)}</td>
                  <td className="px-3 py-2 text-right text-zinc-300">
                    {c.pct_consumido == null ? '—' : `${c.pct_consumido.toFixed(0)}%`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className="rounded-2xl border border-white/10 bg-[#0A0A0F] p-4">
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Feed de alertas</h3>
        {data.alertas.length === 0 ? (
          <p className="mt-3 flex items-center gap-2 text-sm text-emerald-300">
            <CheckCircle2 className="h-4 w-4" />
            Sin alertas de desviación por ahora.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {data.alertas.map((a) => (
              <li
                key={a.id}
                className={cn(
                  'flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm',
                  a.severidad === 'alerta'
                    ? 'border-red-800/50 bg-red-950/30 text-red-100'
                    : 'border-amber-700/40 bg-amber-950/30 text-amber-100',
                )}
              >
                {a.severidad === 'alerta' ? (
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                ) : (
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                )}
                {a.mensaje}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function DatoCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#0A0A0F] p-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{label}</p>
      <p className="mt-2 text-lg font-black text-zinc-100">{value}</p>
      <p className="mt-1 truncate text-[11px] text-zinc-500">{hint}</p>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-zinc-950/50 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="font-mono text-sm text-zinc-200">{value}</p>
    </div>
  );
}
