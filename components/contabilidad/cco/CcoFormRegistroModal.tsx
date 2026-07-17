'use client';

import React, { useEffect, useState } from 'react';
import { CCO_TIPOS_GASTO } from '@/lib/contabilidad/ccoClasificarGasto';

type Props = {
  proyectoId: string;
  onSaved?: () => void;
  /** Clase inicial al abrir el formulario. */
  defaultClase?: 'GASTO' | 'INGRESO' | 'CONTRATO';
  /** Texto del botón disparador. */
  triggerLabel?: string;
  /** Estilo del disparador (sidebar V4). */
  triggerVariant?: 'primary' | 'ingreso' | 'ghost';
  /** Oculta el botón y controla apertura desde fuera. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

const empty = {
  clase: 'GASTO' as 'GASTO' | 'INGRESO' | 'CONTRATO',
  fecha: new Date().toISOString().slice(0, 10),
  proveedor: '',
  descripcion: '',
  monto_usd: '',
  tipo_gasto_cco: 'MATERIALES',
  capitulo_cco: '',
  subcapitulo_cco: '',
  admin_pct: '15',
  contrato_obra_id: '',
  forma_pago: 'TRANSFERENCIA BANCARIA',
};

export default function CcoFormRegistroModal({
  proyectoId,
  onSaved,
  defaultClase = 'GASTO',
  triggerLabel = '+ Nuevo registro',
  triggerVariant = 'primary',
  open: openProp,
  onOpenChange,
}: Props) {
  const [openInternal, setOpenInternal] = useState(false);
  const open = openProp ?? openInternal;
  const setOpen = (v: boolean) => {
    onOpenChange?.(v);
    if (openProp === undefined) setOpenInternal(v);
  };
  const [form, setForm] = useState({ ...empty, clase: defaultClase });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [contratos, setContratos] = useState<{ id: string; label: string }[]>([]);

  useEffect(() => {
    if (open) {
      setForm((f) => ({ ...f, clase: defaultClase, fecha: f.fecha || empty.fecha }));
    }
  }, [open, defaultClase]);

  useEffect(() => {
    if (!open || !proyectoId || form.clase !== 'GASTO') return;
    void (async () => {
      try {
        const res = await fetch(
          `/api/contabilidad/cco/contratos?proyecto=${encodeURIComponent(proyectoId)}`,
          { cache: 'no-store' },
        );
        const json = await res.json();
        const opts: { id: string; label: string }[] = [];
        for (const p of json.porProveedor ?? []) {
          for (const c of p.contratos ?? []) {
            opts.push({ id: c.id, label: `${p.proveedor} · ${c.descripcion}` });
          }
        }
        setContratos(opts);
      } catch {
        setContratos([]);
      }
    })();
  }, [open, proyectoId, form.clase]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!proyectoId) return;
    setSaving(true);
    setError(null);
    setOkMsg(null);
    try {
      const res = await fetch('/api/contabilidad/cco/registros', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clase: form.clase,
          proyecto_id: proyectoId,
          fecha: form.fecha,
          proveedor: form.proveedor || undefined,
          descripcion: form.descripcion,
          monto_usd: Number(form.monto_usd),
          tipo_gasto_cco: form.tipo_gasto_cco,
          capitulo_cco: form.capitulo_cco || undefined,
          subcapitulo_cco: form.subcapitulo_cco || undefined,
          admin_pct: Number(form.admin_pct) || 15,
          contrato_obra_id: form.contrato_obra_id || null,
          forma_pago: form.forma_pago,
          moneda: 'USD',
        }),
      });
      const json = await res.json();
      if (!res.ok || json.ok === false) throw new Error(json.error ?? 'No se pudo guardar');
      setOkMsg(`${form.clase} registrado · id ${String(json.id).slice(0, 8)}…`);
      setForm({ ...empty, clase: form.clase, fecha: form.fecha });
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setSaving(false);
    }
  }

  if (!proyectoId) {
    return (
      <p style={{ color: '#B45309', fontSize: 13, fontWeight: 700 }}>
        Selecciona una obra para registrar movimientos.
      </p>
    );
  }

  const triggerStyle =
    triggerVariant === 'ingreso'
      ? btnIngreso
      : triggerVariant === 'ghost'
        ? btnGhost
        : btnPrimary;

  return (
    <div>
      {openProp === undefined ? (
        <button type="button" onClick={() => setOpen(true)} style={triggerStyle}>
          {triggerLabel}
        </button>
      ) : null}

      {open ? (
        <div
          role="dialog"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15,23,42,0.45)',
            zIndex: 80,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={() => setOpen(false)}
        >
          <form
            onSubmit={submit}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#fff',
              borderRadius: 14,
              padding: 22,
              width: 'min(560px, 100%)',
              maxHeight: '90vh',
              overflow: 'auto',
              boxShadow: '0 20px 50px rgba(15,23,42,0.25)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Nuevo registro CCO</h3>
              <button type="button" onClick={() => setOpen(false)} style={btnGhost}>
                Cerrar
              </button>
            </div>

            <div style={{ display: 'grid', gap: 10 }}>
              <label style={label}>
                Clase
                <select
                  value={form.clase}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      clase: e.target.value as typeof f.clase,
                    }))
                  }
                  style={input}
                >
                  <option value="GASTO">GASTO</option>
                  <option value="INGRESO">INGRESO</option>
                  <option value="CONTRATO">CONTRATO</option>
                </select>
              </label>

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

              {form.clase !== 'INGRESO' ? (
                <label style={label}>
                  Proveedor / Subcontratista
                  <input
                    required
                    value={form.proveedor}
                    onChange={(e) => setForm((f) => ({ ...f, proveedor: e.target.value }))}
                    style={input}
                  />
                </label>
              ) : null}

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
                  value={form.monto_usd}
                  onChange={(e) => setForm((f) => ({ ...f, monto_usd: e.target.value }))}
                  style={input}
                />
              </label>

              {form.clase === 'GASTO' ? (
                <>
                  <label style={label}>
                    Tipo de gasto
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
                    Capítulo
                    <input
                      value={form.capitulo_cco}
                      onChange={(e) => setForm((f) => ({ ...f, capitulo_cco: e.target.value }))}
                      style={input}
                      placeholder="Ej. MODULO A"
                    />
                  </label>
                  <label style={label}>
                    Subcapítulo
                    <input
                      value={form.subcapitulo_cco}
                      onChange={(e) => setForm((f) => ({ ...f, subcapitulo_cco: e.target.value }))}
                      style={input}
                    />
                  </label>
                  {(form.tipo_gasto_cco === 'CONTRATISTA') && contratos.length ? (
                    <label style={label}>
                      Contrato vinculado
                      <select
                        value={form.contrato_obra_id}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, contrato_obra_id: e.target.value }))
                        }
                        style={input}
                      >
                        <option value="">Sin vínculo</option>
                        {contratos.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                </>
              ) : null}

              {form.clase !== 'INGRESO' ? (
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
              ) : null}

              <label style={label}>
                Forma de pago
                <input
                  value={form.forma_pago}
                  onChange={(e) => setForm((f) => ({ ...f, forma_pago: e.target.value }))}
                  style={input}
                />
              </label>
            </div>

            {error ? <p style={{ color: '#B91C1C', fontSize: 13, marginTop: 12 }}>{error}</p> : null}
            {okMsg ? <p style={{ color: '#15803D', fontSize: 13, marginTop: 12 }}>{okMsg}</p> : null}

            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setOpen(false)} style={btnGhost}>
                Cancelar
              </button>
              <button type="submit" disabled={saving} style={btnPrimary}>
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}

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

const btnIngreso: React.CSSProperties = {
  width: '100%',
  background: '#16A34A',
  color: '#fff',
  border: 0,
  borderRadius: 10,
  padding: '12px 14px',
  fontWeight: 800,
  cursor: 'pointer',
  fontSize: 14,
};

const btnGhost: React.CSSProperties = {
  background: '#fff',
  color: '#334155',
  border: '1px solid #CBD5E1',
  borderRadius: 8,
  padding: '8px 12px',
  fontWeight: 700,
  cursor: 'pointer',
  fontSize: 13,
};
