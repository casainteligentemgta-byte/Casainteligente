'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { AgrupadoDisciplina, AgrupadoTipo, EvolucionMes } from '@/lib/gastos-obra/gastosObraUtils';
import { formatUsd } from '@/lib/gastos-obra/gastosObraUtils';

const PIE_COLORS = [
  '#f97316',
  '#3b82f6',
  '#10b981',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
  '#eab308',
  '#6366f1',
  '#ef4444',
  '#64748b',
];

type Props = {
  evolucion: EvolucionMes[];
  topTipo: AgrupadoTipo[];
  disciplinas: AgrupadoDisciplina[];
};

function TooltipUsd({
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
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-md">
      {label ? <p className="font-medium text-gray-700">{label}</p> : null}
      <p className="text-orange-600">{formatUsd(Number(payload[0].value))}</p>
    </div>
  );
}

export default function GastosObraCharts({ evolucion, topTipo, disciplinas }: Props) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm lg:col-span-2">
        <h3 className="mb-4 text-sm font-semibold text-gray-800">Evolución del gasto</h3>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={evolucion} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#6b7280' }} />
              <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} tickFormatter={(v) => `$${v}`} />
              <Tooltip content={<TooltipUsd />} />
              <Line type="monotone" dataKey="costo" stroke="#f97316" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-gray-800">Top 10 gastos por tipo</h3>
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topTipo} layout="vertical" margin={{ left: 8, right: 24, top: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#6b7280' }} tickFormatter={(v) => `$${v}`} />
              <YAxis type="category" dataKey="tipo" width={100} tick={{ fontSize: 11, fill: '#374151' }} />
              <Tooltip content={<TooltipUsd />} />
              <Bar dataKey="costo" fill="#3b82f6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-gray-800">Distribución por área</h3>
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={disciplinas}
                dataKey="costo"
                nameKey="disciplina"
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={95}
                paddingAngle={2}
              >
                {disciplinas.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => formatUsd(Number(v ?? 0))} />
              <Legend layout="vertical" align="right" verticalAlign="middle" wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}



