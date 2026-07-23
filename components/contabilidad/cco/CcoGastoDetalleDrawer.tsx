'use client';

import React, { useEffect, useState } from 'react';
import { ExternalLink, Loader2, Ruler, Trash2, Upload } from 'lucide-react';
import type { CcoLibroFila } from '@/lib/contabilidad/cco/types';
import TablaComputos from '@/components/computos/TablaComputos';

type Props = {
  fila: CcoLibroFila | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
};

type FormState = {
  clase: string;
  fecha: string;
  proveedor: string;
  tipo: string;
  capitulo: string;
  subcapitulo: string;
  descripcion: string;
  contrato_vinculado: string;
  moneda: string;
  tasa: string;
  monto_orig: string;
  monto_base_usd: string;
  monto_pagado: string;
  forma_pago: string;
  link_factura: string;
  link_comprobante: string;
  estado: string;
  honorarios: string;
  costo_total: string;
  porcentaje_admin: string;
  tasa_binance: string;
  tasa_usada: string;
  porcentaje_brecha_real: string;
  pool_asignado: string;
  avance_fisico: string;
};

function fromFila(f: CcoLibroFila): FormState {
  const n = (v: number | null | undefined) => (v != null && Number.isFinite(Number(v)) ? String(v) : '');
  return {
    clase: f.clase,
    fecha: f.fecha ?? '',
    proveedor: f.proveedor === 'Sin proveedor' ? '' : f.proveedor,
    tipo: f.tipo === '—' ? '' : f.tipo,
    capitulo: f.capitulo === '—' ? '' : f.capitulo,
    subcapitulo: f.subcapitulo === '—' ? '' : f.subcapitulo,
    descripcion: f.descripcion === '—' ? '' : f.descripcion,
    contrato_vinculado: f.contrato_vinculado ?? f.contrato_obra_id ?? '',
    moneda: f.moneda || 'USD',
    tasa: n(f.tasa),
    monto_orig: n(f.monto_orig),
    monto_base_usd: n(f.monto_base_usd),
    monto_pagado: n(f.monto_pagado),
    forma_pago: f.forma_pago ?? '',
    link_factura: f.link_factura ?? '',
    link_comprobante: f.link_comprobante ?? '',
    estado: f.estado === '—' ? '' : f.estado,
    honorarios: n(f.honorarios_usd),
    costo_total: n(f.costo_total_usd),
    porcentaje_admin: n(f.porcentaje_admin),
    tasa_binance: n(f.tasa_binance),
    tasa_usada: f.tasa_usada ?? '',
    porcentaje_brecha_real: n(f.porcentaje_brecha_real),
    pool_asignado: n(f.pool_asignado),
    avance_fisico: n(f.avance_fisico),
  };
}

function numOrUndef(s: string): number | undefined {
  if (!s.trim()) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

export default function CcoGastoDetalleDrawer({ fila, open, onClose, onSaved }: Props) {
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploading, setUploading] = useState<'factura' | 'comprobante' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [panelComputos, setPanelComputos] = useState(false);
  const editable = Boolean(fila?.editable);

  useEffect(() => {
    if (open && fila) {
      setForm(fromFila(fila));
      setError(null);
      setPanelComputos(false);
    } else {
      setForm(null);
      setPanelComputos(false);
    }
  }, [open, fila]);

  if (!open || !fila || !form) return null;

  async function upload(tipo: 'factura' | 'comprobante', file: File | null) {
    if (!file || !fila) return;
    setUploading(tipo);
    setError(null);
    try {
      const fd = new FormData();
      fd.set('file', file);
      fd.set('tipo', tipo);
      fd.set('gastoId', fila.id);
      const res = await fetch('/api/contabilidad/cco/gastos/upload', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok || json.ok === false) throw new Error(json.error ?? 'Error al subir');
      setForm((f) =>
        f
          ? {
              ...f,
              [tipo === 'factura' ? 'link_factura' : 'link_comprobante']: String(json.url),
            }
          : f,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al subir');
    } finally {
      setUploading(null);
    }
  }

  async function save() {
    if (!fila || !form || !editable) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/contabilidad/cco/gastos/${encodeURIComponent(fila.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clase: form.clase,
          fecha: form.fecha || null,
          proveedor: form.proveedor || null,
          tipo: form.tipo || null,
          capitulo: form.capitulo || null,
          subcapitulo: form.subcapitulo || null,
          descripcion: form.descripcion || null,
          contrato_vinculado: form.contrato_vinculado || null,
          moneda: form.moneda || 'USD',
          tasa: numOrUndef(form.tasa),
          monto_orig: numOrUndef(form.monto_orig),
          monto_base_usd: numOrUndef(form.monto_base_usd),
          monto_pagado: numOrUndef(form.monto_pagado),
          forma_pago: form.forma_pago || null,
          link_factura: form.link_factura || null,
          link_comprobante: form.link_comprobante || null,
          estado: form.estado || null,
          honorarios: numOrUndef(form.honorarios),
          costo_total: numOrUndef(form.costo_total),
          porcentaje_admin: numOrUndef(form.porcentaje_admin),
          tasa_binance: numOrUndef(form.tasa_binance),
          tasa_usada: form.tasa_usada || null,
          porcentaje_brecha_real: numOrUndef(form.porcentaje_brecha_real),
          pool_asignado: numOrUndef(form.pool_asignado),
          avance_fisico: numOrUndef(form.avance_fisico),
        }),
      });
      const json = await res.json();
      if (!res.ok || json.ok === false) throw new Error(json.error ?? 'No se pudo guardar');
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!fila || !editable) return;
    if (!window.confirm('¿Eliminar este registro de forma permanente?')) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/contabilidad/cco/gastos/${encodeURIComponent(fila.id)}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!res.ok || json.ok === false) throw new Error(json.error ?? 'No se pudo eliminar');
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setDeleting(false);
    }
  }

  async function anular() {
    if (!fila || !editable || !form) return;
    setForm({ ...form, estado: 'ANULADO' });
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/contabilidad/cco/gastos/${encodeURIComponent(fila.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: 'ANULADO' }),
      });
      const json = await res.json();
      if (!res.ok || json.ok === false) throw new Error(json.error ?? 'No se pudo anular');
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setSaving(false);
    }
  }

  const set =
    (key: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      setForm((f) => (f ? { ...f, [key]: e.target.value } : f));
    };

  const field = (label: string, key: keyof FormState, opts?: { type?: string; readOnly?: boolean }) => (
    <label style={lab}>
      {label}
      <input
        type={opts?.type ?? 'text'}
        value={form[key]}
        onChange={set(key)}
        disabled={!editable || opts?.readOnly}
        style={inp}
      />
    </label>
  );

  return (
    <div
      role="dialog"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15,23,42,0.45)',
        zIndex: 90,
        display: 'flex',
        justifyContent: 'flex-end',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: panelComputos ? 'min(920px, 100%)' : 'min(520px, 100%)',
          height: '100%',
          background: '#fff',
          boxShadow: '-12px 0 40px rgba(15,23,42,0.2)',
          display: 'flex',
          flexDirection: 'column',
          transition: 'width 0.2s ease',
        }}
      >
        <div
          style={{
            padding: '16px 18px',
            borderBottom: '1px solid #E2E8F0',
            display: 'flex',
            justifyContent: 'space-between',
            gap: 8,
            alignItems: 'center',
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>Detalle del registro</h3>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#64748B' }}>
              ID {fila.id}
              {!editable ? ' · solo lectura (fuente fusionada)' : ' · 25 campos · editable'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => setPanelComputos((v) => !v)}
              style={{
                ...btnGhost,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: panelComputos ? '#ECFDF5' : '#fff',
                borderColor: panelComputos ? '#99F6E4' : '#CBD5E1',
                color: panelComputos ? '#0F766E' : '#334155',
              }}
            >
              <Ruler size={14} />
              Cómputos
            </button>
            <button type="button" onClick={onClose} style={btnGhost}>
              Cerrar
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
          {panelComputos ? (
            <TablaComputos
              titulo="Cómputos del gasto"
              capitulo={form.capitulo || undefined}
              subcapitulo={form.subcapitulo || null}
              gastoId={Number.isFinite(Number(fila.id)) ? Number(fila.id) : null}
              capituloFijo={Boolean(form.capitulo)}
            />
          ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            <label style={lab}>
              Clase
              <select value={form.clase} onChange={set('clase')} disabled={!editable} style={inp}>
                {['GASTO', 'INGRESO', 'CONTRATO', 'PRESUPUESTO', 'AUDITORIA'].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            {field('Fecha', 'fecha', { type: 'date' })}
            {field('Proveedor', 'proveedor')}
            {field('Tipo', 'tipo')}
            {field('Capítulo', 'capitulo')}
            {field('Subcapítulo', 'subcapitulo')}
            <label style={lab}>
              Descripción
              <textarea value={form.descripcion} onChange={set('descripcion')} disabled={!editable} style={{ ...inp, minHeight: 64 }} />
            </label>
            {field('Contrato vinculado', 'contrato_vinculado')}
            {field('Moneda', 'moneda')}
            {field('Tasa', 'tasa', { type: 'number' })}
            {field('Monto orig', 'monto_orig', { type: 'number' })}
            {field('Monto base USD', 'monto_base_usd', { type: 'number' })}
            {field('Monto pagado', 'monto_pagado', { type: 'number' })}
            {field('Forma de pago', 'forma_pago')}
            {field('Estado', 'estado')}
            {field('Honorarios', 'honorarios', { type: 'number' })}
            {field('Costo total', 'costo_total', { type: 'number' })}
            {field('% Admin', 'porcentaje_admin', { type: 'number' })}
            {field('Tasa Binance', 'tasa_binance', { type: 'number' })}
            {field('Tasa usada', 'tasa_usada')}
            {field('% Brecha real', 'porcentaje_brecha_real', { type: 'number' })}
            {field('Pool asignado', 'pool_asignado', { type: 'number' })}
            {field('Avance físico', 'avance_fisico', { type: 'number' })}

            <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: 12 }}>
              <p style={{ margin: '0 0 8px', fontWeight: 800, fontSize: 13 }}>Soportes</p>
              {field('Link factura', 'link_factura')}
              <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                {form.link_factura ? (
                  <a href={form.link_factura} target="_blank" rel="noreferrer" style={linkBtn}>
                    <ExternalLink size={14} /> Ver factura
                  </a>
                ) : null}
                {editable ? (
                  <label style={linkBtn}>
                    {uploading === 'factura' ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                    Subir factura
                    <input
                      type="file"
                      accept=".pdf,image/*,.png,.jpg,.jpeg,.webp"
                      style={{ display: 'none' }}
                      disabled={!!uploading}
                      onChange={(e) => void upload('factura', e.target.files?.[0] ?? null)}
                    />
                  </label>
                ) : null}
              </div>
              {field('Link comprobante', 'link_comprobante')}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {form.link_comprobante ? (
                  <a href={form.link_comprobante} target="_blank" rel="noreferrer" style={linkBtn}>
                    <ExternalLink size={14} /> Ver comprobante
                  </a>
                ) : null}
                {editable ? (
                  <label style={linkBtn}>
                    {uploading === 'comprobante' ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Upload size={14} />
                    )}
                    Subir comprobante
                    <input
                      type="file"
                      accept=".pdf,image/*,.png,.jpg,.jpeg,.webp"
                      style={{ display: 'none' }}
                      disabled={!!uploading}
                      onChange={(e) => void upload('comprobante', e.target.files?.[0] ?? null)}
                    />
                  </label>
                ) : null}
              </div>
            </div>
          </div>
          )}
          {error && !panelComputos ? <p style={{ color: '#B91C1C', fontSize: 13, marginTop: 12 }}>{error}</p> : null}
        </div>

        {editable && !panelComputos ? (
          <div
            style={{
              padding: 14,
              borderTop: '1px solid #E2E8F0',
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={() => void remove()} disabled={deleting || saving} style={btnDanger}>
                <Trash2 size={14} /> {deleting ? 'Eliminando…' : 'Eliminar'}
              </button>
              <button type="button" onClick={() => void anular()} disabled={saving} style={btnGhost}>
                Anular
              </button>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={onClose} style={btnGhost}>
                Cancelar
              </button>
              <button type="button" onClick={() => void save()} disabled={saving} style={btnPrimary}>
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

const lab: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  fontSize: 12,
  fontWeight: 700,
  color: '#64748B',
};
const inp: React.CSSProperties = {
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid #CBD5E1',
  fontSize: 13,
  fontWeight: 600,
  color: '#0F172A',
};
const btnPrimary: React.CSSProperties = {
  background: '#2563EB',
  color: '#fff',
  border: 0,
  borderRadius: 8,
  padding: '9px 14px',
  fontWeight: 700,
  cursor: 'pointer',
  fontSize: 13,
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
const btnDanger: React.CSSProperties = {
  ...btnGhost,
  color: '#B91C1C',
  borderColor: '#FECACA',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
};
const linkBtn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 10px',
  borderRadius: 8,
  border: '1px solid #CBD5E1',
  background: '#F8FAFC',
  color: '#1D4ED8',
  fontSize: 12,
  fontWeight: 700,
  cursor: 'pointer',
  textDecoration: 'none',
};
