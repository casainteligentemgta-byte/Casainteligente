'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { CcoDashboard, CcoKpiBloque } from '@/lib/contabilidad/cargarCcoDashboard';
import CcoAnalisisJerarquico from '@/components/contabilidad/cco/CcoAnalisisJerarquico';
import { CCO_TIPO_COLOR_CAT } from '@/lib/contabilidad/ccoClasificarGasto';

type TabId =
  | 'graficos'
  | 'datos'
  | 'rubros'
  | 'egresos'
  | 'distribucion'
  | 'ingresos'
  | 'deudas'
  | 'contratos'
  | 'presupuestos'
  | 'editor'
  | 'importar'
  | 'auditoria';

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'graficos', label: 'GRÁFICOS', icon: '📊' },
  { id: 'datos', label: 'DATOS GRÁFICOS', icon: '⚡' },
  { id: 'rubros', label: 'LISTA DE RUBROS', icon: '📁' },
  { id: 'egresos', label: 'EGRESOS', icon: '🔴' },
  { id: 'distribucion', label: 'DISTRIBUCIÓN MASIVA', icon: '📂' },
  { id: 'ingresos', label: 'INGRESOS', icon: '🟢' },
  { id: 'deudas', label: 'DEUDAS', icon: '💳' },
  { id: 'contratos', label: 'CONTRATOS', icon: '📄' },
  { id: 'presupuestos', label: 'PRESUPUESTOS', icon: '📐' },
  { id: 'editor', label: 'EDITOR MAESTRO', icon: '✏️' },
  { id: 'importar', label: 'IMPORTAR PDF', icon: '📤' },
  { id: 'auditoria', label: 'AUDITORÍA', icon: '🛡️' },
];

/** Misma paleta que barras de Sub-Capítulo / leyenda Tipo de Gasto. */
const TIPOS_GASTO = [
  { key: 'admin', name: 'ADMINISTRACIÓN DELEGADA', color: CCO_TIPO_COLOR_CAT['ADMINISTRACIÓN DELEGADA'] },
  { key: 'materiales', name: 'MATERIALES', color: CCO_TIPO_COLOR_CAT.MATERIALES },
  { key: 'contratista', name: 'CONTRATISTA', color: CCO_TIPO_COLOR_CAT.CONTRATISTA },
  { key: 'equipos', name: 'EQUIPOS', color: CCO_TIPO_COLOR_CAT.EQUIPOS },
  { key: 'insumos', name: 'INSUMOS', color: CCO_TIPO_COLOR_CAT.INSUMOS },
  { key: 'mano', name: 'MANO DE OBRA', color: CCO_TIPO_COLOR_CAT['MANO DE OBRA'] },
  { key: 'transporte', name: 'TRANSPORTE', color: CCO_TIPO_COLOR_CAT.TRANSPORTE },
  { key: 'permiso', name: 'PERMISOLOGÍA', color: CCO_TIPO_COLOR_CAT.PERMISOLOGIA },
  { key: 'proyecto', name: 'PROYECTO', color: CCO_TIPO_COLOR_CAT.PROYECTO },
] as const;

const axisTick = { fill: '#64748B', fontSize: 11 };
const gridStroke = '#E2E8F0';

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

function MetricCard({
  title,
  value,
  footnote,
  tone,
}: {
  title: string;
  value: string;
  footnote: string;
  tone: 'green' | 'brown' | 'red' | 'money';
}) {
  const toneDot =
    tone === 'green' ? '#22C55E' : tone === 'brown' ? '#B45309' : tone === 'red' ? '#EF4444' : '#CA8A04';
  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 12,
        padding: '14px 16px',
        boxShadow: '0 1px 3px rgba(15,23,42,0.08), 0 4px 14px rgba(15,23,42,0.06)',
        border: '1px solid rgba(15,23,42,0.06)',
        minHeight: 108,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      <p
        style={{
          color: '#64748B',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
        }}
      >
        {title}
      </p>
      <p
        style={{
          color: '#0F172A',
          fontSize: 20,
          fontWeight: 800,
          letterSpacing: '-0.02em',
          margin: '8px 0',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: 99,
            background: toneDot,
            flexShrink: 0,
          }}
        />
        <span style={{ color: '#64748B', fontSize: 12 }}>{footnote}</span>
      </div>
    </div>
  );
}

function KpiRow({ bloque, honorariosPct, real }: { bloque: CcoKpiBloque; honorariosPct: number; real?: boolean }) {
  const cards = real
    ? [
        { title: 'INGRESOS REALES', value: fmtUsd(bloque.ingresos), footnote: 'Tasa real aplicada', tone: 'green' as const },
        { title: 'GASTOS REALES', value: fmtUsd(bloque.gastosNetos), footnote: 'Proporcional', tone: 'brown' as const },
        { title: 'ADMIN REAL', value: fmtUsd(bloque.adminDelegada), footnote: 'Proporcional', tone: 'brown' as const },
        { title: 'COSTO REAL', value: fmtUsd(bloque.costoTotal), footnote: 'Proporcional', tone: 'red' as const },
        { title: 'SALDO REAL', value: fmtUsd(bloque.saldoCaja), footnote: 'Poder adquisitivo', tone: 'money' as const },
      ]
    : [
        {
          title: 'TOTAL INGRESOS',
          value: fmtUsd(bloque.ingresos),
          footnote: `+ ${bloque.countIngresos} Registros`,
          tone: 'green' as const,
        },
        { title: 'GASTOS NETOS', value: fmtUsd(bloque.gastosNetos), footnote: 'Filtrado', tone: 'brown' as const },
        {
          title: 'ADMIN DELEGADA',
          value: fmtUsd(bloque.adminDelegada),
          footnote: `Honorarios ${honorariosPct.toFixed(1)}%`,
          tone: 'brown' as const,
        },
        { title: 'COSTO TOTAL', value: fmtUsd(bloque.costoTotal), footnote: 'Gastos + Admin', tone: 'red' as const },
        { title: 'SALDO EN CAJA', value: fmtUsd(bloque.saldoCaja), footnote: 'Disponible', tone: 'money' as const },
      ];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: 12,
        marginBottom: 22,
      }}
    >
      {cards.map((c) => (
        <MetricCard key={c.title} {...c} />
      ))}
    </div>
  );
}

function ChartCard({ title, children, tall }: { title: string; children: React.ReactNode; tall?: number }) {
  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 12,
        border: '1px solid #E2E8F0',
        padding: '16px 18px 12px',
        marginBottom: 18,
      }}
    >
      <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, color: '#0F172A' }}>{title}</h3>
      <div style={{ width: '100%', height: tall ?? 320 }}>{children}</div>
    </div>
  );
}

const SECUNDARIOS = [
  { title: 'Compras CI', href: '/contabilidad/compras' },
  { title: 'Inyecciones', href: '/contabilidad/inyecciones' },
  { title: 'Gastos entidad', href: '/contabilidad/gastos-entidad' },
  { title: 'Procuras', href: '/contabilidad/procuras' },
  { title: 'Canal Telegram', href: '/contabilidad/compras/canal' },
];

export default function CcoDashboardClient() {
  const [tab, setTab] = useState<TabId>('graficos');
  const [proyectoId, setProyectoId] = useState('');
  const [devaluacion, setDevaluacion] = useState(0);
  const [data, setData] = useState<CcoDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [periodicidad, setPeriodicidad] = useState('Mensual');
  const [modo, setModo] = useState<'acumulado' | 'periodo'>('acumulado');

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (proyectoId) qs.set('proyecto', proyectoId);
      qs.set('devaluacion', String(devaluacion));
      const res = await fetch(`/api/contabilidad/cco-dashboard?${qs}`, { cache: 'no-store' });
      const json = (await res.json()) as CcoDashboard & { ok?: boolean; error?: string };
      if (!res.ok || json.ok === false) throw new Error(json.error ?? 'Error al cargar');
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar dashboard');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [proyectoId, devaluacion]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const flujo = useMemo(() => {
    if (!data) return [];
    return modo === 'acumulado' ? data.flujoAcumulado : data.flujoPeriodo;
  }, [data, modo]);

  const tituloFlujo =
    modo === 'acumulado'
      ? `Flujo de Caja Acumulado (${periodicidad})`
      : `Flujo de Caja por Período (${periodicidad})`;

  return (
    <div
      suppressHydrationWarning
      style={{
        minHeight: '100vh',
        background: '#F1F5F9',
        color: '#0F172A',
        paddingBottom: 100,
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 8,
          padding: '8px 16px',
          background: '#E2E8F0',
          borderBottom: '1px solid #CBD5E1',
          fontSize: 12,
        }}
      >
        <Link href="/contabilidad" style={{ color: '#2563EB', fontWeight: 700, textDecoration: 'none' }}>
          ← Hub módulos
        </Link>
        <button
          type="button"
          onClick={() => void cargar()}
          style={{
            border: '1px solid #CBD5E1',
            background: '#fff',
            borderRadius: 8,
            padding: '4px 10px',
            fontWeight: 700,
            cursor: 'pointer',
            color: '#334155',
          }}
        >
          Actualizar
        </button>
      </div>

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '16px 20px 24px' }}>
        <div
          style={{
            background: 'linear-gradient(90deg, #1D4ED8 0%, #2563EB 55%, #3B82F6 100%)',
            borderRadius: 14,
            padding: '18px 22px',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 14,
            boxShadow: '0 8px 24px rgba(37,99,235,0.28)',
            marginBottom: 16,
          }}
        >
          <div>
            <p
              style={{
                color: '#fff',
                fontSize: 18,
                fontWeight: 800,
                margin: 0,
                letterSpacing: '-0.02em',
              }}
            >
              Proyecto: {data?.proyectoNombre ?? '…'}
            </p>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <span style={pill}>{data?.totalRegistros ?? 0} Registros en Total</span>
            <span style={pill}>AD {data ? data.honorariosPct.toFixed(1) : '—'}%</span>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 12,
            marginBottom: 18,
            alignItems: 'flex-end',
          }}
        >
          <label style={{ flex: '1 1 220px' }}>
            <span style={labelStyle}>Obra</span>
            <select
              value={proyectoId}
              onChange={(e) => setProyectoId(e.target.value)}
              style={selectStyle}
            >
              <option value="">Todas las obras</option>
              {(data?.proyectos ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </label>
          <label style={{ flex: '0 1 180px' }}>
            <span style={labelStyle}>Devaluación promedio (%)</span>
            <input
              type="number"
              step="0.01"
              value={devaluacion}
              onChange={(e) => setDevaluacion(Number(e.target.value) || 0)}
              style={selectStyle}
            />
          </label>
        </div>

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 40, color: '#64748B' }}>
            <Loader2 className="animate-spin" size={22} />
            Cargando contabilidad…
          </div>
        ) : null}

        {error ? (
          <p style={{ color: '#DC2626', fontWeight: 600, marginBottom: 16 }}>{error}</p>
        ) : null}

        {data && !loading ? (
          <>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#1E293B', margin: '0 0 10px' }}>
              Contabilidad Oficial (BCV)
            </p>
            <KpiRow bloque={data.oficial} honorariosPct={data.honorariosPct} />

            <p style={{ fontSize: 15, fontWeight: 700, color: '#1E293B', margin: '0 0 10px' }}>
              Contabilidad Real{' '}
              <span style={{ fontWeight: 600, color: '#475569' }}>
                (Devaluación Promedio: {devaluacion.toFixed(5)}%)
              </span>
            </p>
            <KpiRow bloque={data.real} honorariosPct={data.honorariosPct} real />

            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '4px 2px',
                borderBottom: '1px solid #CBD5E1',
                marginBottom: 18,
                paddingBottom: 2,
              }}
            >
              {TABS.map((t) => {
                const active = tab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTab(t.id)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      borderBottom: active ? '3px solid #EF4444' : '3px solid transparent',
                      color: active ? '#DC2626' : '#334155',
                      fontSize: 12,
                      fontWeight: 700,
                      padding: '10px 10px 8px',
                      cursor: 'pointer',
                      letterSpacing: '0.02em',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <span style={{ marginRight: 4 }}>{t.icon}</span>
                    {t.label}
                  </button>
                );
              })}
            </div>

            {tab === 'graficos' ? (
              <div>
                <div
                  style={{
                    background: '#fff',
                    borderRadius: 14,
                    border: '1px solid #E2E8F0',
                    padding: '20px 22px 8px',
                    marginBottom: 18,
                  }}
                >
                  <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Panel de Análisis Financiero</h2>
                  <p style={{ margin: '6px 0 16px', fontSize: 14, color: '#64748B' }}>
                    Comparativa de Ingresos vs Egresos (Flujo de Caja)
                  </p>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 20,
                      marginBottom: 12,
                    }}
                  >
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Periodicidad del Gráfico</p>
                      <select
                        value={periodicidad}
                        onChange={(e) => setPeriodicidad(e.target.value)}
                        style={selectStyle}
                      >
                        <option>Mensual</option>
                        <option>Semanal</option>
                        <option>Diario</option>
                      </select>
                    </div>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Modo del Gráfico</p>
                      <label style={radioRow}>
                        <input
                          type="radio"
                          checked={modo === 'acumulado'}
                          onChange={() => setModo('acumulado')}
                        />
                        Acumulado (Histórico)
                      </label>
                      <label style={radioRow}>
                        <input
                          type="radio"
                          checked={modo === 'periodo'}
                          onChange={() => setModo('periodo')}
                        />
                        Por Período (Sin Acumular)
                      </label>
                    </div>
                  </div>

                  <ChartCard title={tituloFlujo} tall={340}>
                    {flujo.length === 0 ? (
                      <EmptyChart />
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={flujo} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                          <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" />
                          <XAxis dataKey="periodo" tick={axisTick} />
                          <YAxis tickFormatter={fmtUsdTick} tick={axisTick} width={48} />
                          <Tooltip formatter={(v) => fmtUsd(Number(v))} />
                          <Legend />
                          <Line
                            type="monotone"
                            dataKey="ingresos"
                            name={modo === 'acumulado' ? 'Ingresos Acumulados' : 'Ingresos'}
                            stroke="#22C55E"
                            strokeWidth={2.5}
                            dot={{ r: 3 }}
                          />
                          <Line
                            type="monotone"
                            dataKey="egresos"
                            name={modo === 'acumulado' ? 'Egresos Acumulados' : 'Egresos'}
                            stroke="#EF4444"
                            strokeWidth={2.5}
                            dot={{ r: 3 }}
                          />
                          <Line
                            type="monotone"
                            dataKey="saldo"
                            name={modo === 'acumulado' ? 'Saldo Acumulado' : 'Saldo'}
                            stroke="#3B82F6"
                            strokeWidth={2.5}
                            dot={{ r: 3 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </ChartCard>
                </div>

                <div
                  style={{
                    background: '#fff',
                    borderRadius: 14,
                    border: '1px solid #E2E8F0',
                    padding: '18px 22px 8px',
                  }}
                >
                  <h2 style={{ margin: '0 0 14px', fontSize: 20, fontWeight: 800 }}>
                    Distribución y Evolución Detallada
                  </h2>

                  <ChartCard title="Evolución de Gastos por Período (Mensual)" tall={300}>
                    {data.gastosMensual.length === 0 ? (
                      <EmptyChart />
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data.gastosMensual}>
                          <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" />
                          <XAxis dataKey="periodo" tick={axisTick} />
                          <YAxis tickFormatter={fmtUsdTick} tick={axisTick} width={48} />
                          <Tooltip formatter={(v) => fmtUsd(Number(v))} />
                          <Bar dataKey="costo" name="Costo Total (USD)" fill="#1D4ED8" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </ChartCard>

                  <ChartCard title="Top 10 Proveedores (Costo Total)" tall={380}>
                    {data.topProveedores.length === 0 ? (
                      <EmptyChart />
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart layout="vertical" data={data.topProveedores} margin={{ left: 8, right: 16 }}>
                          <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" horizontal={false} />
                          <XAxis type="number" tickFormatter={fmtUsdTick} tick={axisTick} />
                          <YAxis
                            type="category"
                            dataKey="proveedor"
                            width={150}
                            tick={{ ...axisTick, fontSize: 10 }}
                          />
                          <Tooltip formatter={(v) => fmtUsd(Number(v))} />
                          <Bar dataKey="costo" name="COSTO TOTAL" fill="#1E3A8A" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </ChartCard>

                  <ChartCard title="Distribución por Capítulo (Composición por Tipo de Gasto)" tall={400}>
                    {data.capitulos.length === 0 ? (
                      <EmptyChart />
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data.capitulos} margin={{ bottom: 28, left: 4, right: 8 }}>
                          <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" vertical={false} />
                          <XAxis
                            dataKey="cap"
                            tick={{ ...axisTick, fontSize: 9 }}
                            interval={0}
                            angle={-25}
                            textAnchor="end"
                            height={68}
                            label={{
                              value: 'Capítulo',
                              position: 'insideBottom',
                              offset: -4,
                              style: { fill: '#64748B', fontSize: 11 },
                            }}
                          />
                          <YAxis
                            tickFormatter={fmtUsdTick}
                            tick={axisTick}
                            width={52}
                            label={{
                              value: 'Costo Total (USD)',
                              angle: -90,
                              position: 'insideLeft',
                              style: { fill: '#64748B', fontSize: 11 },
                            }}
                          />
                          <Tooltip
                            formatter={(v, name) => [fmtUsd(Number(v)), `Tipo de Gasto=${String(name)}`]}
                            labelFormatter={(label) => `Capítulo=${label}`}
                          />
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                          {TIPOS_GASTO.map((t) => (
                            <Bar key={t.key} dataKey={t.key} name={t.name} stackId="a" fill={t.color} />
                          ))}
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </ChartCard>
                </div>

                <CcoAnalisisJerarquico
                  jerarquiaCapitulos={data.jerarquiaCapitulos ?? []}
                  subCapitulosStack={data.subCapitulosStack ?? []}
                  tiposPie={data.tiposPie ?? []}
                  treemapNodos={data.treemapNodos ?? []}
                />
              </div>
            ) : null}

            {tab === 'egresos' ? (
              <SeccionLista
                title="Egresos"
                desc="Gastos netos desde cuadro de compras (imputación obra)."
                href="/contabilidad/compras"
                hrefLabel="Abrir compras CI →"
                lines={[
                  `Gastos netos: ${fmtUsd(data.oficial.gastosNetos)}`,
                  `Admin delegada (${data.honorariosPct.toFixed(1)}%): ${fmtUsd(data.oficial.adminDelegada)}`,
                  `Costo total: ${fmtUsd(data.oficial.costoTotal)}`,
                ]}
              />
            ) : null}
            {tab === 'ingresos' ? (
              <SeccionLista
                title="Ingresos"
                desc="Inyecciones de capital registradas en CI."
                href="/contabilidad/inyecciones"
                hrefLabel="Abrir inyecciones →"
                lines={[
                  `Total ingresos: ${fmtUsd(data.oficial.ingresos)}`,
                  `Registros: ${data.oficial.countIngresos}`,
                ]}
              />
            ) : null}
            {tab !== 'graficos' && tab !== 'egresos' && tab !== 'ingresos' ? (
              <SeccionLista
                title={TABS.find((t) => t.id === tab)?.label ?? 'Sección'}
                desc="Estructura lista. Detalle de esta pestaña se completa con el flujo CCO (import SQLite / editor)."
                href="/contabilidad/compras"
                hrefLabel="Ir a módulos secundarios →"
                lines={[
                  'Orden y colores del menú V4 ya activos',
                  'Datos vivos hoy: Gráficos, Egresos e Ingresos vía CI',
                ]}
              />
            ) : null}

            <div style={{ marginTop: 28 }}>
              <p
                style={{
                  color: '#64748B',
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  marginBottom: 10,
                }}
              >
                Módulos secundarios · aportan al libro solo si no hay duplicado
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {SECUNDARIOS.map((m) => (
                  <Link
                    key={m.href}
                    href={m.href}
                    style={{
                      textDecoration: 'none',
                      border: '1px solid #E2E8F0',
                      background: '#fff',
                      borderRadius: 10,
                      padding: '10px 14px',
                      color: '#334155',
                      fontSize: 13,
                      fontWeight: 700,
                    }}
                  >
                    {m.title}
                  </Link>
                ))}
              </div>
            </div>
          </>
        ) : null}
      </div>

    </div>
  );
}

function EmptyChart() {
  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#94A3B8',
        fontSize: 13,
        border: '1px dashed #CBD5E1',
        borderRadius: 10,
      }}
    >
      Sin movimientos en el filtro actual
    </div>
  );
}

function SeccionLista({
  title,
  desc,
  lines,
  href,
  hrefLabel,
}: {
  title: string;
  desc: string;
  lines: string[];
  href: string;
  hrefLabel: string;
}) {
  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 14,
        border: '1px solid #E2E8F0',
        padding: 24,
      }}
    >
      <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{title}</h3>
      <p style={{ color: '#64748B', fontSize: 13, margin: '8px 0 14px' }}>{desc}</p>
      <ul style={{ margin: 0, paddingLeft: 18, color: '#334155', fontSize: 14, lineHeight: 1.7 }}>
        {lines.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
      <Link
        href={href}
        style={{
          display: 'inline-block',
          marginTop: 16,
          color: '#2563EB',
          fontWeight: 700,
          fontSize: 13,
          textDecoration: 'none',
        }}
      >
        {hrefLabel}
      </Link>
    </div>
  );
}

const pill: React.CSSProperties = {
  background: 'rgba(255,255,255,0.18)',
  color: '#fff',
  padding: '8px 14px',
  borderRadius: 999,
  fontSize: 13,
  fontWeight: 600,
  border: '1px solid rgba(255,255,255,0.25)',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 700,
  color: '#64748B',
  marginBottom: 4,
};

const selectStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  borderRadius: 8,
  border: '1px solid #CBD5E1',
  background: '#fff',
  color: '#0F172A',
  fontSize: 14,
};

const radioRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 14,
  color: '#334155',
  fontWeight: 600,
  cursor: 'pointer',
  marginBottom: 6,
};
