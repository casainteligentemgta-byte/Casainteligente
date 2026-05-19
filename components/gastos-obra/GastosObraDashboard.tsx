'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  BarChart3,
  Calendar,
  DollarSign,
  FilterX,
  Layers,
  Loader2,
  Receipt,
  RefreshCw,
  TrendingUp,
} from 'lucide-react';
import { Toaster } from 'sonner';
import { useGastos } from '@/hooks/useGastos';
import { formatUsd, labelMes } from '@/lib/gastos-obra/gastosObraUtils';
import { FILTRO_TODOS } from '@/types/gastos-obra';
import GastosObraCharts from '@/components/gastos-obra/GastosObraCharts';
import GastosObraEditModal from '@/components/gastos-obra/GastosObraEditModal';
import GastosObraProveedoresTable, { type EditTarget } from '@/components/gastos-obra/GastosObraProveedoresTable';

const KPI_STYLES = {
  indigo: {
    card: 'border-indigo-100 from-indigo-50',
    icon: 'text-indigo-600',
  },
  emerald: {
    card: 'border-emerald-100 from-emerald-50',
    icon: 'text-emerald-600',
  },
  slate: {
    card: 'border-slate-100 from-slate-50',
    icon: 'text-slate-600',
  },
  amber: {
    card: 'border-amber-100 from-amber-50',
    icon: 'text-amber-600',
  },
} as const;

function KpiCard({
  title,
  value,
  icon,
  sub,
  accent,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  sub?: string;
  accent: keyof typeof KPI_STYLES;
}) {
  const s = KPI_STYLES[accent];
  return (
    <div
      className={`flex items-start justify-between gap-4 rounded-2xl border bg-gradient-to-br to-white p-6 shadow-sm ${s.card}`}
    >
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
        <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{value}</p>
        {sub ? <p className="mt-1.5 text-xs text-slate-500">{sub}</p> : null}
      </div>
      <div className={`rounded-xl bg-white/80 p-3 shadow-sm ${s.icon}`}>{icon}</div>
    </div>
  );
}

const selectCls =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100';

export default function GastosObraDashboard() {
  const {
    filtros,
    setFiltros,
    limpiarFiltros,
    hayFiltrosActivos,
    loading,
    error,
    opcionesMes,
    opcionesTipo,
    opcionesDisciplina,
    kpis,
    chartEvolucion,
    chartTopTipo,
    chartTopProveedor,
    chartDisciplina,
    proveedores,
    recargar,
    actualizarCampo,
  } = useGastos();

  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);

  async function handleSave(nuevoValor: string) {
    if (!editTarget) return false;
    return actualizarCampo({
      field: editTarget.field,
      nuevoValor,
      transactionId: editTarget.transactionId,
      proveedorAnterior: editTarget.proveedorAnterior,
    });
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <Toaster position="top-center" richColors />
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link
              href="/proyectos/modulo"
              className="text-sm font-semibold text-indigo-600 hover:text-indigo-700"
            >
              ← Proyectos
            </Link>
            <h1 className="mt-2 flex items-center gap-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-200">
                <BarChart3 className="h-5 w-5" />
              </span>
              Control de gastos de obra
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Tiempo real · Supabase{' '}
              <code className="rounded bg-slate-200/60 px-1.5 py-0.5 text-xs">gastos_obra</code>
            </p>
          </div>
          <button
            type="button"
            onClick={() => void recargar()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Actualizar
          </button>
        </header>

        {error ? (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        <section className="mb-6 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-bold tracking-tight text-slate-800">Filtros inteligentes</p>
            {hayFiltrosActivos ? (
              <button
                type="button"
                onClick={limpiarFiltros}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                <FilterX className="h-3.5 w-3.5" />
                Limpiar filtros
              </button>
            ) : null}
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">
                <Calendar className="h-3.5 w-3.5" /> Mes / año
              </label>
              <select
                className={selectCls}
                value={filtros.mes}
                onChange={(e) => setFiltros((f) => ({ ...f, mes: e.target.value }))}
              >
                <option value={FILTRO_TODOS}>Todos los meses</option>
                {opcionesMes.map((m) => (
                  <option key={m} value={m}>
                    {labelMes(m)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">
                <Receipt className="h-3.5 w-3.5" /> Tipo de gasto
              </label>
              <select
                className={selectCls}
                value={filtros.tipo}
                onChange={(e) => setFiltros((f) => ({ ...f, tipo: e.target.value }))}
              >
                <option value={FILTRO_TODOS}>Todos</option>
                {opcionesTipo.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">
                <Layers className="h-3.5 w-3.5" /> Disciplina / área
              </label>
              <select
                className={selectCls}
                value={filtros.disciplina}
                onChange={(e) => setFiltros((f) => ({ ...f, disciplina: e.target.value }))}
              >
                <option value={FILTRO_TODOS}>Todas</option>
                {opcionesDisciplina.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {loading && kpis.transacciones === 0 && !error ? (
          <div className="flex items-center justify-center py-28 text-slate-500">
            <Loader2 className="mr-2 h-7 w-7 animate-spin text-indigo-500" />
            Cargando gastos de obra…
          </div>
        ) : (
          <>
            <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard
                title="Gasto total del proyecto"
                value={formatUsd(kpis.gastoTotal)}
                icon={<DollarSign className="h-5 w-5" />}
                accent="indigo"
              />
              <KpiCard
                title="Acumulado a la fecha"
                value={formatUsd(kpis.acumulado)}
                icon={<TrendingUp className="h-5 w-5" />}
                sub={
                  filtros.mes !== FILTRO_TODOS
                    ? `Hasta ${labelMes(filtros.mes)} inclusive`
                    : 'Histórico completo'
                }
                accent="emerald"
              />
              <KpiCard
                title="Gasto del periodo"
                value={formatUsd(kpis.gastoPeriodo)}
                icon={<BarChart3 className="h-5 w-5" />}
                sub="Según filtros activos"
                accent="amber"
              />
              <KpiCard
                title="Volumen de transacciones"
                value={String(kpis.transacciones)}
                icon={<Receipt className="h-5 w-5" />}
                accent="slate"
              />
            </section>

            <section className="mb-6">
              <GastosObraCharts
                evolucion={chartEvolucion}
                topTipo={chartTopTipo}
                topProveedor={chartTopProveedor}
                disciplinas={chartDisciplina}
              />
            </section>

            <section>
              <h2 className="mb-4 text-lg font-bold tracking-tight text-slate-900">
                Proveedores y facturas
              </h2>
              <GastosObraProveedoresTable
                proveedores={proveedores}
                gastoPeriodo={kpis.gastoPeriodo}
                onEdit={setEditTarget}
              />
            </section>
          </>
        )}
      </div>

      {editTarget ? (
        <GastosObraEditModal
          open
          onClose={() => setEditTarget(null)}
          field={editTarget.field}
          valorActual={editTarget.valorActual}
          transactionId={editTarget.transactionId}
          proveedorAnterior={editTarget.proveedorAnterior}
          bulkProveedor={editTarget.bulkProveedor}
          onSave={handleSave}
        />
      ) : null}
    </div>
  );
}
