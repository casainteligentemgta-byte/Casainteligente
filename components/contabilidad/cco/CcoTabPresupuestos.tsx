'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
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
import type {
  CcoPresupuestoCapituloAgg,
  CcoPresupuestoFila,
} from '@/lib/contabilidad/cco/cargarPresupuestos';

function fmtUsd(n: number): string {
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtUsdTick(n: number): string {
  if (Math.abs(n) >= 1000) return `${Math.round(n / 1000)}k`;
  return String(Math.round(n));
}

type Totales = {
  estimado: number;
  ejecutado: number;
  saldo: number;
  avancePct: number;
  areaM2: number | null;
  costoRealM2: number | null;
  costoProyectadoM2: number | null;
};

export default function CcoTabPresupuestos({ proyectoId }: { proyectoId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filas, setFilas] = useState<CcoPresupuestoFila[]>([]);
  const [porCapitulo, setPorCapitulo] = useState<CcoPresupuestoCapituloAgg[]>([]);
  const [totales, setTotales] = useState<Totales>({
    estimado: 0,
    ejecutado: 0,
    saldo: 0,
    avancePct: 0,
    areaM2: null,
    costoRealM2: null,
    costoProyectadoM2: null,
  });

  const cargar = useCallback(async () => {
    if (!proyectoId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/contabilidad/cco/presupuestos?proyecto=${encodeURIComponent(proyectoId)}`,
        { cache: 'no-store' },
      );
      const json = await res.json();
      if (!res.ok || json.ok === false) throw new Error(json.error ?? 'Error');
      setFilas(json.filas ?? []);
      setPorCapitulo(json.porCapitulo ?? []);
      setTotales({
        estimado: Number(json.totalEstimado) || 0,
        ejecutado: Number(json.totalEjecutado) || 0,
        saldo: Number(json.totalSaldo) || 0,
        avancePct: Number(json.avancePct) || 0,
        areaM2: json.areaM2 != null ? Number(json.areaM2) : null,
        costoRealM2: json.costoRealM2 != null ? Number(json.costoRealM2) : null,
        costoProyectadoM2: json.costoProyectadoM2 != null ? Number(json.costoProyectadoM2) : null,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
      setFilas([]);
      setPorCapitulo([]);
    } finally {
      setLoading(false);
    }
  }, [proyectoId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const chartData = useMemo(
    () =>
      [...porCapitulo]
        .sort((a, b) => a.capitulo.localeCompare(b.capitulo, 'es'))
        .map((c) => ({
          name: c.capitulo.length > 18 ? `${c.capitulo.slice(0, 16)}…` : c.capitulo,
          full: c.capitulo,
          ejecutado: Math.round(c.ejecutado_usd * 100) / 100,
          restante: Math.round(c.restante_usd * 100) / 100,
          exceso: Math.round(c.exceso_usd * 100) / 100,
        })),
    [porCapitulo],
  );

  if (!proyectoId) {
    return (
      <div style={box}>
        <h3 style={h3}>Presupuestos</h3>
        <p style={muted}>Selecciona una obra para ver estimado vs ejecutado por capítulo.</p>
      </div>
    );
  }

  const kpisM2 = [
    {
      t: 'ÁREA TOTAL DE CONSTRUCCIÓN (m²)',
      v: totales.areaM2 != null ? `${totales.areaM2.toLocaleString('es-VE', { minimumFractionDigits: 2 })} m²` : '—',
      f: totales.areaM2 != null ? 'Suma / config de obra (Ajustes CCO)' : 'Define área m² en Ajustes CCO',
    },
    {
      t: 'COSTO REAL EJECUTADO POR m²',
      v: totales.costoRealM2 != null ? `${fmtUsd(totales.costoRealM2)} / m²` : '—',
      f: 'Gastado hasta el momento',
    },
    {
      t: 'COSTO TOTAL PROYECTADO POR m²',
      v: totales.costoProyectadoM2 != null ? `${fmtUsd(totales.costoProyectadoM2)} / m²` : '—',
      f: 'Presupuesto estimado total',
    },
  ];

  const kpisResumen = [
    { t: 'TOTAL EJECUTADO', v: fmtUsd(totales.ejecutado), f: 'Costo real acumulado' },
    { t: 'TOTAL ESTIMADO', v: fmtUsd(totales.estimado), f: 'Proyección de costos' },
    { t: 'RESTANTE / MARGEN', v: fmtUsd(totales.saldo), f: 'Disponible' },
    {
      t: 'AVANCE CONTABLE TOTAL',
      v: `${totales.avancePct.toFixed(2)}%`,
      f: 'Porcentaje de ejecución',
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
        {kpisM2.map((k) => (
          <div key={k.t} style={{ ...box, padding: '14px 16px' }}>
            <p style={{ ...muted, margin: 0, fontSize: 10, fontWeight: 800, letterSpacing: 0.3 }}>{k.t}</p>
            <p style={{ margin: '8px 0 4px', fontSize: 20, fontWeight: 800, color: '#0F172A' }}>{k.v}</p>
            <p style={{ margin: 0, fontSize: 11, color: '#94A3B8' }}>{k.f}</p>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
        {kpisResumen.map((k) => (
          <div key={k.t} style={{ ...box, padding: '12px 14px' }}>
            <p style={{ ...muted, margin: 0, fontSize: 10, fontWeight: 800 }}>{k.t}</p>
            <p style={{ margin: '6px 0 2px', fontSize: 18, fontWeight: 800 }}>{k.v}</p>
            <p style={{ margin: 0, fontSize: 11, color: '#94A3B8' }}>{k.f}</p>
          </div>
        ))}
      </div>

      <div style={box}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <div>
            <h3 style={{ ...h3, margin: 0 }}>Resumen por capítulo</h3>
            <p style={{ ...muted, margin: '6px 0 0' }}>
              Equivalente a «Modificar presupuesto estimado» / progreso V4.
            </p>
          </div>
          <button type="button" onClick={() => void cargar()} style={btn}>
            Actualizar
          </button>
        </div>
        {error ? <p style={{ color: '#B91C1C', fontSize: 13 }}>{error}</p> : null}
        {loading ? (
          <div style={{ display: 'flex', gap: 8, color: '#64748B', alignItems: 'center' }}>
            <Loader2 className="animate-spin" size={16} /> Cargando…
          </div>
        ) : (
          <div style={{ overflow: 'auto', maxHeight: 420 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#F1F5F9', textAlign: 'left' }}>
                  {['CAPÍTULO', 'EJECUTADO', 'ESTIMADO', '% EJECUCIÓN', 'RESTANTE / DESVIACIÓN'].map((h) => (
                    <th key={h} style={{ padding: '8px 6px', position: 'sticky', top: 0, background: '#F1F5F9' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {porCapitulo.map((f) => (
                  <tr key={f.capitulo} style={{ borderTop: '1px solid #E2E8F0' }}>
                    <td style={td}>
                      <strong>{f.capitulo}</strong>
                    </td>
                    <td style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>{fmtUsd(f.ejecutado_usd)}</td>
                    <td style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>{fmtUsd(f.estimado_usd)}</td>
                    <td style={td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, height: 8, background: '#E2E8F0', borderRadius: 99, overflow: 'hidden', minWidth: 60 }}>
                          <div
                            style={{
                              width: `${Math.min(100, f.pct_ejecutado)}%`,
                              height: '100%',
                              background: f.pct_ejecutado > 100 ? '#DC2626' : f.pct_ejecutado > 80 ? '#F59E0B' : '#0D9488',
                            }}
                          />
                        </div>
                        <span
                          style={{
                            fontWeight: 800,
                            fontVariantNumeric: 'tabular-nums',
                            color: f.pct_ejecutado > 100 ? '#B91C1C' : '#0F172A',
                          }}
                        >
                          {f.pct_ejecutado.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                    <td
                      style={{
                        ...td,
                        fontVariantNumeric: 'tabular-nums',
                        fontWeight: 700,
                        color: f.exceso_usd > 0 ? '#B91C1C' : '#0F172A',
                      }}
                    >
                      {f.exceso_usd > 0 ? `Exceso ${fmtUsd(f.exceso_usd)}` : fmtUsd(f.restante_usd)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {porCapitulo.length === 0 ? <p style={muted}>Sin presupuestos para esta obra.</p> : null}
          </div>
        )}
      </div>

      <div style={box}>
        <h3 style={{ ...h3, marginBottom: 4 }}>Gráfico comparativo: progreso del presupuesto por capítulo</h3>
        <p style={{ ...muted, marginTop: 0 }}>
          Rojo = ejecutado · Azul = restante (margen) · Negro = exceso (desviación)
        </p>
        {chartData.length === 0 ? (
          <p style={muted}>Sin datos para graficar.</p>
        ) : (
          <div style={{ width: '100%', height: Math.max(280, chartData.length * 36) }}>
            <ResponsiveContainer>
              <BarChart data={chartData} layout="vertical" margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis type="number" tickFormatter={fmtUsdTick} tick={{ fill: '#64748B', fontSize: 11 }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={110}
                  tick={{ fill: '#334155', fontSize: 11 }}
                />
                <Tooltip
                  formatter={(value, name) => [fmtUsd(Number(value) || 0), String(name)]}
                  labelFormatter={(_, payload) => {
                    const p = payload?.[0]?.payload as { full?: string } | undefined;
                    return p?.full ?? '';
                  }}
                />
                <Legend />
                <Bar dataKey="ejecutado" name="Ejecutado (real)" stackId="a" fill="#DC2626" />
                <Bar dataKey="restante" name="Restante (margen)" stackId="a" fill="#2563EB" />
                <Bar dataKey="exceso" name="Exceso (desviación)" stackId="a" fill="#0F172A" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {filas.some((f) => f.subcapitulo) ? (
        <div style={box}>
          <h3 style={{ ...h3, margin: 0 }}>Detalle (subcapítulos)</h3>
          <p style={muted}>Filas importadas V4 con subcapítulo.</p>
          <div style={{ overflow: 'auto', maxHeight: 280 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#F1F5F9', textAlign: 'left' }}>
                  {['CAPÍTULO', 'SUB', 'ESTIMADO'].map((h) => (
                    <th key={h} style={{ padding: '8px 6px' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => (
                  <tr key={f.id} style={{ borderTop: '1px solid #E2E8F0' }}>
                    <td style={td}>{f.capitulo}</td>
                    <td style={td}>{f.subcapitulo ?? '—'}</td>
                    <td style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>{fmtUsd(f.estimado_usd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const box: React.CSSProperties = {
  background: '#fff',
  borderRadius: 14,
  border: '1px solid #E2E8F0',
  padding: 20,
};
const h3: React.CSSProperties = { fontSize: 16, fontWeight: 800 };
const muted: React.CSSProperties = { color: '#64748B', fontSize: 13, margin: '8px 0 12px' };
const td: React.CSSProperties = { padding: '8px 6px', verticalAlign: 'top', color: '#334155' };
const btn: React.CSSProperties = {
  border: '1px solid #CBD5E1',
  background: '#fff',
  borderRadius: 8,
  padding: '6px 12px',
  fontWeight: 700,
  cursor: 'pointer',
  fontSize: 13,
};
