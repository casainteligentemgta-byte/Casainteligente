'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  CheckCircle2,
  Hourglass,
  Lightbulb,
  Loader2,
  Pin,
  RotateCcw,
  Save,
  Target,
  TrendingUp,
} from 'lucide-react';
import {
  esCapituloModulo,
  estimadoProyectado,
  type CcoPresupuestoFila,
  type CcoPresupuestosResumen,
} from '@/lib/contabilidad/cco/cargarPresupuestos';

function fmtUsd(n: number): string {
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtM2(n: number): string {
  return `${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m²`;
}

function fmtUsdM2(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return 'N/A';
  return `${fmtUsd(n)} /m²`;
}

type EditField = 'estimado' | 'pct' | 'area';

type Draft = {
  estimado: string;
  pct: string;
  area: string;
};

type Vista = CcoPresupuestoFila & { dirty?: boolean; draft?: Draft };

function toDraft(f: CcoPresupuestoFila): Draft {
  const est = estimadoProyectado(f.estimado_usd, f.ejecutado_usd);
  const pct =
    est > 0 ? Math.min(999, Math.round((f.ejecutado_usd / est) * 10000) / 100) : 0;
  return {
    estimado: String(f.estimado_usd > 0 ? f.estimado_usd : est),
    pct: pct.toFixed(2),
    area: String(f.area_m2 ?? 0),
  };
}

function liveFromDraft(f: Vista): {
  estimado: number;
  pct: number;
  area: number;
  restante: number;
  ejecutadoM2: number | null;
  estimadoM2: number | null;
} {
  const d = f.draft ?? toDraft(f);
  let estimado = Number(d.estimado);
  if (!Number.isFinite(estimado) || estimado < 0) estimado = 0;
  if (estimado === 0 && f.estimado_usd === 0) {
    estimado = f.ejecutado_usd;
  }
  const area = Math.max(0, Number(d.area) || 0);
  const restante = estimado - f.ejecutado_usd;
  const pct = estimado > 0 ? Math.min(999, (f.ejecutado_usd / estimado) * 100) : 0;
  return {
    estimado,
    pct,
    area,
    restante,
    ejecutadoM2: area > 0 ? f.ejecutado_usd / area : null,
    estimadoM2: area > 0 ? estimado / area : null,
  };
}

const emptyAnalisis: CcoPresupuestosResumen['analisisM2'] = {
  modulosEjecutado: 0,
  modulosEstimado: 0,
  obrasEjecutado: 0,
  obrasEstimado: 0,
  modulosEjecutadoM2: null,
  modulosEstimadoM2: null,
  obrasEjecutadoM2: null,
  obrasEstimadoM2: null,
  modulosRestanteM2: null,
  obrasRestanteM2: null,
  totalRestanteM2: null,
  costoTotalRealM2: null,
  costoTotalProyectadoM2: null,
};

export default function CcoTabPresupuestos({ proyectoId }: { proyectoId: string }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [filas, setFilas] = useState<Vista[]>([]);
  const [editing, setEditing] = useState<{ id: string; field: EditField } | null>(null);
  const [areaTotalServer, setAreaTotalServer] = useState(0);
  const [areaModulosServer, setAreaModulosServer] = useState(0);

  const cargar = useCallback(async () => {
    if (!proyectoId) return;
    setLoading(true);
    setError(null);
    setHint(null);
    setOkMsg(null);
    try {
      const res = await fetch(
        `/api/contabilidad/cco/presupuestos?proyecto=${encodeURIComponent(proyectoId)}`,
        { cache: 'no-store' },
      );
      const json = await res.json();
      if (!res.ok || json.ok === false) {
        setHint(json.hint ?? null);
        throw new Error(json.error ?? 'Error');
      }
      const rows = (json.filas ?? []) as CcoPresupuestoFila[];
      setFilas(
        rows
          .slice()
          .sort((a, b) => b.ejecutado_usd - a.ejecutado_usd || a.capitulo.localeCompare(b.capitulo, 'es'))
          .map((f) => ({ ...f, dirty: false, draft: toDraft(f) })),
      );
      setAreaTotalServer(Number(json.areaTotalM2) || 0);
      setAreaModulosServer(Number(json.areaModulosM2) || 0);
      setEditing(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
      setFilas([]);
    } finally {
      setLoading(false);
    }
  }, [proyectoId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const dirtyCount = filas.filter((f) => f.dirty).length;

  const kpis = useMemo(() => {
    let totalEjecutado = 0;
    let totalEstimado = 0;
    let areaTotal = 0;
    let areaModulos = 0;
    let modulosEjecutado = 0;
    let modulosEstimado = 0;
    let obrasEjecutado = 0;
    let obrasEstimado = 0;

    for (const f of filas) {
      const live = liveFromDraft(f);
      totalEjecutado += f.ejecutado_usd;
      totalEstimado += live.estimado;
      areaTotal += live.area;
      const esMod = esCapituloModulo(f.capitulo);
      if (esMod) {
        areaModulos += live.area;
        modulosEjecutado += f.ejecutado_usd;
        modulosEstimado += live.estimado;
      } else {
        obrasEjecutado += f.ejecutado_usd;
        obrasEstimado += live.estimado;
      }
    }

    const restante = totalEstimado - totalEjecutado;
    const avance =
      totalEstimado > 0
        ? Math.min(999, Math.round((totalEjecutado / totalEstimado) * 10000) / 100)
        : 0;
    const baseM2 = areaModulos > 0 ? areaModulos : areaTotal;
    const div = (n: number) => (baseM2 > 0 ? Math.round((n / baseM2) * 100) / 100 : null);
    const divTotal = (n: number) =>
      areaTotal > 0 ? Math.round((n / areaTotal) * 100) / 100 : null;

    return {
      totalEjecutado,
      totalEstimado,
      restante,
      avance,
      areaTotal,
      areaModulos,
      costoRealM2: divTotal(totalEjecutado),
      costoProyectadoM2: divTotal(totalEstimado),
      analisis: {
        modulosEjecutado,
        modulosEstimado,
        obrasEjecutado,
        obrasEstimado,
        modulosEjecutadoM2: div(modulosEjecutado),
        modulosEstimadoM2: div(modulosEstimado),
        obrasEjecutadoM2: div(obrasEjecutado),
        obrasEstimadoM2: div(obrasEstimado),
        modulosRestanteM2: div(modulosEstimado - modulosEjecutado),
        obrasRestanteM2: div(obrasEstimado - obrasEjecutado),
        totalRestanteM2: div(restante),
        costoTotalRealM2: div(totalEjecutado),
        costoTotalProyectadoM2: div(totalEstimado),
      } satisfies CcoPresupuestosResumen['analisisM2'],
    };
  }, [filas]);

  const chartData = useMemo(() => {
    return filas
      .map((f) => {
        const live = liveFromDraft(f);
        const restante = Math.max(0, live.restante);
        const exceso = Math.max(0, -live.restante);
        return {
          capitulo: f.capitulo.length > 18 ? `${f.capitulo.slice(0, 16)}…` : f.capitulo,
          capituloFull: f.capitulo,
          ejecutado: Math.round(f.ejecutado_usd * 100) / 100,
          restante: Math.round(restante * 100) / 100,
          exceso: Math.round(exceso * 100) / 100,
          total: live.estimado,
        };
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, 20);
  }, [filas]);

  const patchDraft = (id: string, field: EditField, raw: string) => {
    setFilas((prev) =>
      prev.map((f) => {
        if (f.id !== id) return f;
        const draft = { ...(f.draft ?? toDraft(f)) };
        if (field === 'estimado') {
          draft.estimado = raw;
          const est = Number(raw);
          if (Number.isFinite(est) && est > 0) {
            draft.pct = ((f.ejecutado_usd / est) * 100).toFixed(2);
          } else {
            draft.pct = '0.00';
          }
        } else if (field === 'pct') {
          draft.pct = raw;
          const pct = Number(raw);
          if (Number.isFinite(pct) && pct > 0) {
            const nuevoEst = Math.round((f.ejecutado_usd / (pct / 100)) * 100) / 100;
            draft.estimado = String(nuevoEst);
          }
        } else {
          draft.area = raw;
        }
        return { ...f, dirty: true, draft };
      }),
    );
  };

  const guardar = async () => {
    const cambios = filas
      .filter((f) => f.dirty && f.draft)
      .map((f) => {
        const live = liveFromDraft(f);
        // Persistir el estimado editado (aunque sea igual al ejecutado por proyección).
        const estimadoGuardar = Number(f.draft!.estimado);
        return {
          id: f.id,
          capitulo: f.capitulo,
          estimado_usd: Number.isFinite(estimadoGuardar) ? Math.max(0, estimadoGuardar) : live.estimado,
          area_m2: live.area,
        };
      });
    if (!cambios.length) {
      setOkMsg('No hay cambios pendientes.');
      return;
    }
    setSaving(true);
    setError(null);
    setHint(null);
    try {
      const res = await fetch('/api/contabilidad/cco/presupuestos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proyecto_id: proyectoId, cambios }),
      });
      const json = await res.json();
      if (!res.ok || (json.ok === false && !(json.updated > 0))) {
        throw new Error(json.error ?? 'No se pudo guardar');
      }
      const extra =
        Array.isArray(json.errores) && json.errores.length
          ? ` · avisos: ${json.errores[0]}`
          : '';
      setOkMsg(`Guardados ${json.updated ?? cambios.length} cambio(s) de presupuestos.${extra}`);
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const restablecerVista = () => {
    setEditing(null);
    void cargar();
  };

  if (!proyectoId) {
    return (
      <div style={box}>
        <h3 style={h3}>Presupuestos</h3>
        <p style={muted}>Selecciona una obra para ver estimado vs ejecutado por capítulo.</p>
      </div>
    );
  }

  const analisis = kpis.analisis ?? emptyAnalisis;
  const chartH = Math.max(280, chartData.length * 28 + 60);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* ── Resumen general ── */}
      <div style={box}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 10,
            marginBottom: 12,
          }}
        >
          <div>
            <h3 style={{ ...h3, margin: 0 }}>Resumen General del Presupuesto</h3>
            <p style={{ ...muted, margin: '4px 0 0' }}>
              Totales proyectados vs costo real acumulado por capítulos CCO.
            </p>
          </div>
          <button type="button" onClick={restablecerVista} style={btnGhost}>
            <RotateCcw size={14} /> Restablecer Vista de Presupuesto
          </button>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 10,
          }}
        >
          <KpiCard
            icon={<TrendingUp size={18} color="#DC2626" />}
            title="TOTAL EJECUTADO"
            value={fmtUsd(kpis.totalEjecutado)}
            sub="↑ Costo Real Acumulado"
            subColor="#B91C1C"
          />
          <KpiCard
            icon={<Target size={18} color="#2563EB" />}
            title="TOTAL ESTIMADO"
            value={fmtUsd(kpis.totalEstimado)}
            sub="↑ Proyección de Costos"
            subColor="#1D4ED8"
          />
          <KpiCard
            icon={<Hourglass size={18} color="#0F766E" />}
            title="RESTANTE / MARGEN"
            value={fmtUsd(kpis.restante)}
            sub={kpis.restante >= 0 ? '↑ Disponible' : '↑ Exceso'}
            subColor={kpis.restante >= 0 ? '#15803D' : '#B91C1C'}
          />
          <KpiCard
            icon={<CheckCircle2 size={18} color="#15803D" />}
            title="AVANCE CONTABLE TOTAL"
            value={`${kpis.avance.toFixed(2)}%`}
            sub="↑ Porcentaje de Ejecución"
            subColor={kpis.avance > 100 ? '#B91C1C' : '#15803D'}
          />
        </div>
      </div>

      {/* ── Comparativa + tabla editable ── */}
      <div style={box}>
        <h3 style={{ ...h3, margin: '0 0 4px' }}>Comparativa y Control de Presupuesto Estimado</h3>
        <p style={{ ...muted, margin: '0 0 12px' }}>
          Compara el Monto Ejecutado con un Monto Estimado definido por ti para cada capítulo, proyecta
          costos y calcula el costo por metro cuadrado ($/m²).
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 10,
            marginBottom: 14,
          }}
        >
          <KpiCard
            title="ÁREA TOTAL DE CONSTRUCCIÓN (m²)"
            value={fmtM2(kpis.areaTotal || areaTotalServer)}
            sub="Suma de las áreas de los capítulos"
          />
          <KpiCard
            title="COSTO REAL EJECUTADO POR m²"
            value={fmtUsdM2(kpis.costoRealM2)}
            sub={
              kpis.costoRealM2 == null
                ? 'Ingresa un área para calcular'
                : `= ${fmtUsd(kpis.totalEjecutado)} ÷ ${fmtM2(kpis.areaTotal)}`
            }
          />
          <KpiCard
            title="COSTO TOTAL PROYECTADO POR m²"
            value={fmtUsdM2(kpis.costoProyectadoM2)}
            sub={
              kpis.costoProyectadoM2 == null
                ? 'Ingresa un área para calcular'
                : `= ${fmtUsd(kpis.totalEstimado)} ÷ ${fmtM2(kpis.areaTotal)}`
            }
          />
        </div>

        <div
          style={{
            background: '#FFFBEB',
            border: '1px solid #FDE68A',
            borderRadius: 12,
            padding: '10px 14px',
            marginBottom: 12,
            fontSize: 13,
            color: '#78350F',
            display: 'flex',
            gap: 10,
            alignItems: 'flex-start',
          }}
        >
          <Lightbulb size={16} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>
            Haz <strong>doble clic</strong> en las celdas de <strong>Monto Estimado (USD)</strong>,{' '}
            <strong>% Ejecución</strong> o <strong>Área Capítulo (m²)</strong> para editarlas. Al
            cambiar el %, se recalcula el estimado (= ejecutado ÷ %).
          </span>
        </div>

        {error ? (
          <p style={{ color: '#B91C1C', fontSize: 13 }}>
            {error}
            {hint ? ` · ${hint}` : ''}
          </p>
        ) : null}
        {okMsg ? <p style={{ color: '#15803D', fontSize: 13 }}>{okMsg}</p> : null}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <h4 style={{ margin: 0, fontSize: 14, fontWeight: 800 }}>Modificar Presupuesto Estimado</h4>
          <button type="button" onClick={() => void cargar()} style={btn}>
            Actualizar
          </button>
        </div>

        {loading ? (
          <div style={{ display: 'flex', gap: 8, color: '#64748B', alignItems: 'center', marginTop: 12 }}>
            <Loader2 className="animate-spin" size={16} /> Cargando…
          </div>
        ) : (
          <div
            style={{
              overflow: 'auto',
              maxHeight: 520,
              border: '1px solid #E2E8F0',
              borderRadius: 10,
              marginTop: 10,
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#F1F5F9', textAlign: 'left' }}>
                  {[
                    'Capítulo',
                    'Monto Ejecutado (USD)',
                    'Monto Estimado (USD)',
                    '% EJECUCIÓN (EQ)',
                    'Restante / Desviación (USD)',
                    'ÁREA CAPÍTULO (m²)',
                    'Ejecutado USD/m²',
                    'Estimado USD/m²',
                  ].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: '8px 6px',
                        position: 'sticky',
                        top: 0,
                        background: '#F1F5F9',
                        fontWeight: 800,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filas.map((f, idx) => {
                  const live = liveFromDraft(f);
                  const d = f.draft ?? toDraft(f);
                  const isEdit = (field: EditField) =>
                    editing?.id === f.id && editing.field === field;
                  return (
                    <tr
                      key={f.id}
                      style={{
                        borderTop: '1px solid #E2E8F0',
                        background: f.dirty ? '#FFF7ED' : idx % 2 ? '#F8FAFC' : '#fff',
                      }}
                    >
                      <td style={td}>
                        <strong>{f.capitulo}</strong>
                        {f.id.startsWith('exec-') ? (
                          <span style={{ display: 'block', fontSize: 10, color: '#94A3B8' }}>
                            sin fila presupuesto
                          </span>
                        ) : null}
                      </td>
                      <td style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>
                        {fmtUsd(f.ejecutado_usd)}
                      </td>
                      <td
                        style={{ ...td, fontVariantNumeric: 'tabular-nums', cursor: 'cell' }}
                        onDoubleClick={() => setEditing({ id: f.id, field: 'estimado' })}
                        title="Doble clic para editar"
                      >
                        {isEdit('estimado') ? (
                          <input
                            autoFocus
                            value={d.estimado}
                            onChange={(e) => patchDraft(f.id, 'estimado', e.target.value)}
                            onBlur={() => setEditing(null)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === 'Escape') setEditing(null);
                            }}
                            style={{ ...inputCell, width: 110, textAlign: 'right' }}
                          />
                        ) : (
                          <span style={{ borderBottom: '1px dashed #94A3B8' }}>
                            {fmtUsd(live.estimado)}
                          </span>
                        )}
                      </td>
                      <td
                        style={{ ...td, cursor: 'cell' }}
                        onDoubleClick={() => setEditing({ id: f.id, field: 'pct' })}
                        title="Doble clic para editar %"
                      >
                        {isEdit('pct') ? (
                          <input
                            autoFocus
                            value={d.pct}
                            onChange={(e) => patchDraft(f.id, 'pct', e.target.value)}
                            onBlur={() => setEditing(null)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === 'Escape') setEditing(null);
                            }}
                            style={{ ...inputCell, width: 72, textAlign: 'right' }}
                          />
                        ) : (
                          <span
                            style={{
                              fontWeight: 800,
                              color:
                                live.pct > 100 ? '#B91C1C' : live.pct > 80 ? '#B45309' : '#15803D',
                              borderBottom: '1px dashed #94A3B8',
                            }}
                          >
                            {live.pct.toFixed(2)}%
                          </span>
                        )}
                      </td>
                      <td
                        style={{
                          ...td,
                          fontVariantNumeric: 'tabular-nums',
                          fontWeight: 700,
                          color: live.restante < 0 ? '#B91C1C' : '#0F172A',
                        }}
                      >
                        {fmtUsd(live.restante)}
                      </td>
                      <td
                        style={{ ...td, fontVariantNumeric: 'tabular-nums', cursor: 'cell' }}
                        onDoubleClick={() => setEditing({ id: f.id, field: 'area' })}
                        title="Doble clic para editar área"
                      >
                        {isEdit('area') ? (
                          <input
                            autoFocus
                            value={d.area}
                            onChange={(e) => patchDraft(f.id, 'area', e.target.value)}
                            onBlur={() => setEditing(null)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === 'Escape') setEditing(null);
                            }}
                            style={{ ...inputCell, width: 80, textAlign: 'right' }}
                          />
                        ) : (
                          <span style={{ borderBottom: '1px dashed #94A3B8' }}>
                            {live.area.toFixed(2)} m²
                          </span>
                        )}
                      </td>
                      <td style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>
                        {live.ejecutadoM2 != null ? fmtUsd(live.ejecutadoM2) : '—'}
                      </td>
                      <td style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>
                        {live.estimadoM2 != null ? fmtUsd(live.estimadoM2) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filas.length === 0 ? <p style={{ ...muted, padding: 12 }}>Sin presupuestos ni egresos por capítulo.</p> : null}
          </div>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 14 }}>
          <button
            type="button"
            onClick={() => void guardar()}
            disabled={saving || dirtyCount === 0}
            style={{ ...btnSave, opacity: saving || dirtyCount === 0 ? 0.55 : 1 }}
          >
            {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
            Guardar Cambios de Presupuestos
            {dirtyCount > 0 ? ` (${dirtyCount})` : ''}
          </button>
        </div>
      </div>

      {/* ── Análisis $/m² ── */}
      <div style={box}>
        <h3 style={{ ...h3, margin: '0 0 4px' }}>Análisis de Costo por Metro Cuadrado</h3>
        <p style={{ ...muted, margin: '0 0 14px' }}>
          Base: <strong>{fmtM2(kpis.areaModulos || areaModulosServer)}</strong> de módulos · Obras
          generales ejecutadas: {fmtUsd(analisis.obrasEjecutado)} · Obras generales proyectadas:{' '}
          {fmtUsd(analisis.obrasEstimado)}
        </p>

        <SectionTitle icon={<Pin size={14} />} title="Costos Reales Ejecutados" />
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 10,
            marginBottom: 16,
          }}
        >
          <KpiCard
            title="MÓDULOS EJECUTADO/m²"
            value={fmtUsdM2(analisis.modulosEjecutadoM2) === 'N/A' ? '$ 0.00 /m²' : fmtUsdM2(analisis.modulosEjecutadoM2)}
            sub={`↑ Total módulos: ${fmtUsd(analisis.modulosEjecutado)}`}
          />
          <KpiCard
            title="OBRAS GENERALES EJECUTADO/m²"
            value={fmtUsdM2(analisis.obrasEjecutadoM2) === 'N/A' ? '$ 0.00 /m²' : fmtUsdM2(analisis.obrasEjecutadoM2)}
            sub={`↑ Total obras gral.: ${fmtUsd(analisis.obrasEjecutado)}`}
          />
          <KpiCard
            title="COSTO TOTAL REAL/m²"
            value={fmtUsdM2(analisis.costoTotalRealM2) === 'N/A' ? '$ 0.00 /m²' : fmtUsdM2(analisis.costoTotalRealM2)}
            sub={`↑ = ${fmtUsd(kpis.totalEjecutado)} ÷ ${Math.round(kpis.areaModulos || areaModulosServer)} m²`}
          />
        </div>

        <SectionTitle icon={<Hourglass size={14} />} title="Costos Restantes por Ejecutar (Pendiente)" />
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 10,
            marginBottom: 16,
          }}
        >
          <KpiCard
            title="MÓDULOS POR EJECUTAR/m²"
            value={fmtUsdM2(analisis.modulosRestanteM2) === 'N/A' ? '$ 0.00 /m²' : fmtUsdM2(analisis.modulosRestanteM2)}
            sub={`↑ Restante: ${fmtUsd(analisis.modulosEstimado - analisis.modulosEjecutado)}`}
          />
          <KpiCard
            title="OBRAS GENERALES POR EJECUTAR/m²"
            value={fmtUsdM2(analisis.obrasRestanteM2) === 'N/A' ? '$ 0.00 /m²' : fmtUsdM2(analisis.obrasRestanteM2)}
            sub={`↑ Restante: ${fmtUsd(analisis.obrasEstimado - analisis.obrasEjecutado)}`}
          />
          <KpiCard
            title="COSTO TOTAL POR EJECUTAR/m²"
            value={fmtUsdM2(analisis.totalRestanteM2) === 'N/A' ? '$ 0.00 /m²' : fmtUsdM2(analisis.totalRestanteM2)}
            sub={`↑ = ${fmtUsd(kpis.restante)} ÷ ${Math.round(kpis.areaModulos || areaModulosServer)} m²`}
          />
        </div>

        <SectionTitle icon={<Target size={14} />} title="Costos Proyectados (Estimados)" />
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 10,
          }}
        >
          <KpiCard
            title="MÓDULOS PROYECTADO/m²"
            value={fmtUsdM2(analisis.modulosEstimadoM2) === 'N/A' ? '$ 0.00 /m²' : fmtUsdM2(analisis.modulosEstimadoM2)}
            sub={`↑ Total módulos est.: ${fmtUsd(analisis.modulosEstimado)}`}
          />
          <KpiCard
            title="OBRAS GENERALES PROYECTADO/m²"
            value={fmtUsdM2(analisis.obrasEstimadoM2) === 'N/A' ? '$ 0.00 /m²' : fmtUsdM2(analisis.obrasEstimadoM2)}
            sub={`↑ Total obras gral. est.: ${fmtUsd(analisis.obrasEstimado)}`}
          />
          <KpiCard
            title="COSTO TOTAL PROYECTADO/m²"
            value={
              fmtUsdM2(analisis.costoTotalProyectadoM2) === 'N/A'
                ? '$ 0.00 /m²'
                : fmtUsdM2(analisis.costoTotalProyectadoM2)
            }
            sub={`↑ = TOTAL ESTIMADO ÷ ${Math.round(kpis.areaModulos || areaModulosServer)} m²`}
          />
        </div>
      </div>

      {/* ── Gráfico comparativo ── */}
      <div style={box}>
        <h3 style={{ ...h3, margin: '0 0 4px' }}>
          Gráfico Comparativo: Progreso del Presupuesto por Capítulo
        </h3>
        <p style={{ ...muted, margin: '0 0 12px' }}>
          Barras apiladas: ejecutado real, margen restante y exceso sobre el estimado.
        </p>
        {chartData.length === 0 ? (
          <p style={muted}>Sin datos para graficar.</p>
        ) : (
          <div style={{ width: '100%', height: chartH, minWidth: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={chartData}
                margin={{ top: 8, right: 16, left: 4, bottom: 8 }}
              >
                <CartesianGrid stroke="#E2E8F0" strokeDasharray="3 3" horizontal={false} />
                <XAxis
                  type="number"
                  tickFormatter={(v) =>
                    Number(v) >= 1000 ? `${Math.round(Number(v) / 1000)}k` : String(v)
                  }
                  tick={{ fill: '#64748B', fontSize: 11 }}
                  label={{
                    value: 'Monto (USD)',
                    position: 'insideBottom',
                    offset: -2,
                    style: { fill: '#64748B', fontSize: 11 },
                  }}
                />
                <YAxis
                  type="category"
                  dataKey="capitulo"
                  width={110}
                  tick={{ fill: '#475569', fontSize: 11 }}
                  interval={0}
                />
                <Tooltip
                  labelFormatter={(_, payload) => {
                    const p = payload?.[0]?.payload as { capituloFull?: string } | undefined;
                    return p?.capituloFull ?? '';
                  }}
                  formatter={(v, name) => [fmtUsd(Number(v)), String(name)]}
                />
                <Legend />
                <Bar dataKey="ejecutado" stackId="p" fill="#991B1B" name="Ejecutado (Real)" />
                <Bar dataKey="restante" stackId="p" fill="#3B82F6" name="Restante (Margen)" />
                <Bar dataKey="exceso" stackId="p" fill="#78350F" name="Exceso (Desviación)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

function KpiCard({
  title,
  value,
  sub,
  subColor,
  icon,
}: {
  title: string;
  value: string;
  sub?: string;
  subColor?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div style={{ ...box, padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        {icon}
        <p style={{ ...muted, margin: 0, fontSize: 11, fontWeight: 800 }}>{title}</p>
      </div>
      <p style={{ margin: '4px 0 0', fontSize: 18, fontWeight: 800, color: '#0F172A' }}>{value}</p>
      {sub ? (
        <p style={{ margin: '6px 0 0', fontSize: 11, fontWeight: 600, color: subColor ?? '#64748B' }}>
          {sub}
        </p>
      ) : null}
    </div>
  );
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
        fontWeight: 800,
        fontSize: 13,
        color: '#0F172A',
      }}
    >
      {icon}
      {title}
    </div>
  );
}

const box: React.CSSProperties = {
  background: '#fff',
  borderRadius: 14,
  border: '1px solid #E2E8F0',
  padding: 16,
};
const h3: React.CSSProperties = { fontSize: 16, fontWeight: 800 };
const muted: React.CSSProperties = { color: '#64748B', fontSize: 13, margin: '8px 0 12px' };
const td: React.CSSProperties = { padding: '7px 6px', verticalAlign: 'middle', color: '#334155' };
const inputCell: React.CSSProperties = {
  width: '100%',
  border: '1px solid #CBD5E1',
  borderRadius: 6,
  padding: '4px 6px',
  fontSize: 12,
  color: '#0F172A',
};
const btn: React.CSSProperties = {
  border: '1px solid #CBD5E1',
  background: '#fff',
  borderRadius: 8,
  padding: '6px 12px',
  fontWeight: 700,
  cursor: 'pointer',
  fontSize: 13,
};
const btnGhost: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  border: '1px solid #CBD5E1',
  background: '#F8FAFC',
  borderRadius: 8,
  padding: '8px 12px',
  fontWeight: 700,
  cursor: 'pointer',
  fontSize: 12,
  color: '#334155',
};
const btnSave: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  border: 'none',
  background: '#DC2626',
  color: '#fff',
  borderRadius: 10,
  padding: '10px 16px',
  fontWeight: 800,
  cursor: 'pointer',
  fontSize: 13,
};
