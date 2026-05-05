'use client';

import { AlertCircle, Flame, LineChart as LineChartIcon, PiggyBank, Target } from 'lucide-react';
import type { ReactNode } from 'react';
import { useMemo } from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useDashboardUtilidadReal } from '@/hooks/useDashboardUtilidadReal';

function fmtUsd(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtPct(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return `${n.toFixed(1)}%`;
}

export type DashboardUtilidadRealProps = {
  proyectoId: string;
  className?: string;
};

export default function DashboardUtilidadReal({ proyectoId, className = '' }: DashboardUtilidadRealProps) {
  const q = useDashboardUtilidadReal(proyectoId);
  const d = q.data;

  const ultimoAhorro = useMemo(() => {
    const s = d?.serieComparativa ?? [];
    const last = s[s.length - 1];
    return last?.ahorro ?? 0;
  }, [d]);

  const fillGasto = ultimoAhorro >= 0 ? 'rgba(16,185,129,0.22)' : 'rgba(255,45,85,0.2)';
  const strokeGasto = ultimoAhorro >= 0 ? '#34d399' : '#ff2d55';

  if (q.isLoading) {
    return (
      <div
        className={`rounded-2xl border border-white/10 bg-[#0A0A0F]/95 p-6 text-sm text-zinc-500 backdrop-blur-xl ${className}`}
        style={{ backgroundColor: '#0A0A0F' }}
      >
        Cargando utilidad real…
      </div>
    );
  }

  if (q.isError) {
    return (
      <div
        className={`flex items-start gap-3 rounded-2xl border border-red-500/30 bg-[#0A0A0F]/95 p-5 text-sm text-red-300 backdrop-blur-xl ${className}`}
        style={{ backgroundColor: '#0A0A0F' }}
      >
        <AlertCircle className="h-5 w-5 shrink-0" aria-hidden />
        <div>
          <p className="font-semibold text-red-200">No se pudieron consolidar las métricas</p>
          <p className="mt-1 text-red-300/90">{q.error instanceof Error ? q.error.message : 'Error desconocido'}</p>
        </div>
      </div>
    );
  }

  if (!d) return null;

  const pctBurnPresupuesto =
    d.ingresosTotalesUsd > 0 ? Math.min(1.5, (d.burnRateTalentoSemanalUsd * 4) / d.ingresosTotalesUsd) * 100 : 0;

  return (
    <div
      className={`space-y-6 rounded-2xl border border-white/10 bg-[#0A0A0F]/95 p-5 shadow-[0_0_48px_rgba(0,0,0,0.45)] backdrop-blur-xl ${className}`}
      style={{ backgroundColor: '#0A0A0F', fontFamily: 'var(--font-sans), ui-sans-serif, system-ui' }}
    >
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-white/10 pb-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Finanzas · Margen real</p>
          <h2 className="mt-1 text-lg font-bold tracking-tight text-white">Dashboard utilidad real</h2>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-zinc-500">
            Consolidación sobre <span className="font-mono text-zinc-400">ci_proyectos</span> (integral + talento): ingresos
            contrato/presupuesto vs. materiales, nómina, reclutamiento, beneficios estimados y dotación EPP (heurística inventario).
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          icon={<PiggyBank className="h-5 w-5 text-sky-400" aria-hidden />}
          titulo="Monto total (ingresos)"
          valor={fmtUsd(d.ingresosTotalesUsd)}
          subtitulo="Contrato / presupuesto referencial (USD)."
        />
        <KpiCard
          icon={<Flame className="h-5 w-5 text-amber-400" aria-hidden />}
          titulo="Burn rate Talento"
          valor={fmtUsd(d.burnRateTalentoSemanalUsd)}
          subtitulo={`~${pctBurnPresupuesto.toFixed(0)}% del ingreso / mes (4 sem) en solo nómina.`}
        />
        <KpiCard
          icon={<Target className="h-5 w-5 text-emerald-400" aria-hidden />}
          titulo="Margen actual"
          valor={fmtPct(d.margenBrutoPct)}
          subtitulo={`${fmtUsd(d.margenBrutoUsd)} bruto acumulado vs. ingresos.`}
        />
        <KpiCard
          icon={<LineChartIcon className="h-5 w-5 text-violet-400" aria-hidden />}
          titulo="Proyección al cierre"
          valor={fmtUsd(d.proyeccionUtilidadFinalUsd)}
          subtitulo="Extrapolación por ritmo de gasto diario hasta fecha fin de obra."
        />
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
        <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">Presupuesto estimado vs. gasto real</p>
        <p className="mt-1 text-xs text-zinc-500">
          Área bajo gasto: <span className="text-emerald-400/95">verde esmeralda</span> si ahorro ≥ 0 al corte;{' '}
          <span className="text-[#ff2d55]">rojo neón</span> si sobrecosto.
        </p>
        <div className="mt-4 h-[280px] w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={d.serieComparativa} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: '#71717a', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fill: '#71717a', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `$${Math.round(Number(v) / 1000)}k`}
              />
              <Tooltip
                contentStyle={{
                  background: '#111118',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 12,
                  fontSize: 12,
                }}
                labelStyle={{ color: '#a1a1aa' }}
                formatter={(value, name) => [
                  fmtUsd(Number(value ?? 0)),
                  name === 'presupuestoAcum' ? 'Presupuesto acum.' : 'Gasto acum.',
                ]}
              />
              <Area
                type="monotone"
                dataKey="gastoAcum"
                stroke={strokeGasto}
                strokeWidth={2}
                fill={fillGasto}
                name="gastoAcum"
              />
              <Line
                type="monotone"
                dataKey="presupuestoAcum"
                stroke="#e4e4e7"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
                name="presupuestoAcum"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div>
        <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">Desglose por partida</p>
        <div className="mt-3 overflow-hidden rounded-xl border border-white/10">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.03] text-[10px] font-bold uppercase tracking-wide text-zinc-500">
                <th className="px-4 py-3">Partida</th>
                <th className="px-4 py-3 text-right tabular-nums">USD</th>
              </tr>
            </thead>
            <tbody>
              {d.partidas.map((row) => (
                <tr key={row.id} className="border-b border-white/[0.06] last:border-0 hover:bg-white/[0.03]">
                  <td className="px-4 py-3 text-zinc-200">
                    <span className="font-medium">{row.categoria}</span>
                    <p className="mt-0.5 text-[11px] font-normal text-zinc-500">{row.detalle}</p>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-sm tabular-nums text-zinc-100">{fmtUsd(row.montoUsd)}</td>
                </tr>
              ))}
              <tr className="bg-white/[0.04]">
                <td className="px-4 py-3 font-semibold text-white">Total gastos</td>
                <td className="px-4 py-3 text-right font-mono text-sm font-semibold tabular-nums text-white">
                  {fmtUsd(d.gastoRealAcumuladoUsd)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  icon,
  titulo,
  valor,
  subtitulo,
}: {
  icon: ReactNode;
  titulo: string;
  valor: string;
  subtitulo: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 shadow-inner shadow-black/20">
      <div className="flex items-center gap-2 text-zinc-500">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-black/30">{icon}</div>
        <span className="text-[10px] font-bold uppercase tracking-wide">{titulo}</span>
      </div>
      <p className="mt-3 font-mono text-2xl font-semibold tabular-nums tracking-tight text-white">{valor}</p>
      <p className="mt-2 text-[11px] leading-snug text-zinc-500">{subtitulo}</p>
    </div>
  );
}
