'use client';

import { useMemo, useRef, useState, type CSSProperties } from 'react';
import { CloudUpload, FileUp, Loader2 } from 'lucide-react';
import type { CcoLibroFila } from '@/lib/contabilidad/cco/types';

type FilaSoporte = CcoLibroFila & { _agrupada?: boolean };

type Props = {
  filas: FilaSoporte[];
  onAdjuntado: (compraId: string, fileName: string) => void;
};

/**
 * Panel inferior tipo «Carga Manual de Soportes»:
 * elige un egreso sin factura (o cualquiera) y sube PDF/imagen enlazado.
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
  const [subiendo, setSubiendo] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const opciones = sinDoc.length > 0 ? sinDoc : todas;

  const subir = async (file: File) => {
    if (!compraId) {
      setErr('Seleccione el egreso al que enlazar la factura.');
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
      setMsg(`Factura enlazada al egreso (${data.fileName || file.name}).`);
      setCompraId('');
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
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#0F172A' }}>
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
        Suba la imagen o PDF de la factura y enlácela a un egreso de la tabla. También puede
        usar <strong>Adjuntar</strong> en la columna LINK FACTURA de cada fila.
        {sinDoc.length > 0 ? (
          <>
            {' '}
            Hay <strong>{sinDoc.length}</strong> egreso(s) sin soporte.
          </>
        ) : null}
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 12,
          alignItems: 'end',
        }}
      >
        <div>
          <label style={label}>Egreso / factura a enlazar</label>
          <select
            value={compraId}
            onChange={(e) => setCompraId(e.target.value)}
            style={select}
            disabled={opciones.length === 0}
          >
            <option value="">— Seleccionar —</option>
            {opciones.map((f) => (
              <option key={f.id} value={f.id}>
                {f.fecha ?? 's/f'} · {f.proveedor.slice(0, 28)} ·{' '}
                {(f.invoice_number || f.descripcion).slice(0, 36)} ·{' '}
                {f.monto_base_usd.toLocaleString('en-US', {
                  style: 'currency',
                  currency: 'USD',
                })}
                {f.tiene_documento ? ' (ya tiene)' : ''}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={label}>Archivo (JPG, PNG, PDF)</label>
          <input
            ref={inputRef}
            type="file"
            accept="image/*,application/pdf"
            disabled={subiendo || !compraId}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void subir(f);
            }}
            style={{ ...select, padding: '8px 10px' }}
          />
        </div>
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
            {subiendo ? 'Subiendo…' : 'Cargar y enlazar'}
          </button>
        </div>
      </div>
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
