'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CCO_TIPOS_GASTO } from '@/lib/contabilidad/ccoClasificarGasto';

type SplitRow = { capitulo: string; subcapitulo: string; pct: string };

type Props = {
  proyectoId: string;
  onDone?: () => void;
};

function fmtUsd(n: number): string {
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function CcoTabDistribucion({ proyectoId, onDone }: Props) {
  const [capitulos, setCapitulos] = useState<string[]>([]);
  const [form, setForm] = useState({
    fecha: new Date().toISOString().slice(0, 10),
    proveedor: '',
    descripcion: '',
    monto_usd: '',
    tipo_gasto_cco: 'MATERIALES',
    admin_pct: '15',
    forma_pago: 'TRANSFERENCIA BANCARIA',
  });
  const [splits, setSplits] = useState<SplitRow[]>([
    { capitulo: '', subcapitulo: '', pct: '' },
    { capitulo: '', subcapitulo: '', pct: '' },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const cargarCaps = useCallback(async () => {
    if (!proyectoId) return;
    try {
      const res = await fetch(
        `/api/contabilidad/cco/distribucion?proyecto=${encodeURIComponent(proyectoId)}`,
        { cache: 'no-store' },
      );
      const json = await res.json();
      if (res.ok && json.ok !== false) setCapitulos(json.capitulos ?? []);
    } catch {
      /* ignore */
    }
  }, [proyectoId]);

  useEffect(() => {
    void cargarCaps();
  }, [cargarCaps]);

  const sumaPct = useMemo(
    () => splits.reduce((a, s) => a + (Number(s.pct) || 0), 0),
    [splits],
  );

  const preview = useMemo(() => {
    const total = Number(form.monto_usd) || 0;
    return splits
      .filter((s) => s.capitulo.trim() && Number(s.pct) > 0)
      .map((s) => {
        const pct = Number(s.pct) || 0;
        return {
          capitulo: s.capitulo,
          pct,
          monto: Math.round(total * (pct / 100) * 100) / 100,
        };
      });
  }, [splits, form.monto_usd]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!proyectoId) return;
    setSaving(true);
    setError(null);
    setOkMsg(null);
    try {
      const res = await fetch('/api/contabilidad/cco/distribucion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proyecto_id: proyectoId,
          fecha: form.fecha,
          proveedor: form.proveedor,
          descripcion: form.descripcion,
          monto_usd: Number(form.monto_usd),
          tipo_gasto_cco: form.tipo_gasto_cco,
          admin_pct: Number(form.admin_pct) || 15,
          forma_pago: form.forma_pago,
          splits: splits
            .filter((s) => s.capitulo.trim() && Number(s.pct) > 0)
            .map((s) => ({
              capitulo: s.capitulo.trim(),
              subcapitulo: s.subcapitulo.trim() || null,
              pct: Number(s.pct),
            })),
        }),
      });
      const json = await res.json();
      if (!res.ok || json.ok === false) throw new Error(json.error ?? 'Error');
      setOkMsg(`Creados ${json.creados} gastos repartidos.`);
      setSplits([
        { capitulo: '', subcapitulo: '', pct: '' },
        { capitulo: '', subcapitulo: '', pct: '' },
      ]);
      onDone?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setSaving(false);
    }
  }

  if (!proyectoId) {
    return (
      <div style={box}>
        <h3 style={h3}>Distribución masiva</h3>
        <p style={muted}>Selecciona una obra para repartir un gasto entre capítulos (Σ % = 100).</p>
      </div>
    );
  }

  return (
    <div style={box}>
      <h3 style={h3}>Distribución masiva</h3>
      <p style={muted}>
        Como en V4: un monto se parte en N filas con <code>(48%)</code>, <code>(20%)</code>… en la descripción.
        No afecta stock.
      </p>

      <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
          <label style={label}>
            Fecha
            <input
              type="date"
              required
              value={form.fecha}
              onChange={(e) => setForm((f) => ({ ...f, fecha: e.target.value }))}
              style={input}
            />
          </label>
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
            Monto total USD
            <input
              required
              type="number"
              min={0.01}
              step="0.01"
              value={form.monto_usd}
              onChange={(e) => setForm((f) => ({ ...f, monto_usd: e.target.value }))}
              style={input}
            />
          </label>
          <label style={label}>
            Tipo
            <select
              value={form.tipo_gasto_cco}
              onChange={(e) => setForm((f) => ({ ...f, tipo_gasto_cco: e.target.value }))}
              style={input}
            >
              {CCO_TIPOS_GASTO.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
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
        </div>

        <label style={label}>
          Descripción base
          <input
            required
            value={form.descripcion}
            onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
            style={input}
            placeholder="Ej. ABONO MANO DE OBRA TEJAS"
          />
        </label>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <strong style={{ fontSize: 13 }}>Partes por capítulo</strong>
            <span
              style={{
                fontSize: 12,
                fontWeight: 800,
                color: Math.abs(sumaPct - 100) < 0.05 ? '#15803D' : '#B45309',
              }}
            >
              Suma {sumaPct.toFixed(2)}%
            </span>
          </div>
          {splits.map((s, idx) => (
            <div
              key={idx}
              style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1.5fr 90px 36px',
                gap: 8,
                marginBottom: 8,
              }}
            >
              <input
                list="cco-caps"
                placeholder="Capítulo"
                value={s.capitulo}
                onChange={(e) =>
                  setSplits((rows) =>
                    rows.map((r, i) => (i === idx ? { ...r, capitulo: e.target.value } : r)),
                  )
                }
                style={input}
              />
              <input
                placeholder="Subcapítulo"
                value={s.subcapitulo}
                onChange={(e) =>
                  setSplits((rows) =>
                    rows.map((r, i) => (i === idx ? { ...r, subcapitulo: e.target.value } : r)),
                  )
                }
                style={input}
              />
              <input
                type="number"
                min={0}
                step="0.01"
                placeholder="%"
                value={s.pct}
                onChange={(e) =>
                  setSplits((rows) =>
                    rows.map((r, i) => (i === idx ? { ...r, pct: e.target.value } : r)),
                  )
                }
                style={input}
              />
              <button
                type="button"
                onClick={() => setSplits((rows) => rows.filter((_, i) => i !== idx))}
                style={btnGhost}
                title="Quitar"
              >
                ×
              </button>
            </div>
          ))}
          <datalist id="cco-caps">
            {capitulos.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <button
            type="button"
            onClick={() => setSplits((rows) => [...rows, { capitulo: '', subcapitulo: '', pct: '' }])}
            style={btnGhost}
          >
            + Parte
          </button>
        </div>

        {preview.length ? (
          <div style={{ background: '#F8FAFC', borderRadius: 10, padding: 12, fontSize: 12 }}>
            <strong>Vista previa</strong>
            <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
              {preview.map((p) => (
                <li key={`${p.capitulo}-${p.pct}`}>
                  {p.capitulo} · {p.pct}% · {fmtUsd(p.monto)}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {error ? <p style={{ color: '#B91C1C', fontSize: 13, margin: 0 }}>{error}</p> : null}
        {okMsg ? <p style={{ color: '#15803D', fontSize: 13, margin: 0 }}>{okMsg}</p> : null}

        <button type="submit" disabled={saving} style={btnPrimary}>
          {saving ? 'Creando…' : 'Crear distribución'}
        </button>
      </form>
    </div>
  );
}

const box: React.CSSProperties = {
  background: '#fff',
  borderRadius: 14,
  border: '1px solid #E2E8F0',
  padding: 24,
};
const h3: React.CSSProperties = { margin: '0 0 8px', fontSize: 18, fontWeight: 800 };
const muted: React.CSSProperties = { color: '#64748B', fontSize: 13, margin: '0 0 16px', lineHeight: 1.5 };
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
  width: '100%',
  boxSizing: 'border-box',
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
  justifySelf: 'start',
};
const btnGhost: React.CSSProperties = {
  background: '#fff',
  color: '#334155',
  border: '1px solid #CBD5E1',
  borderRadius: 8,
  padding: '8px 10px',
  fontWeight: 700,
  cursor: 'pointer',
  fontSize: 13,
};
