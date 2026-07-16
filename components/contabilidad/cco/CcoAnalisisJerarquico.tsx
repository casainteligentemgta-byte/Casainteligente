'use client';

import React, { useMemo, useState } from 'react';
import {
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
  CcoCapituloJerarquia,
  CcoHijoJerarquia,
  CcoSubCapituloStack,
  CcoTipoPie,
  CcoTreemapNodo,
} from '@/lib/contabilidad/cargarCcoDashboard';
import {
  CCO_TIPOS_GASTO,
  CCO_TIPO_COLOR_CAT,
  colorTealPorValor,
  fmtUsdCorto,
} from '@/lib/contabilidad/ccoClasificarGasto';

function polar(cx: number, cy: number, r: number, angle: number) {
  const rad = ((angle - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(
  cx: number,
  cy: number,
  r0: number,
  r1: number,
  a0: number,
  a1: number,
): string {
  const large = a1 - a0 > 180 ? 1 : 0;
  const p0 = polar(cx, cy, r1, a0);
  const p1 = polar(cx, cy, r1, a1);
  const p2 = polar(cx, cy, r0, a1);
  const p3 = polar(cx, cy, r0, a0);
  return [
    `M ${p0.x} ${p0.y}`,
    `A ${r1} ${r1} 0 ${large} 1 ${p1.x} ${p1.y}`,
    `L ${p2.x} ${p2.y}`,
    `A ${r0} ${r0} 0 ${large} 0 ${p3.x} ${p3.y}`,
    'Z',
  ].join(' ');
}

function fmtUsdFull(n: number): string {
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function ColorScale({ max }: { max: number }) {
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(max * t));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 56 }}>
      <p
        style={{
          fontSize: 9,
          fontWeight: 700,
          color: '#94A3B8',
          letterSpacing: '0.04em',
          marginBottom: 6,
          textAlign: 'center',
        }}
      >
        COSTO TOTAL
      </p>
      <div style={{ display: 'flex', gap: 6, height: 180 }}>
        <div
          style={{
            width: 14,
            borderRadius: 4,
            background: 'linear-gradient(180deg, #004D40 0%, #80CBC4 55%, #E0F2F1 100%)',
          }}
        />
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            fontSize: 10,
            color: '#64748B',
          }}
        >
          {[...ticks].reverse().map((t) => (
            <span key={t}>{t >= 1000 ? `${Math.round(t / 1000)}k` : t}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

function SunburstCard({ cap }: { cap: CcoCapituloJerarquia }) {
  const [hover, setHover] = useState<CcoHijoJerarquia | null>(null);
  const size = 320;
  const cx = size / 2;
  const cy = size / 2;
  const rInner = 58;
  const rOuter = 128;
  const rLabel = (rInner + rOuter) / 2;
  const maxHijo = Math.max(...cap.hijos.map((h) => h.costo), 1);
  let angle = 0;
  const slices = cap.hijos.map((h) => {
    const sweep = (h.costo / (cap.total || 1)) * 360;
    const a0 = angle;
    const a1 = angle + Math.max(sweep, 0.35);
    angle = a1;
    const mid = (a0 + a1) / 2;
    const labelPos = polar(cx, cy, rLabel, mid);
    return { ...h, a0, a1, mid, labelPos, color: colorTealPorValor(h.costo, maxHijo) };
  });

  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 12,
        border: '1px solid #E8EEF2',
        padding: '12px 12px 8px',
        display: 'flex',
        gap: 8,
        alignItems: 'center',
        minHeight: 340,
        position: 'relative',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 800, color: '#0F172A' }}>
          Capítulo: {cap.nombre}
        </p>
        <svg width="100%" height={size} viewBox={`0 0 ${size} ${size}`}>
          {slices.map((s) => {
            const sweep = s.a1 - s.a0;
            const showLabel = sweep >= 22;
            return (
              <g
                key={s.nombre}
                onMouseEnter={() => setHover(s)}
                onMouseLeave={() => setHover(null)}
                style={{ cursor: 'pointer' }}
              >
                <path
                  d={arcPath(cx, cy, rInner, rOuter, s.a0, s.a1)}
                  fill={s.color}
                  stroke="#fff"
                  strokeWidth={1.5}
                  opacity={hover && hover.nombre !== s.nombre ? 0.55 : 1}
                />
                {showLabel ? (
                  <text
                    x={s.labelPos.x}
                    y={s.labelPos.y - 8}
                    textAnchor="middle"
                    fill={s.costo / maxHijo > 0.4 ? '#F0FDFA' : '#064E3B'}
                    fontSize={9}
                    fontWeight={800}
                    style={{ pointerEvents: 'none' }}
                  >
                    {s.nombre.length > 14 ? `${s.nombre.slice(0, 13)}…` : s.nombre}
                  </text>
                ) : null}
                {showLabel ? (
                  <text
                    x={s.labelPos.x}
                    y={s.labelPos.y + 4}
                    textAnchor="middle"
                    fill={s.costo / maxHijo > 0.4 ? '#CCFBF1' : '#065F46'}
                    fontSize={9}
                    fontWeight={700}
                    style={{ pointerEvents: 'none' }}
                  >
                    {fmtUsdCorto(s.costo)}
                  </text>
                ) : null}
                {showLabel ? (
                  <text
                    x={s.labelPos.x}
                    y={s.labelPos.y + 16}
                    textAnchor="middle"
                    fill={s.costo / maxHijo > 0.4 ? '#99F6E4' : '#047857'}
                    fontSize={8}
                    fontWeight={600}
                    style={{ pointerEvents: 'none' }}
                  >
                    Cap: {s.pctPadre.toFixed(1)}%
                  </text>
                ) : null}
              </g>
            );
          })}
          <circle cx={cx} cy={cy} r={rInner - 2} fill="#004D40" />
          <text
            x={cx}
            y={cy - 14}
            textAnchor="middle"
            fill="#fff"
            fontSize={11}
            fontWeight={800}
          >
            {cap.nombre.length > 16 ? `${cap.nombre.slice(0, 15)}…` : cap.nombre}
          </text>
          <text x={cx} y={cy + 6} textAnchor="middle" fill="#fff" fontSize={14} fontWeight={700}>
            {fmtUsdCorto(cap.total)}
          </text>
          <text x={cx} y={cy + 24} textAnchor="middle" fill="#B2DFDB" fontSize={10}>
            Cap: {Number.isFinite(cap.pctTotal) ? cap.pctTotal.toFixed(1) : '0.0'}%
          </text>
        </svg>
      </div>
      <ColorScale max={maxHijo} />
      {hover ? (
        <div
          style={{
            position: 'absolute',
            left: 16,
            bottom: 12,
            background: '#fff',
            border: '1px solid #E2E8F0',
            borderRadius: 10,
            boxShadow: '0 8px 24px rgba(15,23,42,0.12)',
            padding: '10px 12px',
            minWidth: 180,
            zIndex: 2,
            pointerEvents: 'none',
          }}
        >
          <p style={{ margin: 0, fontWeight: 800, fontSize: 13, color: '#0F172A' }}>{hover.nombre}</p>
          <p style={{ margin: '6px 0 0', fontSize: 12, color: '#334155' }}>
            <strong>Costo Total:</strong> {fmtUsdFull(hover.costo)}
          </p>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: '#334155' }}>
            <strong>Del Capítulo:</strong> {hover.pctPadre.toFixed(2)}%
          </p>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: '#334155' }}>
            <strong>Del Global:</strong> {hover.pctTotal.toFixed(2)}%
          </p>
        </div>
      ) : null}
    </div>
  );
}

/** Treemap Capítulo → Sub-Capítulo (estilo captura V4). */
function TreemapPresupuesto({ nodos }: { nodos: CcoTreemapNodo[] }) {
  const porCap = useMemo(() => {
    const m = new Map<string, CcoTreemapNodo[]>();
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

  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'stretch' }}>
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 6,
          minHeight: 320,
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
                flex: `${flexGrow * 10} 1 ${Math.max(160, flexGrow * 420)}px`,
                border: '1px solid #004D4033',
                borderRadius: 8,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                minHeight: 140,
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
                {cap}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', flex: 1 }}>
                {hijos.map((h) => (
                  <div
                    key={`${cap}-${h.sub}`}
                    style={{
                      flex: `${Math.max(h.costo, 1)} 1 80px`,
                      background: colorTealPorValor(h.costo, maxCosto),
                      color: h.costo / maxCosto > 0.45 ? '#fff' : '#064E3B',
                      padding: 8,
                      fontSize: 10,
                      lineHeight: 1.25,
                      borderRight: '1px solid rgba(255,255,255,0.35)',
                      borderBottom: '1px solid rgba(255,255,255,0.35)',
                      minHeight: 72,
                    }}
                    title={`${h.sub}: ${fmtUsdFull(h.costo)} · ${h.pctPadre.toFixed(1)}% padre · ${h.pctTotal.toFixed(1)}% total`}
                  >
                    <div style={{ fontWeight: 800 }}>{h.sub}</div>
                    <div>{fmtUsdCorto(h.costo)}</div>
                    <div style={{ opacity: 0.9 }}>
                      {h.pctPadre.toFixed(1)}% (padre) · {h.pctTotal.toFixed(1)}% (total)
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <ColorScale max={maxCosto} />
    </div>
  );
}

function buildVistaInvertida(
  jerarquiaCapitulos: CcoCapituloJerarquia[],
  pieTotal: number,
): CcoCapituloJerarquia[] {
  const porSub = new Map<string, { total: number; hijos: CcoHijoJerarquia[] }>();
  for (const cap of jerarquiaCapitulos) {
    for (const h of cap.hijos) {
      if (!porSub.has(h.nombre)) porSub.set(h.nombre, { total: 0, hijos: [] });
      const acc = porSub.get(h.nombre)!;
      acc.total += h.costo;
      acc.hijos.push({
        nombre: cap.nombre,
        costo: h.costo,
        pctPadre: 0,
        pctTotal: h.pctTotal,
      });
    }
  }
  return Array.from(porSub.entries())
    .map(([nombre, acc]) => {
      const hijos = acc.hijos
        .map((h) => ({
          ...h,
          pctPadre: acc.total > 0 ? (h.costo / acc.total) * 100 : 0,
        }))
        .sort((a, b) => b.costo - a.costo);
      return {
        nombre,
        total: acc.total,
        pctTotal: pieTotal > 0 ? (acc.total / pieTotal) * 100 : 0,
        hijos,
      };
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, 12);
}

type Props = {
  jerarquiaCapitulos: CcoCapituloJerarquia[];
  subCapitulosStack: CcoSubCapituloStack[];
  tiposPie: CcoTipoPie[];
  treemapNodos: CcoTreemapNodo[];
};

export default function CcoAnalisisJerarquico({
  jerarquiaCapitulos,
  subCapitulosStack,
  tiposPie,
  treemapNodos,
}: Props) {
  const [direccion, setDireccion] = useState('Capítulo -> Sub-Capítulo');

  const pieTotal = tiposPie.reduce((s, t) => s + t.value, 0) || 1;
  const stackKeys = CCO_TIPOS_GASTO.filter((t) =>
    subCapitulosStack.some((row) => Number(row[t] ?? 0) > 0),
  );

  const sunburstCards = useMemo(() => {
    if (direccion.startsWith('Sub')) {
      return buildVistaInvertida(jerarquiaCapitulos, pieTotal);
    }
    return jerarquiaCapitulos;
  }, [direccion, jerarquiaCapitulos, pieTotal]);

  if (jerarquiaCapitulos.length === 0 && tiposPie.length === 0) {
    return (
      <div
        style={{
          background: '#fff',
          borderRadius: 14,
          border: '1px solid #E2E8F0',
          padding: 24,
          color: '#94A3B8',
          fontSize: 13,
        }}
      >
        Sin datos para análisis jerárquico en el filtro actual.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginTop: 18 }}>
      {/* Sub-capítulo stack + pie tipo */}
      <div
        style={{
          background: '#fff',
          borderRadius: 14,
          border: '1px solid #E2E8F0',
          padding: '18px 20px',
        }}
      >
        <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 800 }}>
          Distribución por Sub-Capítulo (Composición por Tipo de Gasto)
        </h3>
        <p style={{ margin: '0 0 12px', fontSize: 12, color: '#64748B' }}>
          Barras apiladas por sub-capítulo · leyenda Tipo de Gasto
        </p>
        <div style={{ width: '100%', height: 360 }}>
          {subCapitulosStack.length === 0 ? (
            <p style={{ color: '#94A3B8', fontSize: 13 }}>Sin datos</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={subCapitulosStack} margin={{ bottom: 56, left: 8, right: 8 }}>
                <CartesianGrid stroke="#E2E8F0" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="sub"
                  tick={{ fill: '#64748B', fontSize: 9 }}
                  interval={0}
                  angle={-40}
                  textAnchor="end"
                  height={78}
                  label={{
                    value: 'Sub-Capítulo',
                    position: 'insideBottom',
                    offset: -4,
                    style: { fill: '#64748B', fontSize: 11 },
                  }}
                />
                <YAxis
                  tickFormatter={(n) =>
                    Math.abs(n) >= 1000 ? `${Math.round(n / 1000)}k` : String(Math.round(n))
                  }
                  tick={{ fill: '#64748B', fontSize: 11 }}
                  width={52}
                  label={{
                    value: 'Costo Total (USD)',
                    angle: -90,
                    position: 'insideLeft',
                    style: { fill: '#64748B', fontSize: 11 },
                  }}
                />
                <Tooltip
                  formatter={(v, name) => [
                    Number(v).toLocaleString('en-US', {
                      style: 'currency',
                      currency: 'USD',
                      maximumFractionDigits: 2,
                    }),
                    `Tipo de Gasto=${String(name)}`,
                  ]}
                  labelFormatter={(label) => `Sub-Capítulo=${label}`}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {stackKeys.map((k) => (
                  <Bar key={k} dataKey={k} stackId="a" fill={CCO_TIPO_COLOR_CAT[k]} name={k} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <h3 style={{ margin: '20px 0 12px', fontSize: 16, fontWeight: 800 }}>
          Distribución Total por Tipo de Gasto
        </h3>
        <div style={{ width: '100%', height: 300, display: 'flex', justifyContent: 'center' }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={tiposPie}
                dataKey="value"
                nameKey="name"
                cx="42%"
                cy="50%"
                innerRadius={70}
                outerRadius={110}
                paddingAngle={1}
                label={(props) => {
                  const p = Number((props as { percent?: number }).percent ?? 0);
                  return p > 0.04 ? `${(p * 100).toFixed(1)}%` : '';
                }}
              >
                {tiposPie.map((t) => (
                  <Cell key={t.name} fill={t.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(v, name) => [
                  Number(v).toLocaleString('en-US', {
                    style: 'currency',
                    currency: 'USD',
                    maximumFractionDigits: 0,
                  }),
                  String(name),
                ]}
              />
              <Legend
                layout="vertical"
                align="right"
                verticalAlign="middle"
                wrapperStyle={{ fontSize: 11 }}
                formatter={(value) => {
                  const row = tiposPie.find((t) => t.name === value);
                  const pct = row ? ((row.value / pieTotal) * 100).toFixed(1) : '';
                  return `${value} ${pct}%`;
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Análisis Jerárquico sunbursts */}
      <div
        style={{
          background: '#fff',
          borderRadius: 14,
          border: '1px solid #E2E8F0',
          padding: '18px 20px',
        }}
      >
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#0F172A' }}>
          Análisis Jerárquico
        </h2>
        <div style={{ margin: '12px 0 16px', maxWidth: 420 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
            Dirección de la Jerarquía (Árbol y Concéntrico):
          </p>
          <select
            value={direccion}
            onChange={(e) => setDireccion(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid #CBD5E1',
              background: '#F8FAFC',
              fontSize: 14,
              color: '#0F172A',
            }}
          >
            <option>Capítulo -&gt; Sub-Capítulo</option>
            <option>Sub-Capítulo -&gt; Capítulo</option>
          </select>
        </div>
        <p style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 700, color: '#334155' }}>
          Estructura Concéntrica (Sunburst) por{' '}
          {direccion.startsWith('Sub') ? 'Sub-Capítulo' : 'Capítulo'}
        </p>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: 14,
          }}
        >
          {sunburstCards.map((c) => (
            <SunburstCard key={c.nombre} cap={c} />
          ))}
        </div>
      </div>

      {/* Treemap */}
      <div
        style={{
          background: '#fff',
          borderRadius: 14,
          border: '1px solid #E2E8F0',
          padding: '18px 20px',
        }}
      >
        <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 800 }}>
          Relación Jerárquica del Presupuesto (Mapa de Árbol)
        </h2>
        <p style={{ margin: '0 0 14px', fontSize: 13, color: '#64748B' }}>
          Mapa de Árbol: {direccion.startsWith('Sub') ? 'Sub-Capítulo → Capítulo' : 'Capítulo → Sub-Capítulo'}{' '}
          (haz hover para ver montos)
        </p>
        {treemapNodos.length === 0 ? (
          <p style={{ color: '#94A3B8', fontSize: 13 }}>Sin datos</p>
        ) : (
          <TreemapPresupuesto
            nodos={
              direccion.startsWith('Sub')
                ? treemapNodos.map((n) => ({
                    ...n,
                    cap: n.sub,
                    sub: n.cap,
                  }))
                : treemapNodos
            }
          />
        )}
        <p style={{ margin: '12px 0 0', fontSize: 12, color: '#94A3B8' }}>
          Consejo: el tamaño y el tono teal indican el costo relativo de cada bloque.
        </p>
      </div>
    </div>
  );
}
