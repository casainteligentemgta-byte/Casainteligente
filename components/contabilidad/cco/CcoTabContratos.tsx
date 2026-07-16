'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { CcoProveedorContratos, CcoPagoVinculado } from '@/lib/contabilidad/cco/types';

function fmtUsd(n: number): string {
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
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
      setPorProveedor(json.porProveedor ?? []);
      setHuerfanos(json.huerfanos ?? []);
      setResumen(json.resumen ?? { contratos: 0, contratado: 0, pagado: 0, saldo: 0 });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
      setPorProveedor([]);
      setHuerfanos([]);
    } finally {
      setLoading(false);
    }
  }, [proyectoId, onNeedProyecto]);

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
          { t: 'Contratos', v: String(resumen.contratos) },
          { t: 'Contratado', v: fmtUsd(resumen.contratado) },
          { t: 'Pagado', v: fmtUsd(resumen.pagado) },
          { t: 'Saldo', v: fmtUsd(resumen.saldo) },
        ].map((k) => (
          <div key={k.t} style={{ ...box, padding: '12px 14px' }}>
            <p style={{ ...muted, margin: 0, fontSize: 11, fontWeight: 800 }}>{k.t}</p>
            <p style={{ margin: '6px 0 0', fontSize: 18, fontWeight: 800 }}>{k.v}</p>
          </div>
        ))}
      </div>

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
