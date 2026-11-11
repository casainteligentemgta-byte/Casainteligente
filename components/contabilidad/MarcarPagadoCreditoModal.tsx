'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { Banknote, Loader2, X } from 'lucide-react';
import { formatearUsdCorto } from '@/lib/contabilidad/creditoPagos';
import { todayIsoVenezuela } from '@/lib/contabilidad/comprasFiltros';

type Props = {
  open: boolean;
  compra: {
    purchaseInvoiceId: string;
    proveedor: string;
    numeroFactura: string;
    saldoUsd: number;
    entidadNombre?: string | null;
  } | null;
  onClose: () => void;
  onPagado: () => void | Promise<void>;
};

export default function MarcarPagadoCreditoModal({ open, compra, onClose, onPagado }: Props) {
  const [fecha, setFecha] = useState(todayIsoVenezuela());
  const [monto, setMonto] = useState('');
  const [referencia, setReferencia] = useState('');
  const [archivo, setArchivo] = useState<File | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !compra) return;
    setFecha(todayIsoVenezuela());
    setMonto(String(compra.saldoUsd));
    setReferencia('');
    setArchivo(null);
    setError(null);
    setGuardando(false);
  }, [open, compra]);

  if (!open || !compra) return null;

  const guardar = async () => {
    setGuardando(true);
    setError(null);
    try {
      const form = new FormData();
      form.set('fecha_pago', fecha);
      if (monto.trim()) form.set('monto_usd', monto.trim());
      if (referencia.trim()) form.set('referencia', referencia.trim());
      if (archivo) form.set('comprobante', archivo);
      const res = await fetch(
        `/api/contabilidad/creditos/${encodeURIComponent(compra.purchaseInvoiceId)}/pagar`,
        { method: 'POST', body: form },
      );
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error || 'No se pudo registrar el pago.');
      await onPagado();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="credito-pagado-titulo"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 80,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 420,
          background: '#1c1c1e',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 16,
          padding: 20,
          color: '#fff',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 id="credito-pagado-titulo" style={{ fontSize: 16, fontWeight: 800, display: 'flex', gap: 8, alignItems: 'center' }}>
            <Banknote className="h-4 w-4" /> Marcar pagado
          </h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" style={{ background: 'none', border: 0, color: '#aaa' }}>
            <X className="h-4 w-4" />
          </button>
        </div>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginBottom: 12 }}>
          {compra.proveedor} · #{compra.numeroFactura}
          {compra.entidadNombre ? ` · ${compra.entidadNombre}` : ''}
          <br />
          Saldo US${formatearUsdCorto(compra.saldoUsd)}
        </p>
        <label style={labelSt}>
          Fecha
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} style={inputSt} />
        </label>
        <label style={labelSt}>
          Monto USD (vacío = total)
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            style={inputSt}
          />
        </label>
        <label style={labelSt}>
          Referencia (opcional)
          <input
            type="text"
            value={referencia}
            onChange={(e) => setReferencia(e.target.value)}
            placeholder="Transferencia, nro. de control…"
            style={inputSt}
          />
        </label>
        <label style={labelSt}>
          Comprobante (opcional)
          <input
            type="file"
            accept="image/*,application/pdf"
            onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
            style={{ ...inputSt, padding: 8 }}
          />
        </label>
        {error ? <p style={{ color: '#f87171', fontSize: 12, marginTop: 8 }}>{error}</p> : null}
        <button
          type="button"
          onClick={() => void guardar()}
          disabled={guardando}
          style={{
            marginTop: 16,
            width: '100%',
            padding: '10px 12px',
            borderRadius: 10,
            border: 0,
            background: '#16a34a',
            color: '#fff',
            fontWeight: 800,
            display: 'flex',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Confirmar pago
        </button>
      </div>
    </div>
  );
}

const labelSt: CSSProperties = { display: 'block', fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 10 };
const inputSt: CSSProperties = {
  display: 'block',
  width: '100%',
  marginTop: 4,
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(0,0,0,0.35)',
  color: '#fff',
  fontSize: 13,
};
