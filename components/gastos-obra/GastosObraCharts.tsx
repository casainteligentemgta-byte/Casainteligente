'use client';

import { useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type {
  AgrupadoDisciplina,
  AgrupadoProveedor,
  AgrupadoTipo,
  EvolucionMes,
} from '@/lib/gastos-obra/gastosObraUtils';
import { formatUsd } from '@/lib/gastos-obra/gastosObraUtils';

const PALETTE = {
  indigo: '#6366f1',
  emerald: '#10b981',
  slate: '#64748b',
  violet: '#8b5cf6',
  sky: '#0ea5e9',
  amber: '#f59e0b',
  rose: '#f43f5e',
  teal: '#14b8a6',
};

const PIE_COLORS = [
  PALETTE.indigo,
  PALETTE.emerald,
  PALETTE.sky,
  PALETTE.violet,
  PALETTE.amber,
  PALETTE.teal,
  PALETTE.rose,
  PALETTE.slate,
];

type Props = {
  evolucion: EvolucionMes[];
  topTipo: AgrupadoTipo[];
  topProveedor: AgrupadoProveedor[];
  disciplinas: AgrupadoDisciplina[];
};

function TooltipPremium({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white/95 px-4 py-3 text-sm shadow-lg backdrop-blur-sm">
      {label ? <p className="mb-1 font-semibold tracking-tight text-slate-700">{label}</p> : null}
      <p className="font-bold text-indigo-600">{formatUsd(Number(payload[0].value))}</p>
    </div>
  );
}

export default function GastosObraCharts({ evolucion, topTipo, topProveedor, disciplinas }: Props) {
  const [barMode, setBarMode] = useState<'tipo' | 'proveedor'>('tipo');
  const barData =
    barMode === 'tipo'
      ? topTipo.map((r) => ({ nombre: r.tipo, costo: r.costo }))
      : topProveedor.map((r) => ({ nombre: r.proveedor, costo: r.costo }));

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm lg:col-span-2">
        <h3 className="text-sm font-bold tracking-tight text-slate-800">Evolución del gasto</h3>
        <p className="mt-0.5 text-xs text-slate-500">Acumulado mensual según filtros de tipo y disciplina</p>
        <div className="mt-4 h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={evolucion} margin={{ top: 8, right: 16, left: 4, bottom: 8 }}>
              <defs>
                <linearGradient id="gastoArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={PALETTE.indigo} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={PALETTE.indigo} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fontSize: 12, fill: '#64748b' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `$${Number(v).toLocaleString('en-US', { notation: 'compact' })}`}
              />
              <Tooltip content={<TooltipPremium />} />
              <Area
                type="monotone"
                dataKey="costo"
                stroke={PALETTE.indigo}
                strokeWidth={2.5}
                fill="url(#gastoArea)"
                dot={{ r: 4, fill: PALETTE.indigo, strokeWidth: 0 }}
                activeDot={{ r: 6 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold tracking-tight text-slate-800">Top 10 — fugas de capital</h3>
            <p className="text-xs text-slate-500">Mayor a menor en el periodo filtrado</p>
          </div>
          <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setBarMode('tipo')}
              className={`rounded-md px-3 py-1.5 transition ${
                barMode === 'tipo' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Por tipo
            </button>
            <button
              type="button"
              onClick={() => setBarMode('proveedor')}
              className={`rounded-md px-3 py-1.5 transition ${
                barMode === 'proveedor'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Por proveedor
            </button>
          </div>
        </div>
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} layout="vertical" margin={{ left: 4, right: 20, top: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fontSize: 11, fill: '#64748b' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `$${Number(v).toLocaleString('en-US', { notation: 'compact' })}`}
              />
              <YAxis
                type="category"
                dataKey="nombre"
                width={108}
                tick={{ fontSize: 11, fill: '#334155' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<TooltipPremium />} />
              <Bar dataKey="costo" fill={PALETTE.emerald} radius={[0, 6, 6, 0]} barSize={14} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-bold tracking-tight text-slate-800">Distribución por disciplina</h3>
        <p className="mt-0.5 text-xs text-slate-500">Participación porcentual del gasto del periodo</p>
        <div className="mt-4 h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={disciplinas}
                dataKey="costo"
                nameKey="disciplina"
                cx="50%"
                cy="50%"
                innerRadius={58}
                outerRadius={92}
                paddingAngle={3}
              >
                {disciplinas.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="transparent" />
                ))}
              </Pie>
              <Tooltip content={<TooltipPremium />} />
              <Legend
                layout="vertical"
                align="right"
                verticalAlign="middle"
                wrapperStyle={{ fontSize: 11, color: '#475569' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
