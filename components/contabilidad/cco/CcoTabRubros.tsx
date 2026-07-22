'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import type {
  CcoRubroConcepto,
  CcoRubroKpis,
  CcoRubroPie,
  CcoRubroSeccion,
  CcoRubroTransaccion,
} from '@/lib/contabilidad/cco/cargarRubros';
import { fmtUsdCorto } from '@/lib/contabilidad/ccoClasificarGasto';

function fmtUsd(n: number): string {
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtNum(n: number): string {
  if (Math.abs(n - Math.round(n)) < 1e-9) return String(Math.round(n));
  return n.toLocaleString('en-US', { maximumFractionDigits: 4 });
}

function fmtFecha(f: string | null): string {
  if (!f) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(f);
  if (!m) return f;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function downloadText(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function csvEscape(v: string | number): string {
  const s = String(v ?? '');
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

type VistaMode = 'resumen' | 'detalle';

export default function CcoTabRubros({ proyectoId }: { proyectoId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kpis, setKpis] = useState<CcoRubroKpis | null>(null);
  const [pie, setPie] = useState<CcoRubroPie[]>([]);
  const [secciones, setSecciones] = useState<CcoRubroSeccion[]>([]);
  const [transacciones, setTransacciones] = useState<CcoRubroTransaccion[]>([]);
  const [proveedores, setProveedores] = useState<string[]>([]);
  const [vista, setVista] = useState<VistaMode>('resumen');
  const [filtroProveedor, setFiltroProveedor] = useState('');
  const [query, setQuery] = useState('');
  const [auditRubro, setAuditRubro] = useState('MATERIALES');
  const [auditConcepto, setAuditConcepto] = useState('Todos');
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());

  const cargar = useCallback(async () => {
    if (!proyectoId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/contabilidad/cco/rubros?proyecto=${encodeURIComponent(proyectoId)}`,
        { cache: 'no-store' },
      );
      const json = await res.json();
      if (!res.ok || json.ok === false) throw new Error(json.error ?? 'Error');
      setKpis(json.kpis ?? null);
      setPie(json.pie ?? []);
      setSecciones(json.secciones ?? []);
      setTransacciones(json.transacciones ?? []);
      setProveedores(json.proveedores ?? []);
      setSeleccion(new Set());
      const firstTipo = (json.pie?.[0]?.name as string) || 'MATERIALES';
      setAuditRubro(firstTipo);
      setAuditConcepto('Todos');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
      setKpis(null);
      setPie([]);
      setSecciones([]);
      setTransacciones([]);
    } finally {
      setLoading(false);
    }
  }, [proyectoId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const txFiltradas = useMemo(() => {
    let rows = transacciones;
    if (filtroProveedor) {
      rows = rows.filter((r) => r.proveedor === filtroProveedor);
    }
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      rows = rows.filter(
        (r) =>
          r.descripcion.toLowerCase().includes(q) ||
          r.concepto.toLowerCase().includes(q) ||
          r.proveedor.toLowerCase().includes(q) ||
          r.tipo.toLowerCase().includes(q),
      );
    }
    return rows;
  }, [transacciones, filtroProveedor, query]);

  const kpisFiltrados = useMemo(() => {
    if (!filtroProveedor && !query.trim()) return kpis;
    const sum = (tipo: string) =>
      txFiltradas.filter((t) => t.tipo === tipo).reduce((s, t) => s + t.gastoNeto, 0);
    const materiales = sum('MATERIALES');
    const equipos = sum('EQUIPOS');
    const manoObra = sum('MANO DE OBRA');
    const contratistas = sum('CONTRATISTA');
    const transporte = sum('TRANSPORTE');
    const insumos = sum('INSUMOS');
    const proyPermisos = sum('PROYECTO') + sum('PERMISOLOGIA');
    return {
      materiales,
      equipos,
      manoObra,
      contratistas,
      transporte,
      insumos,
      proyPermisos,
      costoNeto:
        materiales + equipos + manoObra + contratistas + transporte + insumos + proyPermisos,
    };
  }, [kpis, txFiltradas, filtroProveedor, query]);

  const tipoPorSeccion: Record<string, string[]> = {
    MATERIALES: ['MATERIALES'],
    EQUIPOS: ['EQUIPOS'],
    MANO_OBRA: ['MANO DE OBRA'],
    CONTRATISTAS: ['CONTRATISTA'],
    TRANSPORTE: ['TRANSPORTE'],
    INSUMOS: ['INSUMOS'],
    PERMISOLOGIA: ['PERMISOLOGIA'],
    PROYECTO: ['PROYECTO'],
  };

  const seccionesFiltradas = useMemo(() => {
    if (!filtroProveedor && !query.trim()) return secciones;
    const byTipo = new Map<string, CcoRubroConcepto[]>();
    for (const t of txFiltradas) {
      if (!byTipo.has(t.tipo)) byTipo.set(t.tipo, []);
      const list = byTipo.get(t.tipo)!;
      const found = list.find((c) => c.concepto === t.concepto && c.unidad === t.unidad);
      if (found) {
        found.cantidad += t.cantidad;
        found.costoTotal += t.gastoNeto;
        found.precioPromedio =
          found.cantidad > 0 ? found.costoTotal / found.cantidad : found.costoTotal;
      } else {
        list.push({
          concepto: t.concepto,
          cantidad: t.cantidad,
          unidad: t.unidad,
          precioPromedio: t.cantidad > 0 ? t.gastoNeto / t.cantidad : t.gastoNeto,
          costoTotal: t.gastoNeto,
        });
      }
    }
    return secciones
      .map((sec) => {
        const tiposSec = tipoPorSeccion[sec.key] ?? [];
        const conceptos = tiposSec
          .flatMap((tp) => byTipo.get(tp) ?? [])
          .sort((a, b) => b.costoTotal - a.costoTotal);
        return {
          ...sec,
          conceptos,
          subtotal: conceptos.reduce((s, c) => s + c.costoTotal, 0),
        };
      })
      .filter((s) => s.conceptos.length > 0);
  }, [secciones, txFiltradas, filtroProveedor, query]);

  const pieFiltrado = useMemo(() => {
    if (!filtroProveedor && !query.trim()) return pie;
    const m = new Map<string, number>();
    for (const t of txFiltradas) m.set(t.tipo, (m.get(t.tipo) ?? 0) + t.gastoNeto);
    return pie
      .map((p) => ({ ...p, value: m.get(p.name) ?? 0 }))
      .filter((p) => p.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [pie, txFiltradas, filtroProveedor, query]);

  const pieTotal = pieFiltrado.reduce((s, p) => s + p.value, 0) || 1;

  const conceptosAudit = useMemo(() => {
    const set = new Set<string>();
    for (const t of txFiltradas) {
      if (t.tipo === auditRubro) set.add(t.concepto);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'));
  }, [txFiltradas, auditRubro]);

  const txAudit = useMemo(() => {
    let rows = txFiltradas.filter((t) => t.tipo === auditRubro);
    if (auditConcepto !== 'Todos') {
      rows = rows.filter((t) => t.concepto === auditConcepto);
    }
    return rows;
  }, [txFiltradas, auditRubro, auditConcepto]);

  function exportCsv() {
    const lines = ['Rubro,Concepto,Cantidad,Unidad,Precio Promedio USD,Costo Total USD'];
    for (const sec of seccionesFiltradas) {
      for (const c of sec.conceptos) {
        lines.push(
          [
            csvEscape(sec.titulo),
            csvEscape(c.concepto),
            csvEscape(fmtNum(c.cantidad)),
            csvEscape(c.unidad),
            csvEscape(c.precioPromedio.toFixed(2)),
            csvEscape(c.costoTotal.toFixed(2)),
          ].join(','),
        );
      }
    }
    downloadText(
      `CCO_rubros_clasificados_${proyectoId.slice(0, 8)}.csv`,
      lines.join('\n'),
      'text/csv;charset=utf-8',
    );
  }

  function exportExcel() {
    // HTML table → Excel-compatible download (mismo patrón ligero del maestro).
    const rows: string[] = [];
    rows.push(
      '<table><tr><th>Rubro</th><th>Concepto</th><th>Cant. Total</th><th>Unidad</th><th>Precio Promedio USD</th><th>Costo Total USD</th></tr>',
    );
    for (const sec of seccionesFiltradas) {
      rows.push(
        `<tr><td colspan="6"><b>${sec.icon} ${sec.titulo} — Subtotal ${fmtUsd(sec.subtotal)}</b></td></tr>`,
      );
      for (const c of sec.conceptos) {
        rows.push(
          `<tr><td>${sec.titulo}</td><td>${c.concepto}</td><td>${fmtNum(c.cantidad)}</td><td>${c.unidad}</td><td>${c.precioPromedio.toFixed(2)}</td><td>${c.costoTotal.toFixed(2)}</td></tr>`,
        );
      }
    }
    rows.push('</table>');
    downloadText(
      `CCO_rubros_reporte_${proyectoId.slice(0, 8)}.xls`,
      `\uFEFF${rows.join('')}`,
      'application/vnd.ms-excel',
    );
  }

  if (!proyectoId) {
    return (
      <div style={box}>
        <h3 style={h3}>Lista de rubros</h3>
        <p style={muted}>Selecciona una obra para ver el desglose de rubros.</p>
      </div>
    );
  }

  const kpiCards: { label: string; value: number; accent?: string }[] = kpisFiltrados
    ? [
        { label: 'MATERIALES', value: kpisFiltrados.materiales, accent: '#1E3A8A' },
        { label: 'EQUIPOS', value: kpisFiltrados.equipos, accent: '#7C3AED' },
        { label: 'MANO DE OBRA', value: kpisFiltrados.manoObra, accent: '#2563EB' },
        {
          label: 'COSTO NETO EJECUTADO (FILTRO)',
          value: kpisFiltrados.costoNeto,
          accent: '#0F766E',
        },
        { label: 'CONTRATISTAS', value: kpisFiltrados.contratistas, accent: '#16A34A' },
        { label: 'TRANSPORTE', value: kpisFiltrados.transporte, accent: '#0891B2' },
        { label: 'INSUMOS / VARIOS', value: kpisFiltrados.insumos, accent: '#C026D3' },
        { label: 'PROY. + PERMISOS', value: kpisFiltrados.proyPermisos, accent: '#DB2777' },
      ]
    : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={box}>
        <h3 style={{ ...h3, margin: 0 }}>
          Desglose y Control de Rubros (Materiales, Equipos y Mano de Obra)
        </h3>
        <div
          style={{
            marginTop: 12,
            background: '#EFF6FF',
            border: '1px solid #BFDBFE',
            borderRadius: 10,
            padding: '10px 14px',
            fontSize: 13,
            color: '#1E3A8A',
            lineHeight: 1.45,
          }}
        >
          El panel analiza las descripciones de egreso, las clasifica en rubros oficiales de la
          obra, estima cantidades y precios unitarios, y consolida duplicados en conceptos.
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 10,
        }}
      >
        <label style={field}>
          <span style={label}>Seleccionar Proveedor</span>
          <select
            value={filtroProveedor}
            onChange={(e) => setFiltroProveedor(e.target.value)}
            style={input}
          >
            <option value="">Todos los proveedores</option>
            {proveedores.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <label style={field}>
          <span style={label}>Buscar por Texto</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Concepto, descripción, proveedor…"
            style={input}
          />
        </label>
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <button type="button" onClick={() => void cargar()} style={btnSecondary}>
            {loading ? 'Cargando…' : 'Actualizar'}
          </button>
        </div>
      </div>

      {error ? (
        <div style={{ ...box, borderColor: '#FECACA', background: '#FEF2F2', color: '#991B1B' }}>
          {error}
        </div>
      ) : null}

      {loading && !kpis ? (
        <div style={{ display: 'flex', gap: 8, color: '#64748B', alignItems: 'center' }}>
          <Loader2 className="animate-spin" size={16} /> Cargando rubros…
        </div>
      ) : null}

      {kpisFiltrados ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 10,
          }}
        >
          {kpiCards.map((c) => (
            <div
              key={c.label}
              style={{
                background: '#fff',
                borderRadius: 12,
                border: '1px solid #E2E8F0',
                borderTop: `3px solid ${c.accent ?? '#64748B'}`,
                padding: '12px 14px',
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: 11,
                  fontWeight: 800,
                  color: '#64748B',
                  letterSpacing: '0.02em',
                }}
              >
                {c.label}
              </p>
              <p
                style={{
                  margin: '6px 0 0',
                  fontSize: 18,
                  fontWeight: 800,
                  color: '#0F172A',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {fmtUsd(c.value)}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      <div style={box}>
        <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700 }}>
          Seleccionar Tipo de Visualización:
        </p>
        <label style={radioRow}>
          <input
            type="radio"
            checked={vista === 'resumen'}
            onChange={() => setVista('resumen')}
          />
          Resumen Agrupado (Consolidado)
        </label>
        <label style={radioRow}>
          <input
            type="radio"
            checked={vista === 'detalle'}
            onChange={() => setVista('detalle')}
          />
          Detalle de Transacciones Individuales
        </label>
      </div>

      {vista === 'resumen' ? (
        <>
          <div style={box}>
            <h4 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 800 }}>
              Distribución de Costos por Rubro Oficial (USD)
            </h4>
            <p style={{ margin: '0 0 12px', fontSize: 12, color: '#64748B' }}>
              Gasto neto ejecutado según filtros actuales
            </p>
            {pieFiltrado.length === 0 ? (
              <p style={muted}>Sin datos para el filtro actual.</p>
            ) : (
              <>
                <div style={{ width: '100%', height: 280 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieFiltrado}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={70}
                        outerRadius={110}
                        paddingAngle={1}
                        label={(props) => {
                          const name = String(props.name ?? '');
                          const pct = Number(props.percent ?? 0) * 100;
                          return `${name.slice(0, 14)} ${pct.toFixed(1)}%`;
                        }}
                      >
                        {pieFiltrado.map((t) => (
                          <Cell key={t.name} fill={t.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(v, name) => [
                          `${fmtUsd(Number(v))} (${((Number(v) / pieTotal) * 100).toFixed(1)}%)`,
                          String(name),
                        ]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ul
                  style={{
                    listStyle: 'none',
                    margin: '8px 0 0',
                    padding: 0,
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                    gap: '6px 10px',
                  }}
                >
                  {pieFiltrado.map((t) => (
                    <li
                      key={t.name}
                      style={{
                        display: 'flex',
                        gap: 6,
                        fontSize: 11,
                        color: '#334155',
                        alignItems: 'flex-start',
                      }}
                    >
                      <span
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: 2,
                          background: t.color,
                          marginTop: 2,
                          flexShrink: 0,
                        }}
                      />
                      <span>
                        <strong>{t.name}</strong>
                        <span style={{ display: 'block', color: '#64748B' }}>
                          {fmtUsdCorto(t.value)} · {((t.value / pieTotal) * 100).toFixed(1)}%
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          <div style={box}>
            <h4 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 800 }}>Exportar Rubros</h4>
            <p style={{ margin: '0 0 12px', fontSize: 12, color: '#64748B' }}>
              Descarga los datos procesados según la vista y los filtros seleccionados.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <button type="button" onClick={exportExcel} style={btn('#15803D')}>
                Descargar Reporte en Excel (Formato Profesional)
              </button>
              <button type="button" onClick={exportCsv} style={btn('#1D4ED8')}>
                Descargar Tabla Clasificada (CSV)
              </button>
            </div>
          </div>

          <div style={box}>
            <h4 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 800 }}>
              Resumen Consolidado de Conceptos por Rubro
            </h4>
            <p style={{ margin: '0 0 14px', fontSize: 12, color: '#64748B', lineHeight: 1.45 }}>
              Híbrido sin factura fina: unifica nombres (p. ej. cemento/cemnto/CMT → CEMENTO). En
              cemento, si no hay bolsas, convierte paletas × 48 y divide el precio entre sacos.
            </p>
            {seccionesFiltradas.length === 0 ? (
              <p style={muted}>Sin conceptos consolidados en el filtro actual.</p>
            ) : (
              seccionesFiltradas.map((sec, idx) => (
                <div key={sec.key} style={{ marginBottom: 22 }}>
                  <h5
                    style={{
                      margin: '0 0 8px',
                      fontSize: 14,
                      fontWeight: 800,
                      color: '#0F172A',
                    }}
                  >
                    {sec.icon} {idx + 1}. {sec.titulo}{' '}
                    <span style={{ color: '#64748B', fontWeight: 700 }}>
                      (Subtotal Gasto Neto: {fmtUsd(sec.subtotal)} USD)
                    </span>
                  </h5>
                  <div style={{ overflow: 'auto' }}>
                    <table style={table}>
                      <thead>
                        <tr>
                          {['Concepto / Ítem', 'Cant. Total', 'Unidad', 'Precio Promedio USD', 'Costo Total USD'].map(
                            (h) => (
                              <th key={h} style={th}>
                                {h}
                              </th>
                            ),
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {sec.conceptos.map((c, i) => (
                          <tr
                            key={`${sec.key}-${c.concepto}-${c.unidad}`}
                            style={{ background: i % 2 ? '#F8FAFC' : '#fff' }}
                          >
                            <td style={td}>{c.concepto}</td>
                            <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                              {fmtNum(c.cantidad)}
                            </td>
                            <td style={{ ...td, textAlign: 'center' }}>{c.unidad}</td>
                            <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                              {fmtUsd(c.precioPromedio)}
                            </td>
                            <td
                              style={{
                                ...td,
                                textAlign: 'right',
                                fontWeight: 700,
                                fontVariantNumeric: 'tabular-nums',
                              }}
                            >
                              {fmtUsd(c.costoTotal)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      ) : null}

      <div style={box}>
        <h4 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 800 }}>
          Auditar y Editar Transacciones Individuales por Rubro
        </h4>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 10,
            marginBottom: 12,
          }}
        >
          <label style={field}>
            <span style={label}>Seleccionar Rubro para Auditar</span>
            <select
              value={auditRubro}
              onChange={(e) => {
                setAuditRubro(e.target.value);
                setAuditConcepto('Todos');
              }}
              style={input}
            >
              {(pie.length ? pie.map((p) => p.name) : ['MATERIALES']).map((name, i) => (
                <option key={name} value={name}>
                  {i + 1}. {name}
                </option>
              ))}
            </select>
          </label>
          <label style={field}>
            <span style={label}>Seleccionar Concepto para desglosar</span>
            <select
              value={auditConcepto}
              onChange={(e) => setAuditConcepto(e.target.value)}
              style={input}
            >
              <option value="Todos">Todos</option>
              {conceptosAudit.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p style={{ margin: '0 0 10px', fontSize: 13, color: '#334155' }}>
          Mostrando gastos individuales para:{' '}
          <strong>
            {auditConcepto} ({txAudit.length} transacciones)
          </strong>
        </p>
        {txAudit.length === 0 ? (
          <p style={muted}>Sin transacciones para este rubro/concepto.</p>
        ) : (
          <div style={{ overflow: 'auto', maxHeight: 480 }}>
            <table style={table}>
              <thead>
                <tr>
                  {[
                    'Seleccionar',
                    'Fecha',
                    'Proveedor',
                    'Descripción del Registro',
                    'Cant.',
                    'Unidad',
                    'Precio Unit. USD',
                    'Gasto Neto USD',
                    'Costo Total USD',
                  ].map((h) => (
                    <th key={h} style={th}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {txAudit.map((t, i) => {
                  const key = t.lineaId ?? `${t.id}-${i}`;
                  const checked = seleccion.has(key);
                  return (
                    <tr key={key} style={{ background: i % 2 ? '#F8FAFC' : '#fff' }}>
                      <td style={{ ...td, textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            setSeleccion((prev) => {
                              const next = new Set(prev);
                              if (next.has(key)) next.delete(key);
                              else next.add(key);
                              return next;
                            });
                          }}
                        />
                      </td>
                      <td style={td}>{fmtFecha(t.fecha)}</td>
                      <td style={td}>{t.proveedor}</td>
                      <td style={td}>{t.descripcion}</td>
                      <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {fmtNum(t.cantidad)}
                      </td>
                      <td style={{ ...td, textAlign: 'center' }}>{t.unidad}</td>
                      <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {fmtUsd(t.precioUnitario)}
                      </td>
                      <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {fmtUsd(t.gastoNeto)}
                      </td>
                      <td
                        style={{
                          ...td,
                          textAlign: 'right',
                          fontWeight: 700,
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {fmtUsd(t.costoTotal)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {vista === 'detalle' ? (
        <div style={box}>
          <h4 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 800 }}>
            Detalle de Transacciones Individuales ({txFiltradas.length})
          </h4>
          <div style={{ overflow: 'auto', maxHeight: 520 }}>
            <table style={table}>
              <thead>
                <tr>
                  {['Fecha', 'Rubro', 'Proveedor', 'Concepto', 'Descripción', 'Gasto Neto', 'Costo Total'].map(
                    (h) => (
                      <th key={h} style={th}>
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {txFiltradas.map((t, i) => (
                  <tr
                    key={`${t.id}-${t.lineaId ?? i}`}
                    style={{ background: i % 2 ? '#F8FAFC' : '#fff' }}
                  >
                    <td style={td}>{fmtFecha(t.fecha)}</td>
                    <td style={td}>{t.tipo}</td>
                    <td style={td}>{t.proveedor}</td>
                    <td style={td}>{t.concepto}</td>
                    <td style={td}>{t.descripcion}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{fmtUsd(t.gastoNeto)}</td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>
                      {fmtUsd(t.costoTotal)}
                    </td>
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
const h3: React.CSSProperties = { margin: '0 0 6px', fontSize: 18, fontWeight: 800 };
const muted: React.CSSProperties = { margin: 0, color: '#64748B', fontSize: 13 };
const field: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6 };
const label: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: '#475569' };
const input: React.CSSProperties = {
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid #CBD5E1',
  background: '#F8FAFC',
  fontSize: 13,
};
const radioRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 13,
  fontWeight: 600,
  color: '#334155',
  marginBottom: 6,
};
const table: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 12,
};
const th: React.CSSProperties = {
  padding: '8px 6px',
  background: '#334155',
  color: '#fff',
  textAlign: 'left',
  whiteSpace: 'nowrap',
  position: 'sticky',
  top: 0,
};
const td: React.CSSProperties = {
  padding: '7px 6px',
  borderTop: '1px solid #E2E8F0',
  color: '#334155',
};
const btnSecondary: React.CSSProperties = {
  border: '1px solid #CBD5E1',
  background: '#F8FAFC',
  color: '#0F172A',
  borderRadius: 8,
  padding: '8px 12px',
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
};

function btn(bg: string): React.CSSProperties {
  return {
    background: bg,
    color: '#fff',
    border: 0,
    borderRadius: 8,
    padding: '10px 14px',
    fontWeight: 700,
    fontSize: 12,
    cursor: 'pointer',
  };
}
