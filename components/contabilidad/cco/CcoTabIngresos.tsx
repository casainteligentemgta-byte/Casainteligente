'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Eye,
  Loader2,
  Save,
  Wallet,
} from 'lucide-react';
import {
  FORMAS_PAGO_INGRESO,
  INGRESOS_COLUMNAS,
  defaultVisibleColsIngresos,
  storageKeyColumnasIngresos,
  type IngresosColKey,
} from '@/lib/contabilidad/cco/ingresosVista';
import type { CcoLibroFila } from '@/lib/contabilidad/cco/types';

function fmtUsd(n: number): string {
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtNum(n: number, digits = 2): string {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

type Draft = {
  fecha: string;
  proveedor: string;
  descripcion: string;
  moneda: string;
  tasa: string;
  monto_orig: string;
  forma_pago: string;
};

type VistaFila = CcoLibroFila & {
  dirty?: boolean;
  draft?: Draft;
  selected?: boolean;
};

function toDraft(f: CcoLibroFila): Draft {
  return {
    fecha: f.fecha ?? '',
    proveedor: f.proveedor,
    descripcion: f.descripcion,
    moneda: f.moneda || 'USD',
    tasa: f.tasa > 0 ? String(f.tasa) : '',
    monto_orig: String(f.monto_orig ?? f.monto_base_usd),
    forma_pago: f.forma_pago ?? 'TRANSFERENCIA',
  };
}

function montoUsdFromDraft(d: Draft): number {
  const moneda = d.moneda.toUpperCase().startsWith('VE') ? 'VES' : 'USD';
  const tasa = Number(d.tasa) || 0;
  const montoOrig = Number(d.monto_orig) || 0;
  if (moneda === 'VES') return tasa > 0 ? montoOrig / tasa : 0;
  return montoOrig;
}

export default function CcoTabIngresos({ proyectoId }: { proyectoId: string }) {
  const [filas, setFilas] = useState<VistaFila[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [cfgOpen, setCfgOpen] = useState(false);
  const [visible, setVisible] = useState(defaultVisibleColsIngresos);
  const [sortKey, setSortKey] = useState<IngresosColKey>('id');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    if (!proyectoId || typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(storageKeyColumnasIngresos(proyectoId));
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<Record<IngresosColKey, boolean>>;
      setVisible((prev) => ({ ...prev, ...parsed }));
    } catch {
      /* ignore */
    }
  }, [proyectoId]);

  const persistCols = useCallback(
    (next: Record<IngresosColKey, boolean>) => {
      setVisible(next);
      if (!proyectoId || typeof window === 'undefined') return;
      try {
        localStorage.setItem(storageKeyColumnasIngresos(proyectoId), JSON.stringify(next));
      } catch {
        /* ignore */
      }
    },
    [proyectoId],
  );

  const cargar = useCallback(async () => {
    if (!proyectoId) return;
    setLoading(true);
    setError(null);
    setOkMsg(null);
    try {
      const qs = new URLSearchParams({
        proyecto: proyectoId,
        clase: 'INGRESO',
        limit: '5000',
      });
      const res = await fetch(`/api/contabilidad/cco/libro?${qs}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok || json.ok === false) throw new Error(json.error ?? 'Error al cargar ingresos');
      const rows = (json.filas ?? []) as CcoLibroFila[];
      setFilas(
        rows.map((f) => ({
          ...f,
          dirty: false,
          selected: false,
          draft: toDraft(f),
        })),
      );
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

  const filasVista = useMemo(() => {
    const sorted = [...filas].sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      const pick = (f: VistaFila) => {
        const d = f.draft ?? toDraft(f);
        switch (sortKey) {
          case 'sel':
            return f.selected ? 1 : 0;
          case 'id':
            return Number(f.display_id) || String(f.display_id);
          case 'fecha':
            return d.fecha;
          case 'proveedor':
            return d.proveedor.toUpperCase();
          case 'descripcion':
            return d.descripcion.toUpperCase();
          case 'moneda':
            return d.moneda;
          case 'tasa':
            return Number(d.tasa) || 0;
          case 'brecha':
            return f.porcentaje_brecha_real ?? 0;
          case 'monto_orig':
            return Number(d.monto_orig) || 0;
          case 'monto_usd':
            return montoUsdFromDraft(d);
          case 'forma_pago':
            return d.forma_pago;
          case 'estado':
            return f.estado;
          case 'link_comprobante':
            return f.link_factura ?? '';
          default:
            return 0;
        }
      };
      const va = pick(a);
      const vb = pick(b);
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
      return String(va).localeCompare(String(vb), 'es', { numeric: true }) * dir;
    });
    return sorted;
  }, [filas, sortKey, sortDir]);

  const dirtyCount = filas.filter((f) => f.dirty).length;
  const selectedCount = filas.filter((f) => f.selected).length;
  const colsActivas = INGRESOS_COLUMNAS.filter((c) => visible[c.key]);

  const patchDraft = (id: string, patch: Partial<Draft>) => {
    setFilas((prev) =>
      prev.map((f) => {
        if (f.id !== id) return f;
        const draft = { ...(f.draft ?? toDraft(f)), ...patch };
        return {
          ...f,
          draft,
          dirty: true,
          fecha: draft.fecha || f.fecha,
          proveedor: draft.proveedor,
          descripcion: draft.descripcion,
          moneda: draft.moneda,
          monto_base_usd: montoUsdFromDraft(draft),
        };
      }),
    );
  };

  const toggleSort = (key: IngresosColKey) => {
    if (key === 'sel') return;
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir(key === 'proveedor' || key === 'descripcion' ? 'asc' : 'desc');
    }
  };

  const mostrarOcultasORestablecer = () => {
    const next = defaultVisibleColsIngresos();
    for (const c of INGRESOS_COLUMNAS) next[c.key] = true;
    persistCols(next);
    setCfgOpen(true);
  };

  const eliminarSeleccionados = useCallback(async () => {
    const ids = filas.filter((f) => f.selected).map((f) => f.id);
    if (ids.length === 0) return;
    if (!window.confirm(`¿Eliminar ${ids.length} ingreso(s) seleccionado(s)?`)) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/contabilidad/cco/registros', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proyecto_id: proyectoId,
          clase: 'INGRESO',
          eliminar_ids: ids,
        }),
      });
      const json = await res.json();
      if (!res.ok || json.ok === false) throw new Error(json.error ?? 'No se pudo eliminar');
      setOkMsg(`Eliminados ${json.deleted ?? ids.length} ingreso(s).`);
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al eliminar');
    } finally {
      setSaving(false);
    }
  }, [filas, proyectoId, cargar]);

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key !== 'Delete') return;
      const tag = (ev.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (!filas.some((f) => f.selected)) return;
      ev.preventDefault();
      void eliminarSeleccionados();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [filas, eliminarSeleccionados]);

  const guardar = async () => {
    const cambios = filas
      .filter((f) => f.dirty && f.draft)
      .map((f) => {
        const d = f.draft!;
        return {
          id: f.id,
          fecha: d.fecha || undefined,
          proveedor: d.proveedor,
          descripcion: d.descripcion,
          moneda: d.moneda,
          tasa: Number(d.tasa) || 0,
          monto_orig: Number(d.monto_orig) || 0,
          forma_pago: d.forma_pago || null,
        };
      });
    if (cambios.length === 0) {
      setOkMsg('No hay cambios pendientes.');
      return;
    }
    setSaving(true);
    setError(null);
    setOkMsg(null);
    try {
      const res = await fetch('/api/contabilidad/cco/registros', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proyecto_id: proyectoId,
          clase: 'INGRESO',
          cambios,
        }),
      });
      const json = await res.json();
      if (!res.ok || json.ok === false) throw new Error(json.error ?? 'No se pudo guardar');
      setOkMsg(`Guardados ${json.updated ?? cambios.length} cambio(s) de ingresos.`);
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
        <p style={muted}>Selecciona una obra para ver el control de ingresos.</p>
      </div>
    );
  }

  const kpis = useMemo(() => {
    let montoOrig = 0;
    let montoUsd = 0;
    for (const f of filas) {
      const d = f.draft ?? toDraft(f);
      montoOrig += Number(d.monto_orig) || 0;
      montoUsd += montoUsdFromDraft(d);
    }
    return { montoOrig, montoUsd, count: filas.length };
  }, [filas]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 12,
        }}
      >
        {[
          { t: 'Suma Monto Original', v: fmtNum(kpis.montoOrig) },
          { t: 'Suma Monto USD', v: fmtUsd(kpis.montoUsd) },
          { t: 'Registros', v: String(kpis.count) },
        ].map((k) => (
          <div
            key={k.t}
            style={{
              background: '#fff',
              borderRadius: 14,
              border: '1px solid #E2E8F0',
              padding: '16px 18px',
              boxShadow: '0 1px 3px rgba(15,23,42,0.06)',
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: '0.04em',
                color: '#64748B',
                textTransform: 'uppercase',
              }}
            >
              {k.t}
            </p>
            <p
              style={{
                margin: '8px 0 0',
                fontSize: 22,
                fontWeight: 800,
                color: '#0F172A',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {k.v}
            </p>
          </div>
        ))}
      </div>

      <div style={box}>
        <h2
          style={{
            margin: '0 0 12px',
            fontSize: 20,
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            color: '#0F172A',
          }}
        >
          <span
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background: '#FEF3C7',
              display: 'grid',
              placeItems: 'center',
              color: '#B45309',
            }}
          >
            <Wallet size={18} />
          </span>
          Control de Ingresos
        </h2>

        <div
          style={{
            background: '#EFF6FF',
            border: '1px solid #BFDBFE',
            borderRadius: 12,
            padding: '10px 14px',
            marginBottom: 12,
            fontSize: 13,
            color: '#1E3A8A',
          }}
        >
          Mostrando <strong>{filasVista.length}</strong> registros. Puedes editar celdas o eliminar
          filas (seleccionándolas en la casilla izquierda y presionando la tecla Supr/Delete).
          {selectedCount > 0 ? ` · ${selectedCount} seleccionada(s)` : ''}
        </div>

        <button
          type="button"
          onClick={() => setCfgOpen((o) => !o)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'transparent',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            fontWeight: 800,
            fontSize: 14,
            color: '#0F172A',
            marginBottom: cfgOpen ? 12 : 10,
          }}
        >
          {cfgOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          <Eye size={16} color="#64748B" />
          Configurar Columnas Visibles (Ingresos)
        </button>

        {cfgOpen ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
              gap: 8,
              marginBottom: 12,
            }}
          >
            {INGRESOS_COLUMNAS.filter((c) => c.key !== 'sel').map((c) => (
              <label
                key={c.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#334155',
                }}
              >
                <input
                  type="checkbox"
                  checked={!!visible[c.key]}
                  onChange={(e) => persistCols({ ...visible, [c.key]: e.target.checked })}
                />
                {c.label}
              </label>
            ))}
          </div>
        ) : null}

        {error ? <p style={{ color: '#B91C1C', fontSize: 13 }}>{error}</p> : null}
        {okMsg ? <p style={{ color: '#15803D', fontSize: 13 }}>{okMsg}</p> : null}

        {loading ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: '#64748B', padding: 16 }}>
            <Loader2 className="animate-spin" size={16} /> Cargando ingresos…
          </div>
        ) : (
          <div
            style={{
              overflow: 'auto',
              maxHeight: 'min(70vh, 640px)',
              borderRadius: 10,
              border: '1px solid #E2E8F0',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 860 }}>
              <thead>
                <tr style={{ background: '#F1F5F9', textAlign: 'left' }}>
                  {colsActivas.map((c) => (
                    <th
                      key={c.key}
                      onClick={() => toggleSort(c.key)}
                      style={{
                        padding: '9px 8px',
                        position: 'sticky',
                        top: 0,
                        background: '#F1F5F9',
                        zIndex: 1,
                        whiteSpace: 'nowrap',
                        cursor: c.key === 'sel' ? 'default' : 'pointer',
                        userSelect: 'none',
                        textAlign: c.align === 'right' ? 'right' : 'left',
                        color: '#334155',
                        fontWeight: 800,
                        borderBottom: '1px solid #E2E8F0',
                      }}
                    >
                      {c.key === 'sel' ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <input
                            type="checkbox"
                            checked={filas.length > 0 && filas.every((f) => f.selected)}
                            onChange={(e) =>
                              setFilas((prev) =>
                                prev.map((f) => ({ ...f, selected: e.target.checked })),
                              )
                            }
                            aria-label="Seleccionar todos"
                          />
                          Seleccionar
                        </span>
                      ) : (
                        <>
                          {c.label}
                          {sortKey === c.key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
                        </>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filasVista.map((f, idx) => {
                  const d = f.draft ?? toDraft(f);
                  const montoUsd = montoUsdFromDraft(d);
                  return (
                    <tr
                      key={f.id}
                      style={{
                        borderTop: '1px solid #E2E8F0',
                        background: f.dirty ? '#FFF7ED' : idx % 2 ? '#F8FAFC' : '#fff',
                      }}
                    >
                      {colsActivas.map((c) => {
                        const align = c.align === 'right' ? 'right' : 'left';
                        const cell: React.CSSProperties = {
                          ...td,
                          textAlign: align,
                        };
                        if (c.key === 'sel') {
                          return (
                            <td key={c.key} style={cell}>
                              <input
                                type="checkbox"
                                checked={!!f.selected}
                                onChange={(e) =>
                                  setFilas((prev) =>
                                    prev.map((row) =>
                                      row.id === f.id
                                        ? { ...row, selected: e.target.checked }
                                        : row,
                                    ),
                                  )
                                }
                              />
                            </td>
                          );
                        }
                        if (c.key === 'id') {
                          return (
                            <td key={c.key} style={cell}>
                              {f.display_id}
                            </td>
                          );
                        }
                        if (c.key === 'fecha') {
                          return (
                            <td key={c.key} style={cell}>
                              <input
                                type="date"
                                value={d.fecha}
                                onChange={(e) => patchDraft(f.id, { fecha: e.target.value })}
                                style={inputCell}
                              />
                            </td>
                          );
                        }
                        if (c.key === 'proveedor') {
                          return (
                            <td key={c.key} style={cell}>
                              <input
                                value={d.proveedor === 'CLIENTE' ? '' : d.proveedor}
                                placeholder="None"
                                onChange={(e) =>
                                  patchDraft(f.id, {
                                    proveedor: e.target.value.trim() || 'CLIENTE',
                                  })
                                }
                                style={{ ...inputCell, minWidth: 120 }}
                              />
                            </td>
                          );
                        }
                        if (c.key === 'descripcion') {
                          return (
                            <td key={c.key} style={{ ...cell, maxWidth: 280 }}>
                              <input
                                value={d.descripcion}
                                onChange={(e) => patchDraft(f.id, { descripcion: e.target.value })}
                                style={{ ...inputCell, minWidth: 160 }}
                              />
                            </td>
                          );
                        }
                        if (c.key === 'moneda') {
                          return (
                            <td key={c.key} style={cell}>
                              <select
                                value={d.moneda.toUpperCase().startsWith('VE') ? 'VES' : 'USD'}
                                onChange={(e) => patchDraft(f.id, { moneda: e.target.value })}
                                style={inputCell}
                              >
                                <option value="USD">USD</option>
                                <option value="VES">VES</option>
                              </select>
                            </td>
                          );
                        }
                        if (c.key === 'tasa') {
                          return (
                            <td key={c.key} style={cell}>
                              <input
                                value={d.tasa}
                                onChange={(e) => patchDraft(f.id, { tasa: e.target.value })}
                                style={{ ...inputCell, width: 88, textAlign: 'right' }}
                              />
                            </td>
                          );
                        }
                        if (c.key === 'monto_orig') {
                          return (
                            <td key={c.key} style={cell}>
                              <input
                                value={d.monto_orig}
                                onChange={(e) => patchDraft(f.id, { monto_orig: e.target.value })}
                                style={{ ...inputCell, width: 100, textAlign: 'right' }}
                              />
                            </td>
                          );
                        }
                        if (c.key === 'monto_usd') {
                          return (
                            <td
                              key={c.key}
                              style={{ ...cell, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}
                            >
                              {fmtUsd(montoUsd)}
                            </td>
                          );
                        }
                        if (c.key === 'brecha') {
                          return (
                            <td key={c.key} style={{ ...cell, fontVariantNumeric: 'tabular-nums' }}>
                              {f.porcentaje_brecha_real != null
                                ? `${fmtNum(f.porcentaje_brecha_real, 3)}%`
                                : 'None'}
                            </td>
                          );
                        }
                        if (c.key === 'forma_pago') {
                          const formaVal = d.forma_pago || '';
                          return (
                            <td key={c.key} style={cell}>
                              <select
                                value={formaVal}
                                onChange={(e) => patchDraft(f.id, { forma_pago: e.target.value })}
                                style={inputCell}
                              >
                                <option value="">None</option>
                                {FORMAS_PAGO_INGRESO.map((fp) => (
                                  <option key={fp} value={fp}>
                                    {fp}
                                  </option>
                                ))}
                              </select>
                            </td>
                          );
                        }
                        if (c.key === 'estado') {
                          return <td key={c.key} style={cell}>{f.estado}</td>;
                        }
                        if (c.key === 'link_comprobante') {
                          return (
                            <td key={c.key} style={cell}>
                              {f.link_factura || f.tiene_documento ? (
                                <button
                                  type="button"
                                  style={{
                                    border: 'none',
                                    background: 'transparent',
                                    color: '#1D4ED8',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    padding: 0,
                                    fontSize: 12,
                                  }}
                                  onClick={() => {
                                    void (async () => {
                                      try {
                                        const res = await fetch(
                                          `/api/contabilidad/inyecciones/${encodeURIComponent(f.id)}/soporte`,
                                          { cache: 'no-store' },
                                        );
                                        const json = await res.json();
                                        if (!res.ok || !json.url) {
                                          throw new Error(json.error ?? 'Sin comprobante');
                                        }
                                        window.open(json.url, '_blank', 'noopener,noreferrer');
                                      } catch (e) {
                                        setError(
                                          e instanceof Error ? e.message : 'Error al abrir comprobante',
                                        );
                                      }
                                    })();
                                  }}
                                >
                                  Ver
                                </button>
                              ) : (
                                'None'
                              )}
                            </td>
                          );
                        }
                        return <td key={c.key} style={cell}>—</td>;
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filasVista.length === 0 ? (
              <p style={{ ...muted, padding: 16 }}>Sin ingresos para el filtro actual.</p>
            ) : null}
          </div>
        )}

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            marginTop: 14,
          }}
        >
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => void guardar()}
              disabled={saving || dirtyCount === 0}
              style={{
                ...btnSave,
                opacity: saving || dirtyCount === 0 ? 0.55 : 1,
              }}
            >
              {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
              Guardar Cambios de Ingresos
              {dirtyCount > 0 ? ` (${dirtyCount})` : ''}
            </button>
            {selectedCount > 0 ? (
              <button
                type="button"
                onClick={() => void eliminarSeleccionados()}
                disabled={saving}
                style={btnDangerGhost}
              >
                Eliminar seleccionados ({selectedCount})
              </button>
            ) : null}
          </div>
          <button type="button" onClick={mostrarOcultasORestablecer} style={btnLink}>
            <Eye size={14} /> Mostrar Columnas Ocultas / Restablecer Vista
          </button>
        </div>
      </div>
    </div>
  );
}

const box: React.CSSProperties = {
  background: '#fff',
  borderRadius: 14,
  border: '1px solid #E2E8F0',
  padding: 16,
};

const muted: React.CSSProperties = { color: '#64748B', fontSize: 13, margin: 0 };
const td: React.CSSProperties = {
  padding: '6px 8px',
  verticalAlign: 'middle',
  color: '#334155',
  whiteSpace: 'nowrap',
};
const inputCell: React.CSSProperties = {
  width: '100%',
  border: '1px solid #CBD5E1',
  borderRadius: 6,
  padding: '4px 6px',
  fontSize: 12,
  color: '#0F172A',
  background: '#fff',
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
const btnDangerGhost: React.CSSProperties = {
  border: '1px solid #FCA5A5',
  background: '#FEF2F2',
  color: '#B91C1C',
  borderRadius: 10,
  padding: '10px 14px',
  fontWeight: 800,
  cursor: 'pointer',
  fontSize: 13,
};
const btnLink: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  border: 'none',
  background: 'transparent',
  color: '#475569',
  fontWeight: 700,
  cursor: 'pointer',
  fontSize: 12,
  padding: 4,
};
