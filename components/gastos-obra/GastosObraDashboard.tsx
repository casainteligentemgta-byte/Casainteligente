'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  BarChart3,
  Calendar,
  DollarSign,
  Layers,
  Loader2,
  RefreshCw,
  Receipt,
  TrendingUp,
} from 'lucide-react';
import { Toaster } from 'sonner';
import { useGastosObra } from '@/hooks/useGastosObra';
import { formatUsd, labelMes } from '@/lib/gastos-obra/gastosObraUtils';
import { FILTRO_TODOS } from '@/types/gastos-obra';
import GastosObraCharts from '@/components/gastos-obra/GastosObraCharts';
import GastosObraEditModal from '@/components/gastos-obra/GastosObraEditModal';
import GastosObraProveedoresTable, { type EditTarget } from '@/components/gastos-obra/GastosObraProveedoresTable';

function KpiCard({
  title,
  value,
  icon,
  sub,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{title}</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
          {sub ? <p className="mt-1 text-xs text-gray-500">{sub}</p> : null}
        </div>
        <div className="rounded-lg bg-orange-50 p-2.5 text-orange-600">{icon}</div>
      </div>
    </div>
  );
}

const selectCls =
  'w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-800 shadow-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100';

export default function GastosObraDashboard() {
  const {
    filtros,
    setFiltros,
    loading,
    error,
    opcionesMes,
    opcionesTipo,
    opcionesDisciplina,
    kpis,
    chartEvolucion,
    chartTopTipo,
    chartDisciplina,
    proveedores,
    recargar,
    actualizarCampo,
  } = useGastosObra();

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
    <div className="min-h-screen bg-gray-50 pb-16">
      <Toaster position="top-center" richColors />
      <div className="mx-auto max-w-7xl px-4 py-8">
        <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link href="/proyectos/modulo" className="text-sm font-medium text-orange-600 hover:text-orange-700">
              ← Proyectos
            </Link>
            <h1 className="mt-2 flex items-center gap-2 text-2xl font-bold text-gray-900">
              <BarChart3 className="h-7 w-7 text-orange-500" />
              Dashboard de gastos de obra
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Datos en tiempo real desde Supabase · tabla gastos_obra
            </p>
          </div>
          <button
            type="button"
            onClick={() => void recargar()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Actualizar
          </button>
        </header>

        {error ? (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        <section className="mb-6 grid gap-4 rounded-xl border border-gray-100 bg-white p-5 shadow-sm sm:grid-cols-3">
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase text-gray-500">
              <Calendar className="h-3.5 w-3.5" /> Mes
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
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase text-gray-500">
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
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase text-gray-500">
              <Layers className="h-3.5 w-3.5" /> Área / disciplina
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
        </section>

        {loading && kpis.transacciones === 0 && !error ? (
          <div className="flex items-center justify-center py-24 text-gray-500">
            <Loader2 className="mr-2 h-6 w-6 animate-spin text-orange-500" />
            Cargando gastos…
          </div>
        ) : (
          <>
            <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard
                title="Gasto total proyecto"
                value={formatUsd(kpis.gastoTotal)}
                icon={<DollarSign className="h-5 w-5" />}
              />
              <KpiCard
                title="Acumulado a la fecha"
                value={formatUsd(kpis.acumulado)}
                icon={<TrendingUp className="h-5 w-5" />}
                sub={
                  filtros.mes !== FILTRO_TODOS
                    ? `Hasta ${labelMes(filtros.mes)}`
                    : 'Todos los periodos'
                }
              />
              <KpiCard
                title="Gasto del periodo"
                value={formatUsd(kpis.gastoPeriodo)}
                icon={<BarChart3 className="h-5 w-5" />}
                sub="Según filtros activos"
              />
              <KpiCard
                title="Transacciones"
                value={String(kpis.transacciones)}
                icon={<Receipt className="h-5 w-5" />}
              />
            </section>

            <section className="mb-6">
              <GastosObraCharts
                evolucion={chartEvolucion}
                topTipo={chartTopTipo}
                disciplinas={chartDisciplina}
              />
            </section>

            <section>
              <h2 className="mb-4 text-lg font-semibold text-gray-900">Proveedores</h2>
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
