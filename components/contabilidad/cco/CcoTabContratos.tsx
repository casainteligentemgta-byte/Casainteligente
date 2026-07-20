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
import type { CcoProveedorContratos, CcoPagoVinculado } from '@/lib/contabilidad/cco/types';

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

type Props = {
  proyectoId: string;
  onNeedProyecto?: () => void;
};

export default function CcoTabContratos({ proyectoId, onNeedProyecto }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [porProveedor, setPorProveedor] = useState<CcoProveedorContratos[]>([]);
  const [huerfanos, setHuerfanos] = useState<CcoPagoVinculado[]>([]);
  const [resumen, setResumen] = useState({ contratos: 0, contratado: 0, pagado: 0, saldo: 0 });
  const [totalesFin, setTotalesFin] = useState({ montoOrig: 0, honorarios: 0, costoTotal: 0 });
  const [openProv, setOpenProv] = useState<string | null>(null);
  const [form, setForm] = useState({
    proveedor: '',
    descripcion: '',
    monto_base_usd: '',
    admin_pct: '15',
  });
  const [saving, setSaving] = useState(false);
  const [backfillMsg, setBackfillMsg] = useState<string | null>(null);
  const [selectedHuerfanos, setSelectedHuerfanos] = useState<Set<string>>(new Set());
  const [targetContrato, setTargetContrato] = useState('');

  const cargar = useCallback(async () => {
    if (!proyectoId) {
      onNeedProyecto?.();
      return;
    }
    setLoading(true);
    setError(null);
    setHint(null);
    try {
      const res = await fetch(`/api/contabilidad/cco/contratos?proyecto=${encodeURIComponent(proyectoId)}`, {
        cache: 'no-store',
      });
      const json = await res.json();
      if (!res.ok || json.ok === false) {
        setHint(json.hint ?? null);
        throw new Error(json.error ?? 'Error al cargar contratos');
      }
      const lista: CcoProveedorContratos[] = json.porProveedor ?? [];
      setPorProveedor(lista);
      setHuerfanos(json.huerfanos ?? []);
      setResumen(json.resumen ?? { contratos: 0, contratado: 0, pagado: 0, saldo: 0 });
      const flat = lista.flatMap((p) => p.contratos);
      setTotalesFin({
        montoOrig: flat.reduce((a, c) => a + c.monto_base_usd, 0),
        honorarios: flat.reduce((a, c) => a + c.honorarios_usd, 0),
        costoTotal: flat.reduce((a, c) => a + c.costo_total_usd, 0),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
      setPorProveedor([]);
      setHuerfanos([]);
    } finally {
      setLoading(false);
    }
  }, [proyectoId, onNeedProyecto]);

  const chartSub = useMemo(
    () =>
      [...porProveedor]
        .sort((a, b) => b.total_contratado - a.total_contratado)
        .slice(0, 12)
        .map((p) => ({
          name: p.proveedor.length > 22 ? `${p.proveedor.slice(0, 20)}…` : p.proveedor,
          full: p.proveedor,
          ejecutado: Math.round(p.total_pagado * 100) / 100,
          pendiente: Math.round(p.total_saldo * 100) / 100,
        })),
    [porProveedor],
  );

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function crearContrato(e: React.FormEvent) {
    e.preventDefault();
    if (!proyectoId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/contabilidad/cco/contratos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'upsert',
          proyecto_id: proyectoId,
          proveedor: form.proveedor,
          descripcion: form.descripcion,
          monto_base_usd: Number(form.monto_base_usd),
          admin_pct: Number(form.admin_pct) || 15,
        }),
      });
      const json = await res.json();
      if (!res.ok || json.ok === false) throw new Error(json.error ?? 'No se pudo guardar');
      setForm({ proveedor: '', descripcion: '', monto_base_usd: '', admin_pct: '15' });
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  async function vincularSeleccionados() {
    if (!targetContrato || !selectedHuerfanos.size) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/contabilidad/cco/contratos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'vincular',
          contrato_id: targetContrato,
          compra_ids: Array.from(selectedHuerfanos),
        }),
      });
      const json = await res.json();
      if (!res.ok || json.ok === false) throw new Error(json.error ?? 'No se pudo vincular');
      setSelectedHuerfanos(new Set());
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al vincular');
    } finally {
      setSaving(false);
    }
  }

  async function autoVincular() {
    if (!proyectoId) return;
    setSaving(true);
    setError(null);
    setBackfillMsg(null);
    try {
      const res = await fetch('/api/contabilidad/cco/contratos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'backfill',
          proyecto_id: proyectoId,
          umbral: 40,
        }),
      });
      const json = await res.json();
      if (!res.ok || json.ok === false) throw new Error(json.error ?? 'No se pudo auto-vincular');
      setBackfillMsg(
        `Auto-vínculo: ${json.vinculados ?? 0} de ${json.revisados ?? 0} huérfanos · sin match ${json.sinMatch ?? 0}`,
      );
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error en backfill');
    } finally {
      setSaving(false);
    }
  }

  if (!proyectoId) {
    return (
      <div style={box}>
        <h3 style={h3}>Contratos</h3>
        <p style={muted}>Selecciona una obra en el filtro superior para ver y crear contratos de subcontratista.</p>
      </div>
    );
  }

  const allContratos = porProveedor.flatMap((p) =>
    p.contratos.map((c) => ({ id: c.id, label: `${c.proveedor} · ${c.descripcion}` })),
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
        {[
          { t: 'Registros', v: String(resumen.contratos) },
          { t: 'Contratos monto orig.', v: fmtUsd(totalesFin.montoOrig) },
          { t: 'Contratos honorarios', v: fmtUsd(totalesFin.honorarios) },
          { t: 'Contratos costo total', v: fmtUsd(totalesFin.costoTotal) },
          { t: 'Pagado / ejecutado', v: fmtUsd(resumen.pagado) },
          { t: 'Saldo pendiente', v: fmtUsd(resumen.saldo) },
        ].map((k) => (
          <div key={k.t} style={{ ...box, padding: '12px 14px' }}>
            <p style={{ ...muted, margin: 0, fontSize: 11, fontWeight: 800 }}>{k.t}</p>
            <p style={{ margin: '6px 0 0', fontSize: 18, fontWeight: 800 }}>{k.v}</p>
          </div>
        ))}
      </div>

      {!loading && porProveedor.length > 0 ? (
        <>
          <div style={box}>
            <h3 style={h3}>Resumen consolidado de subcontratistas</h3>
            <p style={muted}>Monto contratado vs ejecutado/pagado y % de avance (vista V4).</p>
            <div style={{ overflow: 'auto', maxHeight: 360 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#F1F5F9', textAlign: 'left' }}>
                    {[
                      'SUBCONTRATISTA',
                      'MONTO CONTRATADO',
                      'EJECUTADO / PAGADO',
                      'SALDO PENDIENTE',
                      '% EJECUCIÓN',
                    ].map((h) => (
                      <th key={h} style={{ padding: '8px 6px', position: 'sticky', top: 0, background: '#F1F5F9' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {porProveedor.map((p) => {
                    const pct =
                      p.total_contratado > 0
                        ? Math.min(100, Math.round((p.total_pagado / p.total_contratado) * 1000) / 10)
                        : 0;
                    return (
                      <tr key={p.proveedor} style={{ borderTop: '1px solid #E2E8F0' }}>
                        <td style={td}>
                          <strong>{p.proveedor}</strong>
                        </td>
                        <td style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>{fmtUsd(p.total_contratado)}</td>
                        <td style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>{fmtUsd(p.total_pagado)}</td>
                        <td style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>{fmtUsd(p.total_saldo)}</td>
                        <td style={td}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div
                              style={{
                                flex: 1,
                                height: 8,
                                background: '#FEE2E2',
                                borderRadius: 99,
                                overflow: 'hidden',
                                minWidth: 70,
                              }}
                            >
                              <div
                                style={{
                                  width: `${pct}%`,
                                  height: '100%',
                                  background: '#DC2626',
                                }}
                              />
                            </div>
                            <span style={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{pct.toFixed(2)}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div style={box}>
            <h3 style={{ ...h3, marginBottom: 4 }}>Gráfico comparativo de subcontratistas</h3>
            <p style={{ ...muted, marginTop: 0 }}>
              Verde = ejecutado (pagado) · Rojo = pendiente · Top 12 por monto contratado
            </p>
            <div style={{ width: '100%', height: Math.max(260, chartSub.length * 40) }}>
              <ResponsiveContainer>
                <BarChart data={chartSub} layout="vertical" margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis type="number" tickFormatter={fmtUsdTick} tick={{ fill: '#64748B', fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={130} tick={{ fill: '#334155', fontSize: 11 }} />
                  <Tooltip
                    formatter={(value, name) => [fmtUsd(Number(value) || 0), String(name)]}
                    labelFormatter={(_, payload) => {
                      const p = payload?.[0]?.payload as { full?: string } | undefined;
                      return p?.full ?? '';
                    }}
                  />
                  <Legend />
                  <Bar dataKey="ejecutado" name="Ejecutado (pagado)" stackId="a" fill="#16A34A" />
                  <Bar dataKey="pendiente" name="Pendiente" stackId="a" fill="#DC2626" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      ) : null}

      <form onSubmit={crearContrato} style={{ ...box, display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
        <div style={{ gridColumn: '1 / -1' }}>
          <h3 style={{ ...h3, marginBottom: 4 }}>Nuevo contrato</h3>
          <p style={{ ...muted, margin: 0 }}>Equivalente a CLASE=CONTRATO en V4 (subcontratista).</p>
        </div>
        <label style={label}>
          Proveedor
          <input
            required
            value={form.proveedor}
            onChange={(e) => setForm((f) => ({ ...f, proveedor: e.target.value }))}
            style={input}
          />
        </label>
        <label style={label}>
          Descripción
          <input
            required
            value={form.descripcion}
            onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
            style={input}
          />
        </label>
        <label style={label}>
          Monto base USD
          <input
            required
            type="number"
            min={0}
            step="0.01"
            value={form.monto_base_usd}
            onChange={(e) => setForm((f) => ({ ...f, monto_base_usd: e.target.value }))}
            style={input}
          />
        </label>
        <label style={label}>
          % Admin
          <input
            type="number"
            min={0}
            max={100}
            step="0.1"
            value={form.admin_pct}
            onChange={(e) => setForm((f) => ({ ...f, admin_pct: e.target.value }))}
            style={input}
          />
        </label>
        <div style={{ display: 'flex', alignItems: 'end' }}>
          <button type="submit" disabled={saving} style={btnPrimary}>
            {saving ? 'Guardando…' : 'Registrar contrato'}
          </button>
        </div>
      </form>

      {error ? (
        <div style={{ ...box, borderColor: '#FECACA', background: '#FEF2F2', color: '#991B1B' }}>
          {error}
          {hint ? <p style={{ margin: '8px 0 0', fontSize: 12 }}>{hint}</p> : null}
        </div>
      ) : null}
      {backfillMsg ? (
        <div style={{ ...box, borderColor: '#BBF7D0', background: '#F0FDF4', color: '#14532D' }}>
          {backfillMsg}
        </div>
      ) : null}

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#64748B' }}>
          <Loader2 className="animate-spin" size={18} /> Cargando jerarquía…
        </div>
      ) : (
        <>
          <div style={box}>
            <h3 style={h3}>Por subcontratista</h3>
            {porProveedor.length === 0 ? (
              <p style={muted}>Sin contratos. Impórtalos desde SQLite V4 o créalos arriba.</p>
            ) : (
              porProveedor.map((p) => {
                const open = openProv === p.proveedor;
                return (
                  <div key={p.proveedor} style={{ borderTop: '1px solid #E2E8F0', padding: '10px 0' }}>
                    <button
                      type="button"
                      onClick={() => setOpenProv(open ? null : p.proveedor)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        background: 'none',
                        border: 0,
                        cursor: 'pointer',
                        padding: '4px 0',
                        fontWeight: 800,
                        color: '#0F172A',
                      }}
                    >
                      {open ? '▾' : '▸'} {p.proveedor}{' '}
                      <span style={{ fontWeight: 600, color: '#64748B', fontSize: 13 }}>
                        · {fmtUsd(p.total_contratado)} · saldo {fmtUsd(p.total_saldo)}
                      </span>
                    </button>
                    {open
                      ? p.contratos.map((c) => (
                          <div
                            key={c.id}
                            style={{
                              margin: '8px 0 8px 16px',
                              padding: 12,
                              background: '#F8FAFC',
                              borderRadius: 10,
                              border: '1px solid #E2E8F0',
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                              <strong>{c.descripcion}</strong>
                              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtUsd(c.costo_total_usd)}</span>
                            </div>
                            <div style={{ marginTop: 8, height: 8, background: '#E2E8F0', borderRadius: 99, overflow: 'hidden' }}>
                              <div
                                style={{
                                  width: `${c.pct_avance}%`,
                                  height: '100%',
                                  background: c.pct_avance >= 100 ? '#16A34A' : '#2563EB',
                                }}
                              />
                            </div>
                            <p style={{ ...muted, margin: '6px 0 0', fontSize: 12 }}>
                              Pagado {fmtUsd(c.monto_pagado_usd)} · Saldo {fmtUsd(c.saldo_usd)} · {c.pct_avance}% ·{' '}
                              {c.pagos.length} pago(s)
                            </p>
                            {c.pagos.length ? (
                              <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 12, color: '#334155' }}>
                                {c.pagos.map((pago) => (
                                  <li key={pago.id}>
                                    {pago.fecha ?? '—'} · {pago.descripcion.slice(0, 60)} · {fmtUsd(pago.monto_usd)}
                                  </li>
                                ))}
                              </ul>
                            ) : null}
                          </div>
                        ))
                      : null}
                  </div>
                );
              })
            )}
          </div>

          <div style={box}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ ...h3, margin: 0 }}>Pagos huérfanos (CONTRATISTA sin vínculo)</h3>
              <button
                type="button"
                disabled={saving || !huerfanos.length}
                onClick={() => void autoVincular()}
                style={{ ...btnPrimary, background: '#0F766E' }}
              >
                Auto-vincular por descripción
              </button>
            </div>
            <p style={muted}>
              En V4 muchos pagos existían sin CONTRATO_VINCULADO. Usa auto-vínculo o asigna a mano.
            </p>
            {huerfanos.length === 0 ? (
              <p style={muted}>No hay pagos huérfanos tipados como CONTRATISTA.</p>
            ) : (
              <>
                <div style={{ maxHeight: 280, overflow: 'auto', marginBottom: 12 }}>
                  {huerfanos.map((h) => {
                    const checked = selectedHuerfanos.has(h.id);
                    return (
                      <label
                        key={h.id}
                        style={{
                          display: 'flex',
                          gap: 10,
                          alignItems: 'flex-start',
                          padding: '8px 0',
                          borderBottom: '1px solid #F1F5F9',
                          fontSize: 13,
                          cursor: 'pointer',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            setSelectedHuerfanos((prev) => {
                              const n = new Set(prev);
                              if (n.has(h.id)) n.delete(h.id);
                              else n.add(h.id);
                              return n;
                            });
                          }}
                        />
                        <span>
                          <strong>{h.proveedor}</strong> · {h.fecha ?? '—'} · {fmtUsd(h.monto_usd)}
                          <br />
                          <span style={{ color: '#64748B' }}>{h.descripcion}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                  <select
                    value={targetContrato}
                    onChange={(e) => setTargetContrato(e.target.value)}
                    style={{ ...input, minWidth: 260 }}
                  >
                    <option value="">Contrato destino…</option>
                    {allContratos.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={saving || !targetContrato || !selectedHuerfanos.size}
                    onClick={() => void vincularSeleccionados()}
                    style={btnPrimary}
                  >
                    Vincular {selectedHuerfanos.size || ''} pago(s)
                  </button>
                </div>
              </>
            )}
          </div>
        </>
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

const h3: React.CSSProperties = { margin: '0 0 8px', fontSize: 16, fontWeight: 800 };

const muted: React.CSSProperties = { color: '#64748B', fontSize: 13, margin: '0 0 12px' };

const label: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  fontSize: 12,
  fontWeight: 700,
  color: '#64748B',
};

const input: React.CSSProperties = {
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid #CBD5E1',
  fontSize: 14,
  fontWeight: 600,
  color: '#0F172A',
};

const btnPrimary: React.CSSProperties = {
  background: '#2563EB',
  color: '#fff',
  border: 0,
  borderRadius: 8,
  padding: '10px 14px',
  fontWeight: 700,
  cursor: 'pointer',
  fontSize: 13,
};

const td: React.CSSProperties = { padding: '8px 6px', verticalAlign: 'middle', color: '#334155' };
