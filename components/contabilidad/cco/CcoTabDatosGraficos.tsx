'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { CcoDashboard, CcoDetalleJerarquia } from '@/lib/contabilidad/cargarCcoDashboard';
import { CCO_TIPO_COLOR_PIE, colorTealPorValor, fmtUsdCorto } from '@/lib/contabilidad/ccoClasificarGasto';

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

const MQ_NARROW = '(max-width: 720px)';

function useNarrowScreen(): boolean {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia(MQ_NARROW);
    const apply = () => setNarrow(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);
  return narrow;
}

function truncLabel(s: string, max: number): string {
  const t = String(s ?? '').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(1, max - 1))}…`;
}

type Props = {
  data: CcoDashboard;
  modo: 'acumulado' | 'periodo';
};

/**
 * Visualizaciones gráficas de las series CCO V4
 * (evolución mensual, capítulos, proveedores, tipo de gasto y detalle jerárquico).
 */
export default function CcoTabDatosGraficos({ data, modo }: Props) {
  const narrow = useNarrowScreen();
  const [mostrarTablas, setMostrarTablas] = useState(false);

  const gastosMensual = data.gastosMensual ?? [];
  const topProveedores = useMemo(
    () =>
      [...(data.topProveedores ?? [])]
        .slice()
        .sort((a, b) => b.costo - a.costo)
        .slice(0, 10),
    [data.topProveedores],
  );
  const capitulosTotal = useMemo(() => {
    if (data.capitulosTotal?.length) return data.capitulosTotal;
    return (data.capitulos ?? []).map((c) => ({
      capitulo: c.cap,
      costo:
        c.admin +
        c.materiales +
        c.contratista +
        c.equipos +
        c.insumos +
        c.mano +
        c.transporte +
        c.permiso +
        c.proyecto,
    }));
  }, [data.capitulosTotal, data.capitulos]);

  const tiposPie = useMemo(
    () => [...(data.tiposPie ?? [])].sort((a, b) => b.value - a.value),
    [data.tiposPie],
  );
  const pieTotal = tiposPie.reduce((s, t) => s + t.value, 0) || 1;

  const detalle = data.detalleJerarquia ?? [];
  const flujo = modo === 'acumulado' ? data.flujoAcumulado : data.flujoPeriodo;

  const capChartH = Math.max(280, Math.min(capitulosTotal.length, 12) * 34 + 40);
  const provChartH = Math.max(280, topProveedores.length * 34 + 40);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={box}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div>
            <h3 style={h3}>Datos gráficos</h3>
            <p style={muted}>
              Visualización de las series CCO · modo{' '}
              <strong>{modo === 'acumulado' ? 'acumulado' : 'por período'}</strong>
              {data.proyectoNombre ? ` · ${data.proyectoNombre}` : ''} · {data.totalRegistros}{' '}
              registros
            </p>
          </div>
          <button
            type="button"
            onClick={() => setMostrarTablas((v) => !v)}
            style={toggleBtn}
          >
            {mostrarTablas ? 'Ocultar tablas' : 'Ver tablas'}
          </button>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: narrow ? '1fr' : '1fr 1fr',
          gap: 16,
        }}
      >
        <ChartPanel title="Evolución Mensual" empty={gastosMensual.length === 0} tall={300}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={gastosMensual} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
              <CartesianGrid stroke="#E2E8F0" strokeDasharray="3 3" />
              <XAxis dataKey="periodo" tick={{ fill: '#64748B', fontSize: 11 }} />
              <YAxis
                tickFormatter={fmtUsdTick}
                tick={{ fill: '#64748B', fontSize: 11 }}
                width={48}
              />
              <Tooltip formatter={(v) => fmtUsd(Number(v))} />
              <Bar dataKey="costo" name="Costo total" fill="#1D4ED8" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel
          title="Distribución por Capítulo"
          empty={capitulosTotal.length === 0}
          tall={capChartH}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              layout="vertical"
              data={capitulosTotal.slice(0, 12).map((c) => ({
                ...c,
                label: truncLabel(c.capitulo, narrow ? 14 : 22),
                full: c.capitulo,
              }))}
              margin={{ top: 4, right: 12, left: 4, bottom: 4 }}
            >
              <CartesianGrid stroke="#E2E8F0" strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tickFormatter={fmtUsdTick} tick={{ fill: '#64748B', fontSize: 10 }} />
              <YAxis
                type="category"
                dataKey="label"
                width={narrow ? 86 : 130}
                tick={{ fill: '#475569', fontSize: 10 }}
                interval={0}
              />
              <Tooltip
                labelFormatter={(_, payload) => {
                  const p = payload?.[0]?.payload as { full?: string } | undefined;
                  return p?.full ?? '';
                }}
                formatter={(v) => fmtUsd(Number(v))}
              />
              <Bar dataKey="costo" name="Costo total" fill="#0F766E" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel
          title="Top 10 Proveedores"
          empty={topProveedores.length === 0}
          tall={provChartH}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              layout="vertical"
              data={topProveedores.map((p) => ({
                ...p,
                label: truncLabel(p.proveedor, narrow ? 14 : 22),
                full: p.proveedor,
              }))}
              margin={{ top: 4, right: 12, left: 4, bottom: 4 }}
            >
              <CartesianGrid stroke="#E2E8F0" strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tickFormatter={fmtUsdTick} tick={{ fill: '#64748B', fontSize: 10 }} />
              <YAxis
                type="category"
                dataKey="label"
                width={narrow ? 86 : 140}
                tick={{ fill: '#475569', fontSize: 10 }}
                interval={0}
              />
              <Tooltip
                labelFormatter={(_, payload) => {
                  const p = payload?.[0]?.payload as { full?: string } | undefined;
                  return p?.full ?? '';
                }}
                formatter={(v) => fmtUsd(Number(v))}
              />
              <Bar dataKey="costo" name="Costo total" fill="#1E3A8A" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title="Distribución por Tipo de Gasto" empty={tiposPie.length === 0} tall={320}>
          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ flex: 1, minHeight: 180 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={tiposPie}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={narrow ? 42 : 58}
                    outerRadius={narrow ? 72 : 96}
                    paddingAngle={1}
                    label={false}
                  >
                    {tiposPie.map((t) => (
                      <Cell
                        key={t.name}
                        fill={t.color || CCO_TIPO_COLOR_PIE[t.name as keyof typeof CCO_TIPO_COLOR_PIE] || '#64748B'}
                      />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v, name) => [fmtUsd(Number(v)), String(name)]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul
              style={{
                listStyle: 'none',
                margin: '8px 0 0',
                padding: 0,
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                gap: '6px 10px',
              }}
            >
              {tiposPie.map((t) => (
                <li
                  key={t.name}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 6,
                    fontSize: 11,
                    color: '#334155',
                  }}
                >
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 2,
                      background: t.color,
                      flexShrink: 0,
                      marginTop: 2,
                    }}
                  />
                  <span style={{ minWidth: 0, wordBreak: 'break-word' }}>
                    <strong>{t.name}</strong>
                    <span style={{ display: 'block', color: '#64748B' }}>
                      {fmtUsdCorto(t.value)} · {((t.value / pieTotal) * 100).toFixed(1)}%
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </ChartPanel>
      </div>

      <ChartPanel
        title="Detalle Completo: Capítulo, Sub-Capítulo y Tipo de Gasto"
        empty={detalle.length === 0 && (data.treemapNodos?.length ?? 0) === 0}
        tall={null}
      >
        <DetalleTreemap
          detalle={detalle}
          fallback={data.treemapNodos ?? []}
        />
      </ChartPanel>

      {mostrarTablas ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Tabla
            title={`Flujo de caja (${modo === 'acumulado' ? 'acumulado' : 'período'})`}
            empty={flujo.length === 0}
            headers={['PERÍODO', 'INGRESOS', 'EGRESOS', 'SALDO']}
            rows={flujo.map((r) => [
              r.periodo,
              fmtUsd(r.ingresos),
              fmtUsd(r.egresos),
              fmtUsd(r.saldo),
            ])}
          />
          <Tabla
            title="Evolución Mensual"
            empty={gastosMensual.length === 0}
            headers={['PERIODO', 'COSTO TOTAL']}
            rows={[
              ...gastosMensual.map((r) => [r.periodo, fmtUsd(r.costo)]),
              [
                'TOTAL',
                fmtUsd(gastosMensual.reduce((s, r) => s + r.costo, 0)),
              ],
            ]}
          />
          <Tabla
            title="Distribución por Capítulo"
            empty={capitulosTotal.length === 0}
            headers={['CAPITULO', 'COSTO TOTAL']}
            rows={capitulosTotal.map((r) => [r.capitulo, fmtUsd(r.costo)])}
          />
          <Tabla
            title="Top 10 Proveedores"
            empty={topProveedores.length === 0}
            headers={['PROVEEDOR', 'COSTO TOTAL']}
            rows={topProveedores.map((r) => [r.proveedor, fmtUsd(r.costo)])}
          />
          <Tabla
            title="Distribución por Tipo de Gasto"
            empty={tiposPie.length === 0}
            headers={['TIPO', 'COSTO TOTAL']}
            rows={tiposPie.map((t) => [t.name, fmtUsd(t.value)])}
          />
          <Tabla
            title="Detalle Completo: Capítulo, Sub-Capítulo y Tipo de Gasto"
            empty={detalle.length === 0}
            headers={['CAPITULO', 'SUBCAPITULO', 'TIPO', 'COSTO TOTAL']}
            rows={detalle.map((r) => [
              r.capitulo,
              r.subcapitulo,
              r.tipo,
              fmtUsd(r.costo),
            ])}
          />
        </div>
      ) : null}
    </div>
  );
}

function ChartPanel({
  title,
  empty,
  tall,
  children,
}: {
  title: string;
  empty: boolean;
  tall: number | null;
  children: React.ReactNode;
}) {
  return (
    <div style={box}>
      <h4 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 800 }}>{title}</h4>
      {empty ? (
        <p style={muted}>Sin datos en el filtro actual.</p>
      ) : tall == null ? (
        children
      ) : (
        <div style={{ width: '100%', height: tall, minWidth: 0 }}>{children}</div>
      )}
    </div>
  );
}

function DetalleTreemap({
  detalle,
  fallback,
}: {
  detalle: CcoDetalleJerarquia[];
  fallback: { cap: string; sub: string; costo: number }[];
}) {
  const nodos = useMemo(() => {
    if (detalle.length > 0) {
      return detalle.map((d) => ({
        cap: d.capitulo,
        sub: d.subcapitulo,
        tipo: d.tipo,
        costo: d.costo,
      }));
    }
    return fallback.map((f) => ({
      cap: f.cap,
      sub: f.sub,
      tipo: f.sub,
      costo: f.costo,
    }));
  }, [detalle, fallback]);

  const porCap = useMemo(() => {
    const m = new Map<string, typeof nodos>();
    for (const n of nodos) {
      if (!m.has(n.cap)) m.set(n.cap, []);
      m.get(n.cap)!.push(n);
    }
    return Array.from(m.entries()).sort(
      (a, b) =>
        b[1].reduce((s, x) => s + x.costo, 0) - a[1].reduce((s, x) => s + x.costo, 0),
    );
  }, [nodos]);

  const maxCosto = Math.max(...nodos.map((n) => n.costo), 1);
  const totalAll = nodos.reduce((s, n) => s + n.costo, 0) || 1;

  if (nodos.length === 0) {
    return <p style={muted}>Sin datos en el filtro actual.</p>;
  }

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 6,
        minHeight: 280,
        background: '#FAFCFB',
        borderRadius: 10,
        padding: 8,
        border: '1px solid #E2E8F0',
      }}
    >
      {porCap.map(([cap, hijos]) => {
        const capTotal = hijos.reduce((s, h) => s + h.costo, 0);
        const flexGrow = Math.max(capTotal / totalAll, 0.08);
        return (
          <div
            key={cap}
            style={{
              flex: `${flexGrow * 10} 1 ${Math.max(140, flexGrow * 320)}px`,
              border: '1px solid #004D4033',
              borderRadius: 8,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              minHeight: 120,
              minWidth: 0,
            }}
          >
            <div
              style={{
                background: '#004D40',
                color: '#fff',
                fontSize: 11,
                fontWeight: 800,
                padding: '4px 8px',
              }}
            >
              {cap} · {fmtUsdCorto(capTotal)}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', flex: 1 }}>
              {hijos.map((h) => (
                <div
                  key={`${cap}-${h.sub}-${h.tipo}`}
                  style={{
                    flex: `${Math.max(h.costo, 1)} 1 90px`,
                    background: colorTealPorValor(h.costo, maxCosto),
                    color: h.costo / maxCosto > 0.45 ? '#fff' : '#064E3B',
                    padding: 8,
                    fontSize: 10,
                    lineHeight: 1.25,
                    borderRight: '1px solid rgba(255,255,255,0.35)',
                    borderBottom: '1px solid rgba(255,255,255,0.35)',
                    minHeight: 72,
                    minWidth: 0,
                  }}
                  title={`${h.sub} · ${h.tipo}: ${fmtUsd(h.costo)}`}
                >
                  <div style={{ fontWeight: 800 }}>{truncLabel(h.sub, 22)}</div>
                  <div style={{ opacity: 0.95 }}>{truncLabel(h.tipo, 20)}</div>
                  <div>{fmtUsdCorto(h.costo)}</div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Tabla({
  title,
  headers,
  rows,
  empty,
}: {
  title: string;
  headers: string[];
  rows: string[][];
  empty: boolean;
}) {
  return (
    <div style={box}>
      <h4 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 800 }}>{title}</h4>
      {empty ? (
        <p style={muted}>Sin datos en el filtro actual.</p>
      ) : (
        <div style={{ overflow: 'auto', maxHeight: 360 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#F1F5F9', textAlign: 'left' }}>
                {headers.map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: '7px 6px',
                      position: 'sticky',
                      top: 0,
                      background: '#F1F5F9',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={`${title}-${i}`} style={{ borderTop: '1px solid #E2E8F0' }}>
                  {row.map((cell, j) => (
                    <td
                      key={`${i}-${j}`}
                      style={{
                        padding: '7px 6px',
                        color: '#334155',
                        fontVariantNumeric: j > 0 ? 'tabular-nums' : undefined,
                        whiteSpace: j === 0 ? 'normal' : 'nowrap',
                      }}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const box: React.CSSProperties = {
  background: '#fff',
  borderRadius: 14,
  border: '1px solid #E2E8F0',
  padding: 20,
};
const h3: React.CSSProperties = { margin: '0 0 6px', fontSize: 18, fontWeight: 800 };
const muted: React.CSSProperties = { margin: 0, color: '#64748B', fontSize: 13 };
const toggleBtn: React.CSSProperties = {
  border: '1px solid #CBD5E1',
  background: '#F8FAFC',
  color: '#0F172A',
  borderRadius: 8,
  padding: '8px 12px',
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};
