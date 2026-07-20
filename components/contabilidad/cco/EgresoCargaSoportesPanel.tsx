'use client';

import { useMemo, useRef, useState, type CSSProperties } from 'react';
import { CloudUpload, FileUp, Loader2, Plus } from 'lucide-react';
import type { CcoLibroFila } from '@/lib/contabilidad/cco/types';

type FilaSoporte = CcoLibroFila & { _agrupada?: boolean };

type Props = {
  filas: FilaSoporte[];
  onAdjuntado: (compraId: string, fileName: string) => void;
};

/**
 * Carga Manual de Soportes (estilo referencia):
 * 1) Seleccione el egreso  2) Elegir archivo imagen/PDF  3) Enlazar
 */
export default function EgresoCargaSoportesPanel({ filas, onAdjuntado }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const sinDoc = useMemo(
    () => filas.filter((f) => f.fuente === 'compra' && !f._agrupada && !f.tiene_documento),
    [filas],
  );
  const todas = useMemo(
    () => filas.filter((f) => f.fuente === 'compra' && !f._agrupada),
    [filas],
  );

  const [compraId, setCompraId] = useState('');
  const [filasExtra, setFilasExtra] = useState(1);
  const [subiendo, setSubiendo] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const opciones = sinDoc.length > 0 ? sinDoc : todas;

  const subir = async (file: File) => {
    if (!compraId) {
      setErr('Seleccione el egreso (soporte) al que enlazar la factura.');
      return;
    }
    setSubiendo(true);
    setErr(null);
    setMsg(null);
    try {
      const form = new FormData();
      form.append('documento', file, file.name);
      const res = await fetch(
        `/api/contabilidad/compras/${encodeURIComponent(compraId)}/document`,
        { method: 'POST', body: form },
      );
      const data = (await res.json()) as { ok?: boolean; error?: string; fileName?: string };
      if (!res.ok || !data.ok) throw new Error(data.error || 'No se pudo cargar el soporte');
      onAdjuntado(compraId, data.fileName || file.name);
      setMsg(`Soporte enlazado (${data.fileName || file.name}).`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error al subir');
    } finally {
      setSubiendo(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 14,
        border: '1px solid #E2E8F0',
        padding: 16,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <CloudUpload size={20} color="#1D4ED8" />
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0F172A' }}>
          Carga Manual de Soportes
        </h3>
      </div>
      <p
        style={{
          margin: '0 0 14px',
          padding: '10px 12px',
          borderRadius: 10,
          background: '#EFF6FF',
          border: '1px solid #BFDBFE',
          fontSize: 13,
          color: '#1E3A8A',
          lineHeight: 1.45,
        }}
      >
        Presione en el ícono + para subir archivos adicionales o según pida el siguiente formulario.
        Formatos: <strong>PNG, JPG, BMP, PDF</strong>
        {sinDoc.length > 0 ? (
          <>
            {' '}
            · <strong>{sinDoc.length}</strong> egreso(s) sin soporte.
          </>
        ) : null}
      </p>

      {Array.from({ length: filasExtra }).map((_, i) => (
        <div
          key={i}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 12,
            alignItems: 'end',
            marginBottom: 12,
            paddingBottom: 12,
            borderBottom: i < filasExtra - 1 ? '1px dashed #E2E8F0' : undefined,
          }}
        >
          <div>
            <label style={label}>1. Seleccione Soporte</label>
            <select
              value={i === 0 ? compraId : ''}
              onChange={(e) => {
                if (i === 0) setCompraId(e.target.value);
              }}
              style={select}
              disabled={opciones.length === 0 || i > 0}
            >
              <option value="">Seleccione Soporte</option>
              {opciones.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.fecha ?? 's/f'} · {f.proveedor.slice(0, 24)} ·{' '}
                  {(f.invoice_number || f.descripcion).slice(0, 32)} ·{' '}
                  {f.monto_base_usd.toLocaleString('en-US', {
                    style: 'currency',
                    currency: 'USD',
                  })}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={label}>Cargar Soporte como imagen</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                ref={i === 0 ? inputRef : undefined}
                type="file"
                accept="image/*,application/pdf,.bmp,.zip"
                disabled={subiendo || !compraId || i > 0}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f && i === 0) void subir(f);
                }}
                style={{ ...select, padding: '8px 10px' }}
              />
            </div>
            <p style={{ margin: '6px 0 0', fontSize: 11, color: '#94A3B8' }}>
              PNG, JPG, BMP, PDF, ZIP
            </p>
          </div>
          {i === 0 ? (
            <div>
              <button
                type="button"
                disabled={subiendo || !compraId}
                onClick={() => inputRef.current?.click()}
                style={{
                  ...btn,
                  opacity: subiendo || !compraId ? 0.55 : 1,
                }}
              >
                {subiendo ? <Loader2 size={16} className="animate-spin" /> : <FileUp size={16} />}
                {subiendo ? 'Subiendo…' : 'Elegir'}
              </button>
            </div>
          ) : null}
        </div>
      ))}

      <button
        type="button"
        onClick={() => setFilasExtra((n) => Math.min(n + 1, 5))}
        style={btnAdd}
      >
        <Plus size={16} /> Añadir Fila
      </button>

      {err ? <p style={{ color: '#B91C1C', fontSize: 13, margin: '10px 0 0' }}>{err}</p> : null}
      {msg ? <p style={{ color: '#15803D', fontSize: 13, margin: '10px 0 0' }}>{msg}</p> : null}
    </div>
  );
}

const label: CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 700,
  color: '#64748B',
  marginBottom: 4,
};
const select: CSSProperties = {
  width: '100%',
  border: '1px solid #CBD5E1',
  borderRadius: 8,
  padding: '8px 10px',
  fontSize: 13,
  color: '#0F172A',
  background: '#fff',
};
const btn: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  border: 'none',
  background: '#1D4ED8',
  color: '#fff',
  borderRadius: 10,
  padding: '10px 14px',
  fontWeight: 800,
  fontSize: 13,
  cursor: 'pointer',
  width: '100%',
  justifyContent: 'center',
};
const btnAdd: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  border: '1px dashed #93C5FD',
  background: '#EFF6FF',
  color: '#1D4ED8',
  borderRadius: 10,
  padding: '8px 12px',
  fontWeight: 800,
  fontSize: 13,
  cursor: 'pointer',
};
