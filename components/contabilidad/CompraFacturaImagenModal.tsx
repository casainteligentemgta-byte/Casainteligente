'use client';

import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import CompraFacturaAdjunto from '@/components/contabilidad/CompraFacturaAdjunto';
import { documentApiPathDesdeCompra } from '@/lib/contabilidad/facturaCanalApi';
import type { CompraListaUnificada } from '@/lib/contabilidad/mapCanalPendienteCompra';

function compraPuedeAdjuntarFactura(c: CompraListaUnificada): boolean {
  return (
    c.origen === 'HISTORICO_TABLA' &&
    !c.document_storage_path &&
    !c.purchase_invoice_id &&
    !c.pendiente_canal_id
  );
}

type Props = {
  open: boolean;
  compra: CompraListaUnificada | null;
  onClose: () => void;
  onAdjuntado?: () => void;
};

export default function CompraFacturaImagenModal({
  open,
  compra,
  onClose,
  onAdjuntado,
}: Props) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open || !compra || typeof document === 'undefined') return null;

  const nro = compra.invoice_number?.trim();
  const titulo = nro ? `Factura ${nro.startsWith('#') ? nro : nro}` : 'Imagen de factura';
  const esRecepcion = compra.origen === 'RECEPCION_MERCANCIA' || compra.origen === 'TELEGRAM';

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="compras-factura-imagen-modal"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 80,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding:
          'max(12px, env(safe-area-inset-top)) max(12px, env(safe-area-inset-right)) max(12px, env(safe-area-inset-bottom)) max(12px, env(safe-area-inset-left))',
        background: 'rgba(0, 0, 0, 0.86)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          width: 'min(96vw, 1100px)',
          maxHeight: 'min(92dvh, 92vh)',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 16,
          border: '1px solid rgba(255,255,255,0.12)',
          background: '#121218',
          boxShadow: '0 24px 80px rgba(0,0,0,0.65)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 12,
            padding: '12px 14px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            flexShrink: 0,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <h2
              id={titleId}
              style={{
                margin: 0,
                fontSize: 15,
                fontWeight: 800,
                color: '#fff',
                lineHeight: 1.3,
              }}
            >
              {titulo}
            </h2>
            {compra.supplier_name ? (
              <p
                style={{
                  margin: '4px 0 0',
                  fontSize: 12,
                  color: 'rgba(255,255,255,0.5)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {compra.supplier_name}
              </p>
            ) : null}
            {esRecepcion ? (
              <p style={{ margin: '4px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
                Foto tomada en recepción de mercancía
              </p>
            ) : null}
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            style={{
              flexShrink: 0,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 36,
              height: 36,
              borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(255,255,255,0.06)',
              color: '#e4e4e7',
              cursor: 'pointer',
            }}
          >
            <X size={18} />
          </button>
        </div>

        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflow: 'auto',
            WebkitOverflowScrolling: 'touch',
            padding: 12,
          }}
        >
          <CompraFacturaAdjunto
            compraId={compra.id}
            documentApiPath={documentApiPathDesdeCompra(compra)}
            expanded
            variant="visor"
            tieneDocumento={Boolean(
              compra.document_storage_path || compra.purchase_invoice_id || compra.pendiente_canal_id,
            )}
            puedeAdjuntar={compraPuedeAdjuntarFactura(compra)}
            esRecepcion={esRecepcion}
            onAdjuntado={() => onAdjuntado?.()}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}
