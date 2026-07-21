'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Eye,
  FileText,
  Loader2,
  Pencil,
  RefreshCw,
} from 'lucide-react';
import { esDescripcionAuditoriaCco } from '@/lib/contabilidad/compraEsAuditoriaCco';
import { CCO_TIPOS_GASTO } from '@/lib/contabilidad/ccoClasificarGasto';
import { FORMAS_PAGO_CCO } from '@/lib/contabilidad/cco/egresosVista';
import type { CcoLibroFila } from '@/lib/contabilidad/cco/types';
import EgresoFacturaCell from '@/components/contabilidad/cco/EgresoFacturaCell';
import EgresoCargaSoportesPanel from '@/components/contabilidad/cco/EgresoCargaSoportesPanel';

const PAGE_SIZE = 15;

function fmtUsd(n: number): string {
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtFecha(iso: string | null): string {
  const s = String(iso ?? '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return '—';
  const [y, m, d] = s.split('-');
  return `${d}/${m}/${y.slice(2)}`;
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

type DraftLite = {
  tipo: string;
  forma_pago: string;
  estado: string;
  descripcion: string;
};

function toDraft(f: CcoLibroFila): DraftLite {
  return {
    tipo: f.tipo || '',
    forma_pago: f.forma_pago ?? '',
    estado: f.estado || 'PAGADO',
    descripcion: f.descripcion,
  };
}

export default function CcoTabEgresos({ proyectoId }: { proyectoId: string }) {
  const [filas, setFilas] = useState<CcoLibroFila[]>([]);
  const [ingresosTotal, setIngresosTotal] = useState(0);
  const [countIngresos, setCountIngresos] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [rubroFiltro, setRubroFiltro] = useState('');
  const [page, setPage] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, DraftLite>>({});
  const [dirty, setDirty] = useState<Set<string>>(new Set());

  const marcarDoc = useCallback((compraId: string, name: string) => {
    setFilas((prev) =>
      prev.map((row) =>
        row.id === compraId
          ? {
              ...row,
              tiene_documento: true,
              document_file_name: name,
              link_factura: `/api/contabilidad/compras/${encodeURIComponent(compraId)}/document`,
            }
          : row,
      ),
    );
    setOkMsg('Factura enlazada al egreso.');
  }, []);

  const cargar = useCallback(async () => {
    if (!proyectoId) return;
    setLoading(true);
    setError(null);
    setOkMsg(null);
    try {
      const [gRes, iRes] = await Promise.all([
        fetch(
          `/api/contabilidad/cco/libro?${new URLSearchParams({
            proyecto: proyectoId,
            clase: 'GASTO',
            limit: '5000',
          })}`,
          { cache: 'no-store' },
        ),
        fetch(
          `/api/contabilidad/cco/libro?${new URLSearchParams({
            proyecto: proyectoId,
            clase: 'INGRESO',
            limit: '5000',
          })}`,
          { cache: 'no-store' },
        ),
      ]);
      const gJson = await gRes.json();
      const iJson = await iRes.json();
      if (!gRes.ok || gJson.ok === false) throw new Error(gJson.error ?? 'Error al cargar egresos');
      const rows = ((gJson.filas ?? []) as CcoLibroFila[]).filter(
        (r) => !esDescripcionAuditoriaCco(r.descripcion),
      );
      setFilas(rows);
      const nextDrafts: Record<string, DraftLite> = {};
      for (const r of rows) nextDrafts[r.id] = toDraft(r);
      setDrafts(nextDrafts);
      setDirty(new Set());
      setEditingId(null);
      setPage(0);

      const ingresos = (iJson.filas ?? []) as CcoLibroFila[];
      if (iRes.ok && iJson.ok !== false) {
        setIngresosTotal(ingresos.reduce((s, r) => s + (Number(r.monto_base_usd) || 0), 0));
        setCountIngresos(ingresos.length);
      } else {
        setIngresosTotal(0);
        setCountIngresos(0);
      }
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

  const filasFiltradas = useMemo(() => {
    let rows = filas;
    if (rubroFiltro) {
      rows = rows.filter((r) => String(r.tipo).toUpperCase() === rubroFiltro.toUpperCase());
    }
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      rows = rows.filter(
        (r) =>
          r.descripcion.toLowerCase().includes(q) ||
          r.proveedor.toLowerCase().includes(q) ||
          (r.invoice_number ?? '').toLowerCase().includes(q) ||
          r.tipo.toLowerCase().includes(q),
      );
    }
    return rows;
  }, [filas, rubroFiltro, query]);

  const egresosBase = useMemo(
    () => filasFiltradas.reduce((s, r) => s + (Number(r.monto_base_usd) || 0), 0),
    [filasFiltradas],
  );
  const honorariosTotal = useMemo(
    () => filasFiltradas.reduce((s, r) => s + (Number(r.honorarios_usd) || 0), 0),
    [filasFiltradas],
  );
  const egresosTotal = egresosBase + honorariosTotal;
  const saldo = ingresosTotal - egresosTotal;

  const pageCount = Math.max(1, Math.ceil(filasFiltradas.length / PAGE_SIZE));
  const pageRows = filasFiltradas.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const patchDraft = (id: string, patch: Partial<DraftLite>) => {
    setDrafts((prev) => ({ ...prev, [id]: { ...(prev[id] ?? toDraft(filas.find((f) => f.id === id)!)), ...patch } }));
    setDirty((prev) => new Set(prev).add(id));
  };

  const guardar = async () => {
    const cambios = Array.from(dirty)
      .map((id) => {
        const f = filas.find((r) => r.id === id);
        const d = drafts[id];
        if (!f || !d || f.fuente !== 'compra') return null;
        return {
          id,
          descripcion: d.descripcion,
          tipo: d.tipo,
          forma_pago: d.forma_pago || null,
          estado: d.estado,
        };
      })
      .filter(Boolean);
    if (cambios.length === 0) {
      setOkMsg('No hay cambios pendientes.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/contabilidad/cco/registros', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proyecto_id: proyectoId, clase: 'GASTO', cambios }),
      });
      const json = await res.json();
      if (!res.ok || json.ok === false) throw new Error(json.error ?? 'No se pudo guardar');
      setOkMsg(`Guardados ${json.updated ?? cambios.length} cambio(s).`);
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  if (!proyectoId) {
    return (
      <div style={box}>
        <p style={{ margin: 0, color: '#64748B', fontSize: 13 }}>
          Selecciona una obra para ver el listado de egresos.
        </p>
      </div>
    );
  }

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
          title="Total de Ingresos"
          value={fmtUsd(ingresosTotal)}
          footnote={`${countIngresos} registro(s)`}
          accent="#22C55E"
        />
        <KpiCard
          title="Costo Total"
          value={fmtUsd(egresosTotal)}
          footnote={`Base ${fmtUsd(egresosBase)} + Admin ${fmtUsd(honorariosTotal)}`}
          accent="#EF4444"
        />
        <KpiCard
          title="Saldo"
          value={fmtUsd(saldo)}
          footnote="Ingresos − costo total (como dashboard)"
          accent="#3B82F6"
        />
      </div>

      <div style={box}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: 14,
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#0F172A' }}>
              Listado de Egresos registrados
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748B' }}>
              Compras de obra · enlaza facturas desde la columna Factura o la carga manual
            </p>
          </div>
          <button type="button" onClick={() => void cargar()} style={btnGhost} disabled={loading}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Actualizar
          </button>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 10,
            marginBottom: 14,
          }}
        >
          <div>
            <label style={label}>Categoría</label>
            <select
              value={rubroFiltro}
              onChange={(e) => {
                setRubroFiltro(e.target.value);
                setPage(0);
              }}
              style={input}
            >
              <option value="">Todas</option>
              {CCO_TIPOS_GASTO.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div style={{ gridColumn: 'span 2' }}>
            <label style={label}>Buscar</label>
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(0);
              }}
              placeholder="Concepto, proveedor, factura…"
              style={input}
            />
          </div>
        </div>

        {error ? <p style={{ color: '#B91C1C', fontSize: 13 }}>{error}</p> : null}
        {okMsg ? <p style={{ color: '#15803D', fontSize: 13 }}>{okMsg}</p> : null}

        {loading ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: '#64748B', padding: 28 }}>
            <Loader2 className="animate-spin" size={16} /> Cargando egresos…
          </div>
        ) : (
          <>
            <div style={{ overflow: 'auto', border: '1px solid #E2E8F0', borderRadius: 10 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 880, fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#F1F5F9', textAlign: 'left' }}>
                    <th style={th}>#</th>
                    <th style={th}>Fecha</th>
                    <th style={th}>Concepto</th>
                    <th style={{ ...th, textAlign: 'right' }}>Monto</th>
                    <th style={th}>Categoría</th>
                    <th style={th}>Método</th>
                    <th style={th}>Factura</th>
                    <th style={{ ...th, textAlign: 'center' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ padding: 28, textAlign: 'center', color: '#94A3B8' }}>
                        Sin egresos para el filtro actual.
                      </td>
                    </tr>
                  ) : (
                    pageRows.map((f, idx) => {
                      const n = page * PAGE_SIZE + idx + 1;
                      const d = drafts[f.id] ?? toDraft(f);
                      const editing = editingId === f.id;
                      return (
                        <React.Fragment key={f.id}>
                          <tr
                            style={{
                              background: dirty.has(f.id)
                                ? '#FFF7ED'
                                : n % 2
                                  ? '#F8FAFC'
                                  : '#fff',
                              borderTop: '1px solid #E2E8F0',
                            }}
                          >
                            <td style={{ ...td, color: '#64748B', fontVariantNumeric: 'tabular-nums' }}>
                              {n}
                            </td>
                            <td style={{ ...td, whiteSpace: 'nowrap' }}>{fmtFecha(f.fecha)}</td>
                            <td style={td}>
                              {editing ? (
                                <input
                                  value={d.descripcion}
                                  onChange={(e) => patchDraft(f.id, { descripcion: e.target.value })}
                                  style={input}
                                />
                              ) : (
                                <>
                                  <div style={{ fontWeight: 600, color: '#0F172A' }}>
                                    {d.descripcion || '—'}
                                  </div>
                                  <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>
                                    {f.proveedor}
                                    {f.invoice_number ? ` · ${f.invoice_number}` : ''}
                                  </div>
                                </>
                              )}
                            </td>
                            <td
                              style={{
                                ...td,
                                textAlign: 'right',
                                fontWeight: 800,
                                fontVariantNumeric: 'tabular-nums',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {fmtUsd(f.monto_base_usd)}
                            </td>
                            <td style={td}>
                              {editing ? (
                                <select
                                  value={d.tipo}
                                  onChange={(e) => patchDraft(f.id, { tipo: e.target.value })}
                                  style={input}
                                >
                                  <option value="">—</option>
                                  {[...CCO_TIPOS_GASTO]
                                    .sort((a, b) => a.localeCompare(b, 'es'))
                                    .map((t) => (
                                      <option key={t} value={t}>
                                        {t}
                                      </option>
                                    ))}
                                </select>
                              ) : (
                                <span style={{ fontWeight: 700, color: '#334155', fontSize: 12 }}>
                                  {d.tipo || '—'}
                                </span>
                              )}
                            </td>
                            <td style={td}>
                              {editing ? (
                                <select
                                  value={d.forma_pago}
                                  onChange={(e) => patchDraft(f.id, { forma_pago: e.target.value })}
                                  style={input}
                                >
                                  <option value="">—</option>
                                  {FORMAS_PAGO_CCO.map((fp) => (
                                    <option key={fp} value={fp}>
                                      {fp}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <span style={{ fontSize: 12, color: '#475569' }}>
                                  {d.forma_pago || '—'}
                                </span>
                              )}
                            </td>
                            <td style={{ ...td, whiteSpace: 'normal' }}>
                              <EgresoFacturaCell
                                compraId={f.id}
                                tieneDocumento={!!f.tiene_documento}
                                fileName={f.document_file_name}
                                puedeAdjuntar={f.fuente === 'compra'}
                                onAdjuntado={marcarDoc}
                              />
                            </td>
                            <td style={{ ...td, textAlign: 'center' }}>
                              <div
                                style={{
                                  display: 'inline-flex',
                                  gap: 6,
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                <button
                                  type="button"
                                  title={f.tiene_documento ? 'Ver factura' : 'Sin factura'}
                                  disabled={!f.tiene_documento}
                                  onClick={async () => {
                                    const res = await fetch(
                                      `/api/contabilidad/compras/${encodeURIComponent(f.id)}/document`,
                                    );
                                    const data = await res.json();
                                    if (data.url) window.open(data.url, '_blank', 'noopener,noreferrer');
                                  }}
                                  style={iconBtn}
                                >
                                  {f.tiene_documento ? (
                                    <Eye size={16} color="#2563EB" />
                                  ) : (
                                    <FileText size={16} color="#CBD5E1" />
                                  )}
                                </button>
                                <button
                                  type="button"
                                  title="Editar"
                                  onClick={() =>
                                    setEditingId((cur) => (cur === f.id ? null : f.id))
                                  }
                                  style={iconBtn}
                                >
                                  <Pencil size={16} color="#64748B" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 10,
                marginTop: 12,
                fontSize: 13,
                color: '#64748B',
              }}
            >
              <span>
                {filasFiltradas.length} egreso(s)
                {dirty.size ? ` · ${dirty.size} editado(s)` : ''}
              </span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {dirty.size > 0 ? (
                  <button type="button" onClick={() => void guardar()} disabled={saving} style={btnPrimary}>
                    {saving ? <Loader2 size={14} className="animate-spin" /> : null}
                    Guardar cambios
                  </button>
                ) : null}
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
        )}
      </div>

      <EgresoCargaSoportesPanel filas={filas} onAdjuntado={marcarDoc} />
    </div>
  );
}

const box: React.CSSProperties = {
  background: '#fff',
  borderRadius: 14,
  border: '1px solid #E2E8F0',
  padding: 16,
};
const th: React.CSSProperties = {
  padding: '10px 8px',
  fontSize: 12,
  fontWeight: 800,
  color: '#334155',
  whiteSpace: 'nowrap',
  borderBottom: '1px solid #E2E8F0',
};
const td: React.CSSProperties = {
  padding: '10px 8px',
  verticalAlign: 'middle',
  color: '#334155',
};
const label: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 700,
  color: '#64748B',
  marginBottom: 4,
};
const input: React.CSSProperties = {
  width: '100%',
  border: '1px solid #CBD5E1',
  borderRadius: 8,
  padding: '8px 10px',
  fontSize: 13,
  color: '#0F172A',
  background: '#fff',
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
const btnPrimary: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  border: 'none',
  background: '#2563EB',
  color: '#fff',
  borderRadius: 8,
  padding: '8px 12px',
  fontWeight: 800,
  cursor: 'pointer',
  fontSize: 12,
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
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  padding: 4,
  display: 'inline-flex',
  alignItems: 'center',
};
