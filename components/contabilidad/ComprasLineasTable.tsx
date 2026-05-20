'use client';

import type { CSSProperties } from 'react';
import type { FilaFacturaCanal } from '@/lib/contabilidad/filtrosFacturaCanal';

type Props = {
  filas: FilaFacturaCanal[];
  onScrollToCompra?: (compraId: string) => void;
};

export default function ComprasLineasTable({ filas, onScrollToCompra }: Props) {
  if (filas.length === 0) {
    return (
      <div
        style={{
          textAlign: 'center',
          padding: '32px',
          color: 'rgba(255,255,255,0.35)',
          borderRadius: '20px',
          border: '1px solid rgba(255,255,255,0.1)',
          background: 'rgba(28,28,30,0.5)',
        }}
      >
        <p style={{ fontSize: '15px', fontWeight: 700 }}>Sin líneas con estos filtros</p>
        <p style={{ fontSize: '13px', marginTop: '8px' }}>
          Amplía criterios o registra compras en recepción de mercancía.
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        overflowX: 'auto',
        borderRadius: '20px',
        border: '1px solid rgba(255,255,255,0.1)',
        background: 'rgba(28,28,30,0.5)',
      }}
    >
      <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.45)' }}>
            <th style={th}>Fecha</th>
            <th style={th}>Factura</th>
            <th style={th}>Proveedor</th>
            <th style={th}>RIF</th>
            <th style={th}>Proyecto</th>
            <th style={th}>Artículo</th>
            <th style={{ ...th, textAlign: 'right' }}>Cant.</th>
            <th style={{ ...th, textAlign: 'right' }}>P.U. Bs</th>
            <th style={{ ...th, textAlign: 'right' }}>Subtotal Bs</th>
            <th style={{ ...th, textAlign: 'right' }}>USD</th>
            <th style={th} />
          </tr>
        </thead>
        <tbody>
          {filas.map((row, i) => {
            const subtotalBs = row.esLinea
              ? row.cantidad * row.precioUnitario
              : row.montoBs;
            const usd =
              row.montoUsd != null && row.montoUsd > 0 && !row.esLinea
                ? row.montoUsd
                : row.montoBs > 0 && row.montoUsd != null && row.montoUsd > 0
                  ? (subtotalBs / row.montoBs) * row.montoUsd
                  : null;

            return (
              <tr
                key={`${row.pendienteId}-${i}`}
                style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
              >
                <td style={td}>{row.fecha || '—'}</td>
                <td style={{ ...td, fontFamily: 'monospace' }}>{row.factura || '—'}</td>
                <td style={{ ...td, maxWidth: 140 }}>{row.proveedor}</td>
                <td style={{ ...td, color: 'rgba(255,255,255,0.5)' }}>{row.rif}</td>
                <td style={{ ...td, maxWidth: 120, color: '#5856D6', fontWeight: 700 }}>
                  {row.chat_label ?? '—'}
                </td>
                <td style={{ ...td, maxWidth: 180 }}>
                  {row.esLinea ? row.articulo : <span style={{ opacity: 0.4 }}>(cabecera)</span>}
                </td>
                <td style={{ ...td, textAlign: 'right' }}>{row.esLinea ? row.cantidad : '—'}</td>
                <td style={{ ...td, textAlign: 'right' }}>
                  {row.esLinea ? row.precioUnitario.toLocaleString('es-VE') : '—'}
                </td>
                <td style={{ ...td, textAlign: 'right', fontWeight: 800 }}>
                  {subtotalBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                </td>
                <td style={{ ...td, textAlign: 'right', color: '#FF3B30', fontWeight: 700 }}>
                  {usd != null ? `$${usd.toFixed(2)}` : '—'}
                </td>
                <td style={td}>
                  {onScrollToCompra ? (
                    <button
                      type="button"
                      onClick={() => onScrollToCompra(row.pendienteId)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#5856D6',
                        fontSize: '11px',
                        fontWeight: 800,
                        cursor: 'pointer',
                      }}
                    >
                      Ver factura
                    </button>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const th: CSSProperties = {
  padding: '10px 12px',
  textAlign: 'left',
  fontWeight: 800,
  fontSize: '10px',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  whiteSpace: 'nowrap',
};

const td: CSSProperties = {
  padding: '10px 12px',
  color: 'white',
  verticalAlign: 'top',
};
