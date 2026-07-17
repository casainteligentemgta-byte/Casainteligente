'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Eye, Loader2, Save } from 'lucide-react';
import type { CcoPresupuestoFila } from '@/lib/contabilidad/cco/cargarPresupuestos';

function fmtUsd(n: number): string {
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

type ColKey = 'capitulo' | 'subcapitulo' | 'descripcion' | 'estimado' | 'ejecutado' | 'pct' | 'saldo';

const COLS: { key: ColKey; label: string; defaultVisible: boolean }[] = [
  { key: 'capitulo', label: 'Capítulo', defaultVisible: true },
  { key: 'subcapitulo', label: 'Sub-Capítulo', defaultVisible: true },
  { key: 'descripcion', label: 'Descripción', defaultVisible: true },
  { key: 'estimado', label: 'Estimado (USD)', defaultVisible: true },
  { key: 'ejecutado', label: 'Ejecutado (USD)', defaultVisible: true },
  { key: 'pct', label: '% Ejecutado', defaultVisible: true },
  { key: 'saldo', label: 'Saldo', defaultVisible: true },
];

type Draft = {
  capitulo: string;
  subcapitulo: string;
  descripcion: string;
  estimado: string;
};

type Vista = CcoPresupuestoFila & { dirty?: boolean; draft?: Draft };

function toDraft(f: CcoPresupuestoFila): Draft {
  return {
    capitulo: f.capitulo,
    subcapitulo: f.subcapitulo ?? '',
    descripcion: f.descripcion ?? '',
    estimado: String(f.estimado_usd ?? 0),
  };
}

export default function CcoTabPresupuestos({ proyectoId }: { proyectoId: string }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [filas, setFilas] = useState<Vista[]>([]);
  const [totales, setTotales] = useState({ estimado: 0, ejecutado: 0, saldo: 0 });
  const [cfgOpen, setCfgOpen] = useState(false);
  const [visible, setVisible] = useState<Record<ColKey, boolean>>(() => {
    const o = {} as Record<ColKey, boolean>;
    for (const c of COLS) o[c.key] = c.defaultVisible;
    return o;
  });

  const cargar = useCallback(async () => {
    if (!proyectoId) return;
    setLoading(true);
    setError(null);
    setOkMsg(null);
    try {
      const res = await fetch(
        `/api/contabilidad/cco/presupuestos?proyecto=${encodeURIComponent(proyectoId)}`,
        { cache: 'no-store' },
      );
      const json = await res.json();
      if (!res.ok || json.ok === false) throw new Error(json.error ?? 'Error');
      const rows = (json.filas ?? []) as CcoPresupuestoFila[];
      setFilas(
        rows
          .slice()
          .sort((a, b) => a.capitulo.localeCompare(b.capitulo, 'es'))
          .map((f) => ({ ...f, dirty: false, draft: toDraft(f) })),
      );
      setTotales({
        estimado: Number(json.totalEstimado) || 0,
        ejecutado: Number(json.totalEjecutado) || 0,
        saldo: Number(json.totalSaldo) || 0,
      });
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

  const colsActivas = COLS.filter((c) => visible[c.key]);
  const dirtyCount = filas.filter((f) => f.dirty).length;

  const kpisLive = useMemo(() => {
    let estimado = 0;
    let ejecutado = 0;
    for (const f of filas) {
      const est = f.dirty && f.draft ? Number(f.draft.estimado) || 0 : f.estimado_usd;
      estimado += est;
      ejecutado += f.ejecutado_usd;
    }
    return { estimado, ejecutado, saldo: estimado - ejecutado };
  }, [filas]);

  const patchDraft = (id: string, patch: Partial<Draft>) => {
    setFilas((prev) =>
      prev.map((f) => {
        if (f.id !== id || f.id.startsWith('exec-')) return f;
        return { ...f, dirty: true, draft: { ...(f.draft ?? toDraft(f)), ...patch } };
      }),
    );
  };

  const guardar = async () => {
    const cambios = filas
      .filter((f) => f.dirty && f.draft && !f.id.startsWith('exec-'))
      .map((f) => ({
        id: f.id,
        capitulo: f.draft!.capitulo,
        subcapitulo: f.draft!.subcapitulo || null,
        descripcion: f.draft!.descripcion || null,
        estimado_usd: Number(f.draft!.estimado) || 0,
      }));
    if (!cambios.length) {
      setOkMsg('No hay cambios pendientes.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/contabilidad/cco/presupuestos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proyecto_id: proyectoId, cambios }),
      });
      const json = await res.json();
      if (!res.ok || json.ok === false) throw new Error(json.error ?? 'No se pudo guardar');
      setOkMsg(`Guardados ${json.updated ?? cambios.length} cambio(s) de presupuestos.`);
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const restablecerCols = () => {
    const o = {} as Record<ColKey, boolean>;
    for (const c of COLS) o[c.key] = true;
    setVisible(o);
    setCfgOpen(true);
  };

  if (!proyectoId) {
    return (
      <div style={box}>
        <h3 style={h3}>Presupuestos</h3>
        <p style={muted}>Selecciona una obra para ver estimado vs ejecutado por capítulo.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
        {[
          { t: 'Suma Estimado', v: fmtUsd(kpisLive.estimado || totales.estimado) },
          { t: 'Suma Ejecutado', v: fmtUsd(kpisLive.ejecutado || totales.ejecutado) },
          { t: 'Suma Saldo', v: fmtUsd(kpisLive.saldo || totales.saldo) },
        ].map((k) => (
          <div key={k.t} style={{ ...box, padding: '12px 14px' }}>
            <p style={{ ...muted, margin: 0, fontSize: 11, fontWeight: 800 }}>{k.t}</p>
            <p style={{ margin: '6px 0 0', fontSize: 18, fontWeight: 800 }}>{k.v}</p>
          </div>
        ))}
      </div>

      <div style={box}>
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
          Mostrando <strong>{filas.length}</strong> registros según los filtros actuales. Puedes editar
          estimado, capítulo y descripción; luego Guardar.
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
          Configurar Columnas Visibles (Presupuestos)
        </button>
        {cfgOpen ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
              gap: 8,
              marginBottom: 12,
            }}
          >
            {COLS.map((c) => (
              <label
                key={c.key}
                style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 600 }}
              >
                <input
                  type="checkbox"
                  checked={!!visible[c.key]}
                  onChange={(e) => setVisible((v) => ({ ...v, [c.key]: e.target.checked }))}
                />
                {c.label}
              </label>
            ))}
          </div>
        ) : null}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <h3 style={{ ...h3, margin: 0 }}>Por capítulo</h3>
          <button type="button" onClick={() => void cargar()} style={btn}>
            Actualizar
          </button>
        </div>
        <p style={muted}>Comparación presupuesto V4 vs gastos con el mismo capítulo CCO.</p>
        {error ? <p style={{ color: '#B91C1C', fontSize: 13 }}>{error}</p> : null}
        {okMsg ? <p style={{ color: '#15803D', fontSize: 13 }}>{okMsg}</p> : null}
        {loading ? (
          <div style={{ display: 'flex', gap: 8, color: '#64748B', alignItems: 'center' }}>
            <Loader2 className="animate-spin" size={16} /> Cargando…
          </div>
        ) : (
          <div style={{ overflow: 'auto', maxHeight: 480, border: '1px solid #E2E8F0', borderRadius: 10 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#F1F5F9', textAlign: 'left' }}>
                  {colsActivas.map((c) => (
                    <th
                      key={c.key}
                      style={{
                        padding: '8px 6px',
                        position: 'sticky',
                        top: 0,
                        background: '#F1F5F9',
                        fontWeight: 800,
                      }}
                    >
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filas.map((f, idx) => {
                  const d = f.draft ?? toDraft(f);
                  const readonly = f.id.startsWith('exec-');
                  const estimado = readonly ? f.estimado_usd : Number(d.estimado) || 0;
                  const saldo = estimado - f.ejecutado_usd;
                  const pct =
                    estimado > 0
                      ? Math.min(999, Math.round((f.ejecutado_usd / estimado) * 1000) / 10)
                      : 0;
                  return (
                    <tr
                      key={f.id}
                      style={{
                        borderTop: '1px solid #E2E8F0',
                        background: f.dirty ? '#FFF7ED' : idx % 2 ? '#F8FAFC' : '#fff',
                      }}
                    >
                      {colsActivas.map((c) => {
                        if (c.key === 'capitulo') {
                          return (
                            <td key={c.key} style={td}>
                              {readonly ? (
                                <strong>{f.capitulo}</strong>
                              ) : (
                                <input
                                  value={d.capitulo}
                                  onChange={(e) => patchDraft(f.id, { capitulo: e.target.value })}
                                  style={inputCell}
                                />
                              )}
                            </td>
                          );
                        }
                        if (c.key === 'subcapitulo') {
                          return (
                            <td key={c.key} style={td}>
                              {readonly ? (
                                f.subcapitulo ?? '—'
                              ) : (
                                <input
                                  value={d.subcapitulo}
                                  onChange={(e) => patchDraft(f.id, { subcapitulo: e.target.value })}
                                  style={inputCell}
                                />
                              )}
                            </td>
                          );
                        }
                        if (c.key === 'descripcion') {
                          return (
                            <td key={c.key} style={{ ...td, maxWidth: 220 }}>
                              {readonly ? (
                                <span style={{ color: '#94A3B8' }}>{f.descripcion ?? '—'}</span>
                              ) : (
                                <input
                                  value={d.descripcion}
                                  onChange={(e) => patchDraft(f.id, { descripcion: e.target.value })}
                                  style={inputCell}
                                />
                              )}
                            </td>
                          );
                        }
                        if (c.key === 'estimado') {
                          return (
                            <td key={c.key} style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>
                              {readonly ? (
                                fmtUsd(f.estimado_usd)
                              ) : (
                                <input
                                  value={d.estimado}
                                  onChange={(e) => patchDraft(f.id, { estimado: e.target.value })}
                                  style={{ ...inputCell, width: 100, textAlign: 'right' }}
                                />
                              )}
                            </td>
                          );
                        }
                        if (c.key === 'ejecutado') {
                          return (
                            <td key={c.key} style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>
                              {fmtUsd(f.ejecutado_usd)}
                            </td>
                          );
                        }
                        if (c.key === 'pct') {
                          return (
                            <td key={c.key} style={td}>
                              <span
                                style={{
                                  fontWeight: 800,
                                  color: pct > 100 ? '#B91C1C' : pct > 80 ? '#B45309' : '#15803D',
                                }}
                              >
                                {pct.toFixed(1)}%
                              </span>
                            </td>
                          );
                        }
                        if (c.key === 'saldo') {
                          return (
                            <td
                              key={c.key}
                              style={{
                                ...td,
                                fontVariantNumeric: 'tabular-nums',
                                fontWeight: 700,
                                color: saldo < 0 ? '#B91C1C' : '#0F172A',
                              }}
                            >
                              {fmtUsd(saldo)}
                            </td>
                          );
                        }
                        return <td key={c.key} style={td}>—</td>;
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filas.length === 0 ? <p style={{ ...muted, padding: 12 }}>Sin presupuestos.</p> : null}
          </div>
        )}

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            gap: 12,
            marginTop: 14,
          }}
        >
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
          <button type="button" onClick={restablecerCols} style={btnLink}>
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
