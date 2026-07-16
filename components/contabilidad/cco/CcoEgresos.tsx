'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Eye, Loader2, Pencil, Trash2 } from 'lucide-react';
import { CCO_TIPOS_GASTO } from '@/lib/contabilidad/ccoClasificarGasto';
import { MESES_CORTO } from '@/lib/contabilidad/cargarCcoListaRubros';
import type { CcoEgresoFila, CcoEgresosPayload } from '@/lib/contabilidad/cargarCcoEgresos';

type Props = {
  proyectoId: string;
  proyectos: { id: string; nombre: string }[];
};

const PAGE_SIZE = 15;

function fmtUsd(n: number): string {
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtFecha(iso: string): string {
  const s = iso.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return iso;
  const [y, m, d] = s.split('-');
  return `${d}/${m}/${y}`;
}

function estadoTone(estado: string): { bg: string; color: string } {
  const u = estado.toUpperCase();
  if (/REGISTR|PAGAD|OK|CONFIRM/.test(u)) return { bg: 'rgba(34,197,94,0.12)', color: '#15803D' };
  if (/PEND|BORRADOR|DRAFT/.test(u)) return { bg: 'rgba(245,158,11,0.15)', color: '#B45309' };
  if (/ANUL|CANCEL|ERROR/.test(u)) return { bg: 'rgba(239,68,68,0.12)', color: '#B91C1C' };
  return { bg: 'rgba(100,116,139,0.12)', color: '#475569' };
}

function KpiCard({
  title,
  value,
  footnote,
  accent,
}: {
  title: string;
  value: string;
  footnote: string;
  accent: string;
}) {
  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 12,
        border: '1px solid #E2E8F0',
        borderTop: `4px solid ${accent}`,
        padding: '14px 16px',
        minHeight: 104,
        boxShadow: '0 1px 3px rgba(15,23,42,0.06)',
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: '#64748B',
        }}
      >
        {title}
      </p>
      <p
        style={{
          margin: '10px 0 6px',
          fontSize: 22,
          fontWeight: 800,
          color: '#0F172A',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </p>
      <p style={{ margin: 0, fontSize: 12, color: '#64748B' }}>{footnote}</p>
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  borderRadius: 8,
  border: '1px solid #CBD5E1',
  background: '#fff',
  color: '#0F172A',
  fontSize: 14,
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 700,
  color: '#64748B',
  marginBottom: 4,
};

export default function CcoEgresos({ proyectoId, proyectos }: Props) {
  const [data, setData] = useState<CcoEgresosPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [anioOverride, setAnioOverride] = useState<number | null>(null);
  const [mes, setMes] = useState<number | null>(null);
  const [rubroFiltro, setRubroFiltro] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [vista, setVista] = useState<'lista' | 'rubro' | 'mes'>('lista');

  const [formFecha, setFormFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [formRubro, setFormRubro] = useState<string>('MATERIALES');
  const [formMonto, setFormMonto] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formProv, setFormProv] = useState('');
  const [saving, setSaving] = useState(false);
  const [formMsg, setFormMsg] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (proyectoId) qs.set('proyecto', proyectoId);
      if (anioOverride != null) qs.set('anio', String(anioOverride));
      if (mes != null) qs.set('mes', String(mes + 1));
      const res = await fetch(`/api/contabilidad/cco-egresos?${qs}`, { cache: 'no-store' });
      const json = (await res.json()) as CcoEgresosPayload & { ok?: boolean; error?: string };
      if (!res.ok || json.ok === false) throw new Error(json.error ?? 'Error al cargar egresos');
      setData(json);
      setPage(0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar egresos');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [proyectoId, anioOverride, mes]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const filasFiltradas = useMemo(() => {
    let rows = data?.filas ?? [];
    if (rubroFiltro) {
      rows = rows.filter((r) => String(r.rubro).toUpperCase() === rubroFiltro.toUpperCase());
    }
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      rows = rows.filter(
        (r) =>
          r.descripcion.toLowerCase().includes(q) ||
          r.proveedor.toLowerCase().includes(q) ||
          r.factura.toLowerCase().includes(q) ||
          r.rubro.toLowerCase().includes(q),
      );
    }
    return rows;
  }, [data, rubroFiltro, query]);

  const pageCount = Math.max(1, Math.ceil(filasFiltradas.length / PAGE_SIZE));
  const pageRows = filasFiltradas.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllPage = () => {
    const ids = pageRows.map((r) => r.id);
    const allOn = ids.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOn) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return next;
    });
  };

  const eliminar = async (id: string) => {
    if (!confirm('¿Eliminar este egreso del libro de compras?')) return;
    const res = await fetch(`/api/contabilidad/cco-egresos?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    const json = (await res.json()) as { ok?: boolean; error?: string };
    if (!res.ok || json.ok === false) {
      alert(json.error ?? 'No se pudo eliminar');
      return;
    }
    void cargar();
  };

  const guardarManual = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormMsg(null);
    const obra = proyectoId || proyectos[0]?.id || '';
    if (!obra) {
      setFormMsg('Selecciona una obra en el filtro superior del CCO.');
      return;
    }
    const monto = Number(formMonto);
    if (!(monto > 0)) {
      setFormMsg('Indica un monto válido en USD.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/contabilidad/cco-egresos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proyectoId: obra,
          fecha: formFecha,
          rubro: formRubro,
          montoUsd: monto,
          descripcion: formDesc,
          proveedor: formProv || undefined,
        }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || json.ok === false) throw new Error(json.error ?? 'Error al guardar');
      setFormDesc('');
      setFormMonto('');
      setFormProv('');
      setFormMsg('Egreso registrado en el libro CI.');
      void cargar();
    } catch (err) {
      setFormMsg(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const kpis = data?.kpis;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 12,
        }}
      >
        <KpiCard
          title="Ingresos"
          value={fmtUsd(kpis?.ingresos ?? 0)}
          footnote={`${kpis?.countIngresos ?? 0} inyecciones`}
          accent="#22C55E"
        />
        <KpiCard
          title="Egresos"
          value={fmtUsd(kpis?.egresos ?? 0)}
          footnote={`${kpis?.countEgresos ?? 0} registros`}
          accent="#EF4444"
        />
        <KpiCard
          title="Saldo"
          value={fmtUsd(kpis?.saldo ?? 0)}
          footnote="Ingresos − costo total"
          accent="#3B82F6"
        />
        <KpiCard
          title="Admin delegada"
          value={fmtUsd(kpis?.adminDelegada ?? 0)}
          footnote={`${(data?.honorariosPct ?? 12).toFixed(1)}% honorarios`}
          accent="#B45309"
        />
        <KpiCard
          title="Costo total"
          value={fmtUsd(kpis?.costoTotal ?? 0)}
          footnote="Egresos + admin"
          accent="#7C3AED"
        />
        <KpiCard
          title="Obra"
          value={
            proyectoId
              ? proyectos.find((p) => p.id === proyectoId)?.nombre?.slice(0, 18) || 'Seleccionada'
              : 'Todas'
          }
          footnote="Filtro del panel CCO"
          accent="#0EA5E9"
        />
      </div>

      <div
        style={{
          background: '#fff',
          borderRadius: 14,
          border: '1px solid #E2E8F0',
          padding: '18px 20px',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            marginBottom: 14,
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Lista de Egresos</h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748B' }}>
              Compras de obra del libro CI · Consulta de egresos
            </p>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {(
              [
                ['lista', 'Lista'],
                ['rubro', 'Por rubro'],
                ['mes', 'Por mes'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setVista(id)}
                style={{
                  border: '1px solid #CBD5E1',
                  background: vista === id ? '#DBEAFE' : '#F8FAFC',
                  color: vista === id ? '#1D4ED8' : '#334155',
                  borderRadius: 8,
                  padding: '6px 10px',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: 10,
            marginBottom: 14,
          }}
        >
          <div>
            <label style={labelStyle}>Año</label>
            <select
              value={anioOverride ?? data?.anio ?? ''}
              onChange={(e) => setAnioOverride(Number(e.target.value))}
              style={selectStyle}
            >
              {(data?.aniosDisponibles ?? []).map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Mes</label>
            <select
              value={mes == null ? 'todos' : String(mes)}
              onChange={(e) =>
                setMes(e.target.value === 'todos' ? null : Number(e.target.value))
              }
              style={selectStyle}
            >
              <option value="todos">Todos</option>
              {MESES_CORTO.map((m, i) => (
                <option key={m} value={i}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Rubro</label>
            <select
              value={rubroFiltro}
              onChange={(e) => setRubroFiltro(e.target.value)}
              style={selectStyle}
            >
              <option value="">Todos</option>
              {CCO_TIPOS_GASTO.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Buscar</label>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Descripción, proveedor…"
              style={selectStyle}
            />
          </div>
        </div>

        {loading ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: 40,
              color: '#64748B',
            }}
          >
            <Loader2 className="animate-spin" size={18} />
            Cargando egresos…
          </div>
        ) : error ? (
          <p style={{ color: '#DC2626', fontSize: 14 }}>{error}</p>
        ) : vista === 'lista' ? (
          <>
            <div style={{ overflow: 'auto', border: '1px solid #E2E8F0', borderRadius: 10 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 920 }}>
                <thead>
                  <tr style={{ background: '#F1F5F9' }}>
                    <th style={th}>
                      <input
                        type="checkbox"
                        checked={
                          pageRows.length > 0 && pageRows.every((r) => selected.has(r.id))
                        }
                        onChange={toggleAllPage}
                        aria-label="Seleccionar página"
                      />
                    </th>
                    <th style={{ ...th, textAlign: 'left' }}>#</th>
                    <th style={{ ...th, textAlign: 'left' }}>Fecha</th>
                    <th style={{ ...th, textAlign: 'left' }}>Descripción</th>
                    <th style={{ ...th, textAlign: 'left' }}>Rubro</th>
                    <th style={{ ...th, textAlign: 'left' }}>Tipo</th>
                    <th style={{ ...th, textAlign: 'right' }}>Monto</th>
                    <th style={{ ...th, textAlign: 'left' }}>Estado</th>
                    <th style={{ ...th, textAlign: 'center' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ padding: 24, textAlign: 'center', color: '#94A3B8' }}>
                        Sin egresos para el filtro actual
                      </td>
                    </tr>
                  ) : (
                    pageRows.map((r, idx) => (
                      <EgresoRow
                        key={r.id}
                        row={r}
                        index={page * PAGE_SIZE + idx + 1}
                        selected={selected.has(r.id)}
                        onToggle={() => toggleSelect(r.id)}
                        onDelete={() => void eliminar(r.id)}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: 12,
                fontSize: 13,
                color: '#64748B',
              }}
            >
              <span>
                {filasFiltradas.length} egreso(s)
                {selected.size ? ` · ${selected.size} seleccionado(s)` : ''}
              </span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button
                  type="button"
                  disabled={page <= 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  style={btnPage}
                >
                  ←
                </button>
                <span>
                  {page + 1} / {pageCount}
                </span>
                <button
                  type="button"
                  disabled={page >= pageCount - 1}
                  onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                  style={btnPage}
                >
                  →
                </button>
              </div>
            </div>
          </>
        ) : vista === 'rubro' ? (
          <ResumenAgrupado
            filas={filasFiltradas}
            groupBy={(r) => String(r.rubro)}
            title="Egresos por rubro"
          />
        ) : (
          <ResumenAgrupado
            filas={filasFiltradas}
            groupBy={(r) => r.fecha.slice(0, 7)}
            title="Egresos por mes"
          />
        )}
      </div>

      <div
        style={{
          background: '#EFF6FF',
          borderRadius: 14,
          border: '1px solid #BFDBFE',
          padding: '18px 20px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <AlertTriangle size={18} color="#D97706" />
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#0F172A' }}>
            Carga Manual de Egresos
          </h3>
        </div>
        <p style={{ margin: '0 0 14px', fontSize: 13, color: '#475569' }}>
          Nueva entrada de egresos al libro de compras de la obra. Se registra como origen{' '}
          <strong>CCO_MANUAL</strong>.
          {!proyectoId ? (
            <span style={{ color: '#B45309' }}>
              {' '}
              Tip: elige una obra arriba en el panel CCO para imputarla correctamente.
            </span>
          ) : null}
        </p>

        <form
          onSubmit={(e) => void guardarManual(e)}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 12,
          }}
        >
          <div>
            <label style={labelStyle}>Fecha</label>
            <input
              type="date"
              value={formFecha}
              onChange={(e) => setFormFecha(e.target.value)}
              style={selectStyle}
              required
            />
          </div>
          <div>
            <label style={labelStyle}>Rubro / categoría</label>
            <select
              value={formRubro}
              onChange={(e) => setFormRubro(e.target.value)}
              style={selectStyle}
            >
              {CCO_TIPOS_GASTO.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Monto (USD)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={formMonto}
              onChange={(e) => setFormMonto(e.target.value)}
              style={selectStyle}
              placeholder="0.00"
              required
            />
          </div>
          <div>
            <label style={labelStyle}>Proveedor (opcional)</label>
            <input
              value={formProv}
              onChange={(e) => setFormProv(e.target.value)}
              style={selectStyle}
              placeholder="Nombre del proveedor"
            />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Descripción / concepto</label>
            <input
              value={formDesc}
              onChange={(e) => setFormDesc(e.target.value)}
              style={selectStyle}
              placeholder="Ej. Compra de materiales, pago de servicios…"
              required
            />
          </div>
          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 10, alignItems: 'center' }}>
            <button
              type="submit"
              disabled={saving}
              style={{
                background: '#2563EB',
                color: '#fff',
                border: 'none',
                borderRadius: 10,
                padding: '10px 18px',
                fontWeight: 800,
                fontSize: 14,
                cursor: saving ? 'wait' : 'pointer',
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? 'Guardando…' : 'Registrar egreso'}
            </button>
            <Link
              href="/contabilidad/compras"
              style={{ color: '#2563EB', fontWeight: 700, fontSize: 13, textDecoration: 'none' }}
            >
              Abrir cuadro de compras →
            </Link>
            {formMsg ? (
              <span style={{ fontSize: 13, color: formMsg.includes('registrado') ? '#15803D' : '#B91C1C' }}>
                {formMsg}
              </span>
            ) : null}
          </div>
        </form>
      </div>
    </div>
  );
}

function EgresoRow({
  row,
  index,
  selected,
  onToggle,
  onDelete,
}: {
  row: CcoEgresoFila;
  index: number;
  selected: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const tone = estadoTone(row.estado);
  return (
    <tr style={{ background: index % 2 === 0 ? '#fff' : '#F8FAFC' }}>
      <td style={tdCenter}>
        <input type="checkbox" checked={selected} onChange={onToggle} aria-label={`Sel ${index}`} />
      </td>
      <td style={{ ...td, fontVariantNumeric: 'tabular-nums', color: '#64748B' }}>{index}</td>
      <td style={{ ...td, whiteSpace: 'nowrap' }}>{fmtFecha(row.fecha)}</td>
      <td style={td}>
        <div style={{ fontWeight: 600, color: '#0F172A' }}>{row.descripcion}</div>
        <div style={{ fontSize: 11, color: '#94A3B8' }}>
          {row.proveedor} · {row.factura}
          {!row.proyectoId ? '' : ` · ${row.proyectoNombre}`}
        </div>
      </td>
      <td style={{ ...td, fontSize: 12, fontWeight: 700, color: '#334155' }}>{row.rubro}</td>
      <td style={{ ...td, fontSize: 11, color: '#64748B' }}>{row.origen || 'CI'}</td>
      <td
        style={{
          ...td,
          textAlign: 'right',
          fontWeight: 800,
          fontVariantNumeric: 'tabular-nums',
          whiteSpace: 'nowrap',
        }}
      >
        {fmtUsd(row.montoUsd)}
      </td>
      <td style={td}>
        <span
          style={{
            display: 'inline-block',
            padding: '3px 8px',
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 700,
            background: tone.bg,
            color: tone.color,
          }}
        >
          {row.estado}
        </span>
      </td>
      <td style={tdCenter}>
        <div style={{ display: 'inline-flex', gap: 6 }}>
          <Link
            href={`/contabilidad/compras?highlight=${encodeURIComponent(row.id)}`}
            title="Ver"
            style={iconBtn}
          >
            <Eye size={15} />
          </Link>
          <Link
            href={`/contabilidad/compras?edit=${encodeURIComponent(row.id)}`}
            title="Editar en compras"
            style={iconBtn}
          >
            <Pencil size={15} />
          </Link>
          <button type="button" title="Eliminar" onClick={onDelete} style={{ ...iconBtn, color: '#DC2626' }}>
            <Trash2 size={15} />
          </button>
        </div>
      </td>
    </tr>
  );
}

function ResumenAgrupado({
  filas,
  groupBy,
  title,
}: {
  filas: CcoEgresoFila[];
  groupBy: (r: CcoEgresoFila) => string;
  title: string;
}) {
  const groups = useMemo(() => {
    const map = new Map<string, { count: number; total: number }>();
    for (const r of filas) {
      const k = groupBy(r) || '—';
      const cur = map.get(k) ?? { count: 0, total: 0 };
      cur.count += 1;
      cur.total += r.montoUsd;
      map.set(k, cur);
    }
    return Array.from(map.entries())
      .map(([key, v]) => ({ key, ...v }))
      .sort((a, b) => b.total - a.total);
  }, [filas, groupBy]);

  return (
    <div>
      <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 800 }}>{title}</h3>
      <div style={{ overflow: 'auto', border: '1px solid #E2E8F0', borderRadius: 10 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#F1F5F9' }}>
              <th style={{ ...th, textAlign: 'left' }}>Grupo</th>
              <th style={{ ...th, textAlign: 'right' }}>Registros</th>
              <th style={{ ...th, textAlign: 'right' }}>Monto</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g, i) => (
              <tr key={g.key} style={{ background: i % 2 ? '#F8FAFC' : '#fff' }}>
                <td style={{ ...td, fontWeight: 700 }}>{g.key}</td>
                <td style={{ ...td, textAlign: 'right' }}>{g.count}</td>
                <td style={{ ...td, textAlign: 'right', fontWeight: 800 }}>{fmtUsd(g.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const th: React.CSSProperties = {
  padding: '9px 8px',
  fontSize: 11,
  fontWeight: 800,
  color: '#64748B',
  letterSpacing: '0.03em',
  textTransform: 'uppercase',
  borderBottom: '1px solid #CBD5E1',
  whiteSpace: 'nowrap',
};

const td: React.CSSProperties = {
  padding: '9px 8px',
  fontSize: 13,
  borderBottom: '1px solid #F1F5F9',
  color: '#0F172A',
  verticalAlign: 'top',
};

const tdCenter: React.CSSProperties = {
  ...td,
  textAlign: 'center',
};

const btnPage: React.CSSProperties = {
  border: '1px solid #CBD5E1',
  background: '#fff',
  borderRadius: 8,
  padding: '4px 10px',
  cursor: 'pointer',
  fontWeight: 700,
};

const iconBtn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 28,
  height: 28,
  borderRadius: 8,
  border: '1px solid #E2E8F0',
  background: '#fff',
  color: '#334155',
  cursor: 'pointer',
  textDecoration: 'none',
};
