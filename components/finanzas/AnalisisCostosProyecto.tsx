'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
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
import ModalNuevaVacante from '@/components/proyectos/ModalNuevaVacante';

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
  const [error, setError] = useState<ReactNode | null>(null);
  const [obra, setObra] = useState<ObraRow | null>(null);
  const [analisis, setAnalisis] = useState<ReturnType<typeof buildAnalisisCostosProyecto> | null>(null);
  const [geminiTexto, setGeminiTexto] = useState<string | null>(null);
  const [geminiMeta, setGeminiMeta] = useState<string | null>(null);
  const [geminiLoading, setGeminiLoading] = useState(false);
  const [vacanteOpen, setVacanteOpen] = useState(false);

  useEffect(() => {
    if (añoMesProp) setAñoMes(añoMesProp);
  }, [añoMesProp]);

  useEffect(() => {
    setVacanteOpen(false);
  }, [proyectoId]);

  const cargar = useCallback(async () => {
    if (!proyectoId) return;
    setLoading(true);
    setError(null);
    setAnalisis(null);
    setObra(null);
    try {
      const { data: rawP, error: e1 } = await supabase
        .from('ci_proyectos')
        .select(
          'id,nombre,tipo_proyecto,obra_presupuesto_mano_obra_ves,obra_presupuesto_ves,obra_fondo_reserva_liquidacion_ves',
        )
        .eq('id', proyectoId)
        .maybeSingle();

      if (e1) {
        setError(<p className="text-sm text-red-400">{e1.message}</p>);
        return;
      }
      const raw = rawP as {
        id: string;
        nombre: string;
        tipo_proyecto?: string | null;
        obra_presupuesto_mano_obra_ves: number | null;
        obra_presupuesto_ves: number | null;
        obra_fondo_reserva_liquidacion_ves: number | null;
      } | null;

      if (!raw || raw.tipo_proyecto !== 'talento') {
        const { data: integral } = await supabase
          .from('ci_proyectos')
          .select('id,nombre')
          .eq('id', proyectoId)
          .maybeSingle();
        if (integral) {
          setError(
            <div className="rounded-xl border border-amber-500/30 bg-amber-950/25 px-4 py-3 text-sm text-zinc-200 space-y-2">
              <p className="text-amber-100/95">
                No hay análisis de costos de mano de obra para esta referencia en esta pantalla.
              </p>
              <Link href="/proyectos/modulo" className="inline-block text-xs font-semibold text-sky-400 hover:text-sky-300 underline">
                Volver al listado de proyectos
              </Link>
            </div>,
          );
          return;
        }
        setError(
          <p className="text-sm text-red-400">
            No hay ninguna obra de Talento con este identificador. Revisa la URL o crea la obra primero.
          </p>,
        );
        return;
      }

      const o: ObraRow = {
        id: raw.id,
        nombre: raw.nombre,
        presupuesto_mano_obra_ves: raw.obra_presupuesto_mano_obra_ves,
        presupuesto_ves: raw.obra_presupuesto_ves,
        fondo_reserva_liquidacion_ves: raw.obra_fondo_reserva_liquidacion_ves,
      };
      setObra(o);

      const { data: links, error: e2 } = await supabase
        .from('ci_obra_empleados')
        .select('empleado_id, ci_empleados(id,nombre_completo,cargo_codigo,cargo_nombre,cargo_nivel,created_at)')
        .eq('obra_id', proyectoId);

      if (e2) {
        setError(<p className="text-sm text-red-400">{e2.message}</p>);
        return;
      }

      const empleados: EmpleadoNested[] = [];
      for (const row of (links ?? []) as ObraEmpleadoLink[]) {
        const emp = normalizaEmpleado(row.ci_empleados);
        if (emp?.id) empleados.push(emp);
      }

      const dias = Math.max(1, Math.floor(Number(diasMes) || 22));
      const built = buildAnalisisCostosProyecto({
        obra: o,
        empleados,
        añoMes,
        diasLaboradosMesReferencia: dias,
      });
      setAnalisis(built);
    } catch {
      setError(<p className="text-sm text-red-400">No se pudo cargar el análisis.</p>);
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
      className={`rounded-2xl border border-white/10 bg-zinc-900/70 p-6 shadow-lg backdrop-blur-xl text-zinc-200 ${className}`}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">Análisis de costos — mano de obra</h2>
          <p className="text-xs text-zinc-500 mt-1">
            {obra?.nombre ? (
              <span className="font-medium text-zinc-300">{obra.nombre}</span>
            ) : (
              <span>Proyecto {proyectoId}</span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-end">
          <div>
            <label className="block text-[10px] uppercase font-bold text-zinc-500">Mes</label>
            <input
              type="month"
              value={añoMes}
              onChange={(e) => setAñoMes(e.target.value)}
              className="rounded-xl border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white outline-none"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase font-bold text-zinc-500">Días lab.</label>
            <input
              type="number"
              min={1}
              max={31}
              value={diasMes}
              onChange={(e) => setDiasMes(e.target.value)}
              className="w-20 rounded-xl border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white outline-none"
            />
          </div>
          <button
            type="button"
            onClick={() => void cargar()}
            disabled={loading}
            className="rounded-xl bg-[#007AFF] px-3 py-2 text-xs font-semibold text-white hover:bg-[#0062CC] disabled:opacity-50"
          >
            {loading ? 'Cargando…' : 'Recalcular'}
          </button>
          {analisis && !error ? (
            <button
              type="button"
              onClick={() => setVacanteOpen(true)}
              className="rounded-xl border border-orange-500/50 bg-orange-500/15 px-3 py-2 text-xs font-semibold text-orange-200 hover:bg-orange-500/25"
            >
              Nueva vacante
            </button>
          ) : null}
        </div>
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-zinc-400 border-l-2 border-amber-500/40 pl-3">
        <strong>Nota metodológica:</strong> el costo real del mes suma la remuneración diaria de referencia (salario
        básico diario del tabulador convencional junio 2023 + bono de asistencia prorrateado,{' '}
        <strong>Cl. 41</strong>) por cada empleado vinculado a la obra. Si tu política interna o la{' '}
        <strong>Cl. 33</strong> implican otro criterio de asignación salarial, contrasta con asesoría legal antes de
        tomar decisiones.
      </p>

      {error ? <div className="mt-4">{error}</div> : null}

      {loading ? (
        <p className="mt-6 text-sm text-zinc-500">Lectura de Supabase y cálculos…</p>
      ) : analisis ? (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.04] p-4">
              <p className="text-[10px] font-bold uppercase text-zinc-500">Presupuesto MD (ref.)</p>
              <p className="text-xl font-bold text-white mt-1">
                {formatoVES(analisis.presupuestoManoObraReferenciaVES)} VES
              </p>
              {analisis.obra.presupuestoVesFallback != null ? (
                <p className="text-[10px] text-zinc-500 mt-1">Usando presupuesto general (sin MD específico).</p>
              ) : null}
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.04] p-4">
              <p className="text-[10px] font-bold uppercase text-zinc-500">Costo real (mes)</p>
              <p className="text-xl font-bold text-amber-400 mt-1">{formatoVES(analisis.costoRealMesVES)} VES</p>
              <p className="text-[10px] text-zinc-500 mt-1">
                Desviación:{' '}
                <span className={analisis.desviacionManoObraVES > 0 ? 'text-red-400 font-semibold' : 'text-emerald-400'}>
                  {analisis.desviacionManoObraVES >= 0 ? '+' : ''}
                  {formatoVES(analisis.desviacionManoObraVES)} VES
                </span>
                {analisis.desviacionManoObraPct != null ? (
                  <span> ({analisis.desviacionManoObraPct >= 0 ? '+' : ''}
                  {analisis.desviacionManoObraPct}%)</span>
                ) : null}
              </p>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.04] p-4">
              <p className="text-[10px] font-bold uppercase text-zinc-500">Liquidación proyectada (fin mes)</p>
              <p className="text-xl font-bold text-white mt-1">
                {formatoVES(analisis.liquidacionProyectadaTotalVES)} VES
              </p>
              <p className="text-[10px] text-zinc-500 mt-1">
                Simulación cierre de obra por persona (conv. 2023; contexto Cl. 12–13 en metadatos del motor).
              </p>
            </div>
          </div>

          {alertaReserva ? (
            <div
              className="mt-6 rounded-xl border border-red-500/35 bg-red-950/40 px-4 py-3 text-sm text-red-200"
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
            <p className="mt-4 text-xs text-zinc-500">
              Sin <code className="rounded bg-white/10 px-1 text-zinc-200">fondo_reserva_liquidacion_ves</code> en la obra no se
              dispara la alerta roja. Migra 035 y carga el monto en Supabase.
            </p>
          ) : (
            <p className="mt-4 text-xs text-emerald-400">
              La suma de liquidaciones simuladas no supera el fondo de reserva ({formatoVES(analisis.obra.fondoReservaLiquidacionVES)} VES).
            </p>
          )}

          <div className="mt-8 h-64 w-full">
            <p className="text-xs font-bold uppercase text-zinc-500 mb-2">Presupuesto vs gastado (mes)</p>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="nombre" tick={{ fill: '#a1a1aa', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fill: '#a1a1aa', fontSize: 11 }}
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
                  contentStyle={{
                    borderRadius: 12,
                    border: '1px solid rgba(255,255,255,0.12)',
                    background: 'rgba(24,24,27,0.95)',
                    color: '#fafafa',
                  }}
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
              <h3 className="text-sm font-bold uppercase tracking-wide text-zinc-500">IA — distribución de niveles</h3>
              <button
                type="button"
                onClick={() => void consultarGemini()}
                disabled={geminiLoading}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                {geminiLoading ? 'Consultando Gemini…' : 'Analizar con Gemini'}
              </button>
            </div>
            <p className="text-[11px] text-zinc-500 mt-1">
              Prompt: «Analiza si la distribución de niveles (ej. demasiados maestros de obra nivel 9 vs. pocos
              ayudantes nivel 2) es óptima para el presupuesto asignado».
            </p>
            {geminiMeta ? <p className="text-[10px] text-zinc-500 mt-2">{geminiMeta}</p> : null}
            {geminiTexto ? (
              <div className="mt-3 rounded-xl border border-indigo-500/25 bg-indigo-950/40 p-4 text-sm text-zinc-200 whitespace-pre-wrap">
                {geminiTexto}
              </div>
            ) : null}
          </div>

          <div className="mt-10 overflow-x-auto rounded-xl border border-white/[0.06]">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-white/[0.05] text-xs uppercase text-zinc-500">
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
                    <td colSpan={7} className="p-6 text-center text-zinc-500">
                      No hay empleados en <code className="text-xs">ci_obra_empleados</code> para esta obra.
                    </td>
                  </tr>
                ) : (
                  analisis.filas.map((f) => (
                    <tr key={f.empleadoId} className="border-t border-white/[0.06] hover:bg-white/[0.04]">
                      <td className="p-3">
                        <div className="font-medium text-white">{f.nombre}</div>
                        <div className="text-[11px] text-zinc-500">{f.cargoNombre ?? '—'}</div>
                      </td>
                      <td className="p-3 font-mono text-zinc-300">{f.nivel}</td>
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

      {analisis && !error ? (
        <ModalNuevaVacante
          open={vacanteOpen}
          onClose={() => setVacanteOpen(false)}
          proyectoId={proyectoId}
          diasLaboradosMes={(() => {
            const n = Number(diasMes);
            return Number.isFinite(n) && n >= 1 ? Math.min(31, Math.floor(n)) : diasLaboradosMesReferencia;
          })()}
          añoMes={añoMes}
          analisis={{
            costoRealMesVES: analisis.costoRealMesVES,
            presupuestoManoObraReferenciaVES: analisis.presupuestoManoObraReferenciaVES,
            filas: analisis.filas.map((f) => ({
              nombre: f.nombre,
              nivel: f.nivel,
              totalAcumuladoMesVES: f.totalAcumuladoMesVES,
            })),
            obra: { nombre: analisis.obra.nombre },
          }}
        />
      ) : null}
    </section>
  );
}
