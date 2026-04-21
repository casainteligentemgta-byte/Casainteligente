'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { createClient } from '@/lib/supabase/client';
import { buildAnalisisCostosProyecto } from '@/lib/finanzas/buildAnalisisCostosProyecto';
import { formatoVES } from '@/lib/nomina/compensacionDiaria';

export type AnalisisCostosProyectoProps = {
  proyectoId: string;
  /** Días laborados de referencia para acumular el mes (p. ej. 22). Por defecto 22. */
  diasLaboradosMesReferencia?: number;
  /** Mes analizado `YYYY-MM`. Por defecto el mes calendario actual. */
  añoMes?: string;
  className?: string;
};

type ObraRow = {
  id: string;
  nombre: string;
  presupuesto_mano_obra_ves: number | null;
  presupuesto_ves: number | null;
  fondo_reserva_liquidacion_ves: number | null;
};

type EmpleadoNested = {
  id: string;
  nombre_completo: string;
  cargo_codigo: string | null;
  cargo_nombre: string | null;
  cargo_nivel: number | null;
  created_at: string | null;
};

type ObraEmpleadoLink = {
  empleado_id: string;
  ci_empleados: EmpleadoNested | EmpleadoNested[] | null;
};

function defaultAñoMes(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function normalizaEmpleado(raw: EmpleadoNested | EmpleadoNested[] | null): EmpleadoNested | null {
  if (raw == null) return null;
  return Array.isArray(raw) ? raw[0] ?? null : raw;
}

export default function AnalisisCostosProyecto({
  proyectoId,
  diasLaboradosMesReferencia = 22,
  añoMes: añoMesProp,
  className = '',
}: AnalisisCostosProyectoProps) {
  const supabase = useMemo(() => createClient(), []);
  const [añoMes, setAñoMes] = useState(añoMesProp ?? defaultAñoMes());
  const [diasMes, setDiasMes] = useState(String(diasLaboradosMesReferencia));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [obra, setObra] = useState<ObraRow | null>(null);
  const [analisis, setAnalisis] = useState<ReturnType<typeof buildAnalisisCostosProyecto> | null>(null);
  const [geminiTexto, setGeminiTexto] = useState<string | null>(null);
  const [geminiMeta, setGeminiMeta] = useState<string | null>(null);
  const [geminiLoading, setGeminiLoading] = useState(false);

  useEffect(() => {
    if (añoMesProp) setAñoMes(añoMesProp);
  }, [añoMesProp]);

  const cargar = useCallback(async () => {
    if (!proyectoId) return;
    setLoading(true);
    setError(null);
    setAnalisis(null);
    setObra(null);
    try {
      const { data: o, error: e1 } = await supabase
        .from('ci_obras')
        .select('id,nombre,presupuesto_mano_obra_ves,presupuesto_ves,fondo_reserva_liquidacion_ves')
        .eq('id', proyectoId)
        .maybeSingle();

      if (e1 || !o) {
        setError(e1?.message ?? 'No se encontró el proyecto.');
        return;
      }
      setObra(o as ObraRow);

      const { data: links, error: e2 } = await supabase
        .from('ci_obra_empleados')
        .select('empleado_id, ci_empleados(id,nombre_completo,cargo_codigo,cargo_nombre,cargo_nivel,created_at)')
        .eq('obra_id', proyectoId);

      if (e2) {
        setError(e2.message);
        return;
      }

      const empleados: EmpleadoNested[] = [];
      for (const row of (links ?? []) as ObraEmpleadoLink[]) {
        const emp = normalizaEmpleado(row.ci_empleados);
        if (emp?.id) empleados.push(emp);
      }

      const dias = Math.max(1, Math.floor(Number(diasMes) || 22));
      const built = buildAnalisisCostosProyecto({
        obra: o as ObraRow,
        empleados,
        añoMes,
        diasLaboradosMesReferencia: dias,
      });
      setAnalisis(built);
    } catch {
      setError('No se pudo cargar el análisis.');
    } finally {
      setLoading(false);
    }
  }, [supabase, proyectoId, añoMes, diasMes]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const chartData = useMemo(() => {
    if (!analisis) return [];
    return [
      { nombre: 'Presupuesto MD', monto: analisis.presupuestoManoObraReferenciaVES },
      { nombre: 'Gastado (mes)', monto: analisis.costoRealMesVES },
    ];
  }, [analisis]);

  const alertaReserva =
    analisis != null &&
    analisis.obra.fondoReservaLiquidacionVES != null &&
    analisis.obra.fondoReservaLiquidacionVES > 0 &&
    analisis.liquidacionProyectadaTotalVES > analisis.obra.fondoReservaLiquidacionVES;

  const distribucionPorNivel = useMemo(() => {
    const m: Record<string, number> = {};
    if (!analisis) return m;
    for (const f of analisis.filas) {
      const k = String(f.nivel);
      m[k] = (m[k] ?? 0) + 1;
    }
    return m;
  }, [analisis]);

  async function consultarGemini() {
    if (!analisis) return;
    setGeminiLoading(true);
    setGeminiTexto(null);
    setGeminiMeta(null);
    try {
      const res = await fetch('/api/finanzas/gemini-nomina-analisis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          presupuestoManoObraVES: analisis.presupuestoManoObraReferenciaVES,
          costoRealMesVES: analisis.costoRealMesVES,
          añoMes,
          distribucionPorNivel,
          filasResumidas: analisis.filas.map((f) => ({
            nombre: f.nombre,
            nivel: f.nivel,
            totalMesVES: f.totalAcumuladoMesVES,
          })),
        }),
      });
      const data = (await res.json()) as { texto?: string; desdeGemini?: boolean; error?: string };
      if (!res.ok) {
        setGeminiTexto(data.error ?? 'Error al consultar la API.');
        return;
      }
      setGeminiTexto(data.texto ?? '');
      setGeminiMeta(data.desdeGemini ? 'Respuesta generada con Gemini.' : 'Modo local (sin API o fallback).');
    } catch {
      setGeminiTexto('Error de red al consultar Gemini.');
    } finally {
      setGeminiLoading(false);
    }
  }

  return (
    <section
      className={`rounded-2xl border border-slate-200 bg-white p-6 shadow-sm text-slate-800 ${className}`}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Análisis de costos — mano de obra</h2>
          <p className="text-xs text-slate-500 mt-1">
            {obra?.nombre ? (
              <span className="font-medium text-slate-700">{obra.nombre}</span>
            ) : (
              <span>Proyecto {proyectoId}</span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-end">
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400">Mes</label>
            <input
              type="month"
              value={añoMes}
              onChange={(e) => setAñoMes(e.target.value)}
              className="rounded-xl border border-slate-200 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400">Días lab.</label>
            <input
              type="number"
              min={1}
              max={31}
              value={diasMes}
              onChange={(e) => setDiasMes(e.target.value)}
              className="w-20 rounded-xl border border-slate-200 px-2 py-1.5 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={() => void cargar()}
            disabled={loading}
            className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {loading ? 'Cargando…' : 'Recalcular'}
          </button>
        </div>
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-slate-500 border-l-2 border-amber-200 pl-3">
        <strong>Nota metodológica:</strong> el costo real del mes suma la remuneración diaria de referencia (salario
        básico diario del tabulador convencional junio 2023 + bono de asistencia prorrateado,{' '}
        <strong>Cl. 41</strong>) por cada empleado vinculado a la obra. Si tu política interna o la{' '}
        <strong>Cl. 33</strong> implican otro criterio de asignación salarial, contrasta con asesoría legal antes de
        tomar decisiones.
      </p>

      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

      {loading ? (
        <p className="mt-6 text-sm text-slate-500">Lectura de Supabase y cálculos…</p>
      ) : analisis ? (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-[10px] font-bold uppercase text-slate-400">Presupuesto MD (ref.)</p>
              <p className="text-xl font-bold text-slate-900 mt-1">
                {formatoVES(analisis.presupuestoManoObraReferenciaVES)} VES
              </p>
              {analisis.obra.presupuestoVesFallback != null ? (
                <p className="text-[10px] text-slate-500 mt-1">Usando presupuesto general (sin MD específico).</p>
              ) : null}
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-[10px] font-bold uppercase text-slate-400">Costo real (mes)</p>
              <p className="text-xl font-bold text-amber-700 mt-1">{formatoVES(analisis.costoRealMesVES)} VES</p>
              <p className="text-[10px] text-slate-500 mt-1">
                Desviación:{' '}
                <span className={analisis.desviacionManoObraVES > 0 ? 'text-red-600 font-semibold' : 'text-emerald-700'}>
                  {analisis.desviacionManoObraVES >= 0 ? '+' : ''}
                  {formatoVES(analisis.desviacionManoObraVES)} VES
                </span>
                {analisis.desviacionManoObraPct != null ? (
                  <span> ({analisis.desviacionManoObraPct >= 0 ? '+' : ''}
                  {analisis.desviacionManoObraPct}%)</span>
                ) : null}
              </p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-[10px] font-bold uppercase text-slate-400">Liquidación proyectada (fin mes)</p>
              <p className="text-xl font-bold text-slate-900 mt-1">
                {formatoVES(analisis.liquidacionProyectadaTotalVES)} VES
              </p>
              <p className="text-[10px] text-slate-500 mt-1">
                Simulación cierre de obra por persona (conv. 2023; contexto Cl. 12–13 en metadatos del motor).
              </p>
            </div>
          </div>

          {alertaReserva ? (
            <div
              className="mt-6 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900"
              role="alert"
            >
              <p className="font-bold">Alerta: fondo de reserva insuficiente</p>
              <p className="mt-1 text-xs leading-relaxed">
                El costo proyectado de liquidación ({formatoVES(analisis.liquidacionProyectadaTotalVES)} VES) supera el
                fondo de reserva configurado ({formatoVES(analisis.obra.fondoReservaLiquidacionVES!)} VES). Revisa
                provisiones y la <strong>Cl. 13</strong> (gastos de traslado/mudanza en transferencias) con asesoría
                legal.
              </p>
            </div>
          ) : analisis.obra.fondoReservaLiquidacionVES == null || analisis.obra.fondoReservaLiquidacionVES <= 0 ? (
            <p className="mt-4 text-xs text-slate-500">
              Sin <code className="rounded bg-slate-100 px-1">fondo_reserva_liquidacion_ves</code> en la obra no se
              dispara la alerta roja. Migra 035 y carga el monto en Supabase.
            </p>
          ) : (
            <p className="mt-4 text-xs text-emerald-700">
              La suma de liquidaciones simuladas no supera el fondo de reserva ({formatoVES(analisis.obra.fondoReservaLiquidacionVES)} VES).
            </p>
          )}

          <div className="mt-8 h-64 w-full">
            <p className="text-xs font-bold uppercase text-slate-400 mb-2">Presupuesto vs gastado (mes)</p>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="nombre" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${(v as number) >= 1_000_000 ? `${(Number(v) / 1_000_000).toFixed(1)}M` : `${(Number(v) / 1000).toFixed(0)}k`}`}
                />
                <Tooltip
                  formatter={(v) => {
                    const n = typeof v === 'number' ? v : Number(v);
                    if (!Number.isFinite(n)) return ['—', 'Monto'];
                    return [`${formatoVES(n)} VES`, 'Monto'];
                  }}
                  contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0' }}
                />
                <Legend />
                <Bar dataKey="monto" name="VES" radius={[8, 8, 0, 0]} maxBarSize={56}>
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={i === 0 ? '#3b82f6' : '#f59e0b'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-10">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">IA — distribución de niveles</h3>
              <button
                type="button"
                onClick={() => void consultarGemini()}
                disabled={geminiLoading}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                {geminiLoading ? 'Consultando Gemini…' : 'Analizar con Gemini'}
              </button>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Prompt: «Analiza si la distribución de niveles (ej. demasiados maestros de obra nivel 9 vs. pocos
              ayudantes nivel 2) es óptima para el presupuesto asignado».
            </p>
            {geminiMeta ? <p className="text-[10px] text-slate-400 mt-2">{geminiMeta}</p> : null}
            {geminiTexto ? (
              <div className="mt-3 rounded-xl border border-indigo-100 bg-indigo-50/50 p-4 text-sm text-slate-800 whitespace-pre-wrap">
                {geminiTexto}
              </div>
            ) : null}
          </div>

          <div className="mt-10 overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="p-3">Empleado</th>
                  <th className="p-3">Nivel</th>
                  <th className="p-3 text-right">SB diario (VES)</th>
                  <th className="p-3 text-right">Rem. diaria ref. (VES)</th>
                  <th className="p-3 text-right">Días</th>
                  <th className="p-3 text-right">Total mes (VES)</th>
                  <th className="p-3 text-right">Liq. sim. fin mes</th>
                </tr>
              </thead>
              <tbody>
                {analisis.filas.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-slate-500">
                      No hay empleados en <code className="text-xs">ci_obra_empleados</code> para esta obra.
                    </td>
                  </tr>
                ) : (
                  analisis.filas.map((f) => (
                    <tr key={f.empleadoId} className="border-t border-slate-100 hover:bg-slate-50/80">
                      <td className="p-3">
                        <div className="font-medium text-slate-900">{f.nombre}</div>
                        <div className="text-[11px] text-slate-400">{f.cargoNombre ?? '—'}</div>
                      </td>
                      <td className="p-3 font-mono text-slate-700">{f.nivel}</td>
                      <td className="p-3 text-right font-mono">{formatoVES(f.salarioBasicoDiarioVES)}</td>
                      <td className="p-3 text-right font-mono">{formatoVES(f.remuneracionDiariaConvencionVES)}</td>
                      <td className="p-3 text-right font-mono">{f.diasLaboradosReferencia}</td>
                      <td className="p-3 text-right font-mono font-semibold">{formatoVES(f.totalAcumuladoMesVES)}</td>
                      <td className="p-3 text-right font-mono text-xs">
                        {f.liquidacionProyectadaFinMesVES != null ? (
                          formatoVES(f.liquidacionProyectadaFinMesVES)
                        ) : (
                          <span className="text-amber-600">{f.liquidacionError ?? '—'}</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </section>
  );
}
