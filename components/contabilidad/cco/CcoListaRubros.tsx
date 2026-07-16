'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Folder, FolderOpen, Loader2 } from 'lucide-react';
import {
  MESES_CORTO,
  type CcoListaRubros,
  type CcoRubroNodo,
} from '@/lib/contabilidad/cargarCcoListaRubros';

type Props = {
  proyectoId: string;
};

function fmtUsd(n: number): string {
  if (!n) return '—';
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtUsdCompact(n: number): string {
  if (!n) return '';
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function collectExpandableIds(nodos: CcoRubroNodo[]): string[] {
  const ids: string[] = [];
  for (const n of nodos) {
    if (n.hijos.length > 0) {
      ids.push(n.id);
      ids.push(...collectExpandableIds(n.hijos));
    }
  }
  return ids;
}

function filterTree(
  nodos: CcoRubroNodo[],
  opts: { mes: number | null; rubroId: string; query: string },
): CcoRubroNodo[] {
  const q = opts.query.trim().toLowerCase();

  const walk = (nodes: CcoRubroNodo[], inheritedRubroMatch: boolean): CcoRubroNodo[] => {
    const out: CcoRubroNodo[] = [];
    for (const n of nodes) {
      const selfRubro = opts.rubroId === '' || n.id === opts.rubroId || inheritedRubroMatch;
      const hijos = walk(n.hijos, selfRubro && n.nivel === 'rubro' ? true : inheritedRubroMatch);

      const mesOk =
        opts.mes == null || n.meses[opts.mes] > 0 || hijos.some((h) => h.meses[opts.mes!] > 0 || h.total > 0);
      const textOk =
        !q ||
        n.codigo.toLowerCase().includes(q) ||
        n.nombre.toLowerCase().includes(q) ||
        n.descripcion.toLowerCase().includes(q) ||
        hijos.length > 0;

      const rubroOk =
        opts.rubroId === '' ||
        n.id === opts.rubroId ||
        inheritedRubroMatch ||
        hijos.length > 0 ||
        (n.nivel === 'capitulo' && n.hijos.some((h) => h.id === opts.rubroId));

      if (!mesOk || !textOk || !rubroOk) continue;

      if (opts.rubroId && n.nivel === 'capitulo') {
        const only = n.hijos.filter((h) => h.id === opts.rubroId || hijos.some((x) => x.id === h.id));
        const filteredHijos = hijos.length ? hijos : only;
        if (filteredHijos.length === 0 && n.id !== opts.rubroId) continue;
        out.push({ ...n, hijos: filteredHijos.length ? filteredHijos : hijos });
        continue;
      }

      out.push({ ...n, hijos });
    }
    return out;
  };

  return walk(nodos, false);
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

export default function CcoListaRubros({ proyectoId }: Props) {
  const [data, setData] = useState<CcoListaRubros | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [anioOverride, setAnioOverride] = useState<number | null>(null);
  const [mes, setMes] = useState<number | null>(null);
  const [rubroId, setRubroId] = useState('');
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (proyectoId) qs.set('proyecto', proyectoId);
      if (anioOverride != null) qs.set('anio', String(anioOverride));
      const res = await fetch(`/api/contabilidad/cco-rubros?${qs}`, { cache: 'no-store' });
      const json = (await res.json()) as CcoListaRubros & { ok?: boolean; error?: string };
      if (!res.ok || json.ok === false) throw new Error(json.error ?? 'Error al cargar rubros');
      setData(json);
      setExpanded(new Set(collectExpandableIds(json.nodos).slice(0, 40)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar rubros');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [proyectoId, anioOverride]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const filtrados = useMemo(() => {
    if (!data) return [];
    return filterTree(data.nodos, { mes, rubroId, query });
  }, [data, mes, rubroId, query]);

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => setExpanded(new Set(collectExpandableIds(filtrados)));
  const collapseAll = () => setExpanded(new Set());

  const renderRows = (nodos: CcoRubroNodo[], depth = 0): React.ReactNode[] => {
    const rows: React.ReactNode[] = [];
    for (const n of nodos) {
      const hasKids = n.hijos.length > 0;
      const open = expanded.has(n.id);
      const isCap = n.nivel === 'capitulo';
      const isRubro = n.nivel === 'rubro';
      const bg = isCap ? '#EEF2FF' : isRubro ? '#F8FAFC' : '#fff';
      const padLeft = 10 + depth * 18;

      rows.push(
        <tr key={n.id} style={{ background: bg }}>
          <td
            style={{
              padding: '7px 8px',
              borderBottom: '1px solid #E2E8F0',
              width: 36,
              textAlign: 'center',
            }}
          >
            <input
              type="checkbox"
              checked={selected.has(n.id)}
              onChange={() => toggleSelect(n.id)}
              aria-label={`Seleccionar ${n.nombre}`}
            />
          </td>
          <td
            style={{
              padding: '7px 8px',
              borderBottom: '1px solid #E2E8F0',
              fontWeight: isCap ? 800 : 600,
              color: '#0F172A',
              whiteSpace: 'nowrap',
              fontVariantNumeric: 'tabular-nums',
              fontSize: 12,
            }}
          >
            {n.codigo}
          </td>
          <td
            style={{
              padding: `7px 8px 7px ${padLeft}px`,
              borderBottom: '1px solid #E2E8F0',
              minWidth: 220,
            }}
          >
            <button
              type="button"
              onClick={() => (hasKids ? toggle(n.id) : undefined)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: 'transparent',
                border: 'none',
                padding: 0,
                cursor: hasKids ? 'pointer' : 'default',
                color: '#0F172A',
                fontWeight: isCap ? 800 : isRubro ? 700 : 500,
                fontSize: isCap ? 13 : 12,
                textAlign: 'left',
              }}
            >
              {hasKids ? (
                open ? (
                  <ChevronDown size={14} color="#64748B" />
                ) : (
                  <ChevronRight size={14} color="#64748B" />
                )
              ) : (
                <span style={{ width: 14 }} />
              )}
              {isCap ? (
                open ? (
                  <FolderOpen size={14} color="#2563EB" />
                ) : (
                  <Folder size={14} color="#2563EB" />
                )
              ) : null}
              <span>{n.nombre}</span>
            </button>
          </td>
          <td
            style={{
              padding: '7px 8px',
              borderBottom: '1px solid #E2E8F0',
              color: '#64748B',
              fontSize: 11,
              maxWidth: 220,
            }}
          >
            {n.descripcion}
          </td>
          {n.meses.map((v, i) => {
            const highlight = mes === i;
            return (
              <td
                key={`${n.id}-m${i}`}
                style={{
                  padding: '7px 6px',
                  borderBottom: '1px solid #E2E8F0',
                  textAlign: 'right',
                  fontVariantNumeric: 'tabular-nums',
                  fontSize: 11,
                  fontWeight: isCap || isRubro ? 700 : 500,
                  color: v ? '#0F172A' : '#CBD5E1',
                  background: highlight ? 'rgba(37,99,235,0.08)' : undefined,
                  whiteSpace: 'nowrap',
                }}
              >
                {v ? fmtUsdCompact(v) : '—'}
              </td>
            );
          })}
          <td
            style={{
              padding: '7px 8px',
              borderBottom: '1px solid #E2E8F0',
              textAlign: 'right',
              fontVariantNumeric: 'tabular-nums',
              fontSize: 12,
              fontWeight: 800,
              color: '#1E3A8A',
              whiteSpace: 'nowrap',
            }}
          >
            {fmtUsd(n.total)}
          </td>
        </tr>,
      );

      if (hasKids && open) {
        rows.push(...renderRows(n.hijos, depth + 1));
      }
    }
    return rows;
  };

  const totalGeneral = useMemo(
    () => filtrados.reduce((s, n) => s + n.total, 0),
    [filtrados],
  );

  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 14,
        border: '1px solid #E2E8F0',
        padding: '20px 22px 16px',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#0F172A' }}>
            Reporte de Rubros por Mes
          </h2>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: '#64748B' }}>
            {data?.fuente === 'lulo'
              ? 'Jerarquía Lulo (capítulo → rubro → partida) con ejecución mensual de la obra.'
              : 'Agrupación por tipo de gasto del libro CI (compras) con desglose mensual.'}
            {proyectoId ? '' : ' Selecciona una obra para ver partidas presupuestarias.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={expandAll} style={btnGhost}>
            Expandir
          </button>
          <button type="button" onClick={collapseAll} style={btnGhost}>
            Colapsar
          </button>
          <button type="button" onClick={() => void cargar()} style={btnGhost}>
            Actualizar
          </button>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div>
          <label style={labelStyle}>Año</label>
          <select
            value={anioOverride ?? data?.anio ?? ''}
            onChange={(e) => setAnioOverride(Number(e.target.value))}
            style={selectStyle}
          >
            {(data?.aniosDisponibles ?? (data?.anio ? [data.anio] : [])).map((y) => (
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
            value={rubroId}
            onChange={(e) => setRubroId(e.target.value)}
            style={selectStyle}
          >
            <option value="">Todos</option>
            {(data?.rubrosFiltro ?? []).map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Buscar</label>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Código o nombre…"
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
            padding: 48,
            color: '#64748B',
          }}
        >
          <Loader2 className="animate-spin" size={18} />
          Cargando rubros…
        </div>
      ) : error ? (
        <p style={{ color: '#DC2626', fontSize: 14, padding: 16 }}>{error}</p>
      ) : filtrados.length === 0 ? (
        <p style={{ color: '#94A3B8', fontSize: 14, padding: 24, textAlign: 'center' }}>
          Sin rubros para el filtro actual.
        </p>
      ) : (
        <div style={{ overflow: 'auto', maxHeight: '70vh', border: '1px solid #E2E8F0', borderRadius: 10 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1100 }}>
            <thead>
              <tr style={{ background: '#F1F5F9' }}>
                <th style={thStyle} />
                <th style={{ ...thStyle, textAlign: 'left' }}>Código</th>
                <th style={{ ...thStyle, textAlign: 'left' }}>Nombre</th>
                <th style={{ ...thStyle, textAlign: 'left' }}>Descripción</th>
                {MESES_CORTO.map((m, i) => (
                  <th
                    key={m}
                    style={{
                      ...thStyle,
                      textAlign: 'right',
                      background: mes === i ? '#DBEAFE' : '#F1F5F9',
                    }}
                  >
                    {m}
                  </th>
                ))}
                <th style={{ ...thStyle, textAlign: 'right', color: '#1E3A8A' }}>Total</th>
              </tr>
            </thead>
            <tbody>{renderRows(filtrados)}</tbody>
            <tfoot>
              <tr style={{ background: '#EEF2FF' }}>
                <td colSpan={4} style={{ padding: '10px 12px', fontWeight: 800, color: '#1E3A8A' }}>
                  TOTAL GENERAL
                </td>
                {emptyMesesTotals(filtrados).map((v, i) => (
                  <td
                    key={`tot-${i}`}
                    style={{
                      padding: '10px 6px',
                      textAlign: 'right',
                      fontWeight: 800,
                      fontVariantNumeric: 'tabular-nums',
                      fontSize: 11,
                      color: '#1E3A8A',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {v ? fmtUsdCompact(v) : '—'}
                  </td>
                ))}
                <td
                  style={{
                    padding: '10px 8px',
                    textAlign: 'right',
                    fontWeight: 800,
                    fontVariantNumeric: 'tabular-nums',
                    color: '#1E3A8A',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {fmtUsd(totalGeneral)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

function emptyMesesTotals(nodos: CcoRubroNodo[]): number[] {
  const meses = Array.from({ length: 12 }, () => 0);
  for (const n of nodos) {
    for (let i = 0; i < 12; i++) meses[i] += n.meses[i] ?? 0;
  }
  return meses;
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 700,
  color: '#64748B',
  marginBottom: 4,
};

const thStyle: React.CSSProperties = {
  padding: '9px 8px',
  fontSize: 11,
  fontWeight: 800,
  color: '#64748B',
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  borderBottom: '1px solid #CBD5E1',
  position: 'sticky',
  top: 0,
  background: '#F1F5F9',
  zIndex: 1,
  whiteSpace: 'nowrap',
};

const btnGhost: React.CSSProperties = {
  border: '1px solid #CBD5E1',
  background: '#F8FAFC',
  color: '#334155',
  borderRadius: 8,
  padding: '6px 10px',
  fontSize: 12,
  fontWeight: 700,
  cursor: 'pointer',
};
