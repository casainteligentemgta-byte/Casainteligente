'use client';

import type { CSSProperties } from 'react';
import { formatearBs, formatearTasaBcv, formatearUsd } from '@/lib/contabilidad/comprasMontos';

type Props = {
  usd: number | null;
  bs: number;
  tasa?: number | null;
  /** Si la tasa no viene de la factura sino del BCV del día. */
  tasaEsDelDia?: boolean;
  layout?: 'stack' | 'inline';
  style?: CSSProperties;
  className?: string;
};

export default function EtiquetaBimonetariaCompra({
  usd,
  bs,
  tasa,
  tasaEsDelDia = false,
  layout = 'stack',
  style,
  className = '',
}: Props) {
  const wrap: CSSProperties =
    layout === 'stack'
      ? {
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'inherit',
          gap: 2,
          lineHeight: 1.35,
          ...style,
        }
      : {
          display: 'inline-flex',
          flexWrap: 'wrap',
          alignItems: 'baseline',
          gap: 6,
          lineHeight: 1.35,
          ...style,
        };

  const tasaVal = tasa != null && tasa > 0 ? tasa : null;

  return (
    <span className={className} style={wrap}>
      {usd != null && Number.isFinite(usd) ? (
        <span style={{ color: '#FF3B30', fontWeight: 800, fontSize: 'inherit' }}>{formatearUsd(usd)}</span>
      ) : null}
      <span style={{ color: '#FFD60A', fontWeight: 700, fontSize: 'inherit' }}>{formatearBs(bs)}</span>
      {tasaVal != null ? (
        <span
          style={{
            color: 'rgba(255,255,255,0.45)',
            fontWeight: 700,
            fontSize: layout === 'stack' ? 9 : 10,
          }}
        >
          {formatearTasaBcv(tasaVal)}
          {tasaEsDelDia ? ' (día)' : ''}
        </span>
      ) : null}
    </span>
  );
}
