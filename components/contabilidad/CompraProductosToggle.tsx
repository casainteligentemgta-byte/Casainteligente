'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Loader2, Package } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import EtiquetaBimonetariaCompra from '@/components/contabilidad/EtiquetaBimonetariaCompra';
import { normalizarMonedaExtracted } from '@/lib/contabilidad/extractedCanal';
import { recalcularPreciosLineasCompra } from '@/lib/contabilidad/filtrosFacturaCanal';
import {
  esLineaCompraUsd,
  formatearPrecioUnitarioLineaCompra,
} from '@/lib/contabilidad/monedaCompra';
import { formatearBs, formatearUsd } from '@/lib/contabilidad/comprasMontos';
import { esDescripcionAuditoriaCco } from '@/lib/contabilidad/compraEsAuditoriaCco';
import type { MonedaOrigen } from '@/lib/finanzas/currency-converter';

export type LineaProductoCompra = {
  descripcion: string;
  item_code: string | null;
  subtotal: number;
  cantidad: number;
  unidad: string | null;
  precio_unitario: number | null;
};

type FilaMonedaCompra = {
  total_amount: number;
  total_amount_usd?: number | null;
  tasa_bcv_ves_por_usd?: number | null;
  moneda?: string | null;
  moneda_original?: string | null;
  monto_ves?: number | null;
  monto_usd?: number | null;
};

type LineaProductoVista = LineaProductoCompra & {
  subtotalBs: number;
  subtotalUsd: number | null;
};

type Props = {
  compraId: string;
  lineasIniciales?: LineaProductoCompra[];
  lineCountHint?: number;
  /** Tasa BCV de la factura (Bs por 1 USD) para mostrar equivalentes en dólares. */
  tasaBcv?: number | null;
  /** Totales bimonetarios de cabecera (coherentes con moneda original). */
  montoBsFactura?: number;
  montoUsdFactura?: number | null;
  tasaEsDelDia?: boolean;
  monedaOriginal?: MonedaOrigen | string | null;
  filaMoneda?: FilaMonedaCompra;
};

function mapLinea(raw: Record<string, unknown>): LineaProductoCompra {
  const cantidad = Number(raw.cantidad) || 0;
  const subtotal = Number(raw.subtotal) || 0;
  const precio = raw.precio_unitario != null ? Number(raw.precio_unitario) : null;
  return {
    descripcion: String(raw.descripcion ?? ''),
    item_code: raw.item_code != null ? String(raw.item_code) : null,
    subtotal,
    cantidad,
    unidad: raw.unidad != null ? String(raw.unidad) : null,
    precio_unitario: precio ?? (cantidad > 0 ? subtotal / cantidad : null),
  };
}

export function lineasFromNested(
  nested: LineaProductoCompra[] | { count: number }[] | undefined
): LineaProductoCompra[] {
  if (!Array.isArray(nested) || !nested.length) return [];
  const first = nested[0];
  if (first && 'descripcion' in first) return nested as LineaProductoCompra[];
  return [];
}

function lineasConMontosCoherentes(
  src: LineaProductoCompra[],
  filaMoneda: FilaMonedaCompra | undefined,
  tasaBcv: number | null | undefined,
): LineaProductoVista[] {
  if (!src.length) return [];
  if (!filaMoneda) {
    return src.map((l) => ({
      ...l,
      subtotalBs: Number(l.subtotal) || 0,
      subtotalUsd: null,
    }));
  }
  const recalc = recalcularPreciosLineasCompra(filaMoneda, src, tasaBcv);
  return src.map((l, i) => {
    const r = recalc[i];
    return {
      ...l,
      precio_unitario: r?.precio_unitario ?? l.precio_unitario,
      subtotal: r?.subtotal ?? l.subtotal,
      subtotalBs: r?.subtotalBs ?? (Number(l.subtotal) || 0),
      subtotalUsd: r?.subtotalUsd ?? null,
    };
  });
}

export default function CompraProductosToggle({
  compraId,
  lineasIniciales,
  lineCountHint = 0,
  tasaBcv,
  montoBsFactura = 0,
  montoUsdFactura = null,
  tasaEsDelDia = false,
  monedaOriginal,
  filaMoneda,
}: Props) {
  const [abierto, setAbierto] = useState(false);
  const [lineas, setLineas] = useState<LineaProductoCompra[]>(lineasIniciales ?? []);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const moneda = normalizarMonedaExtracted(monedaOriginal ?? filaMoneda?.moneda_original ?? filaMoneda?.moneda);
  const esUsd = moneda === 'USD';

  useEffect(() => {
    setLineas(
      (lineasIniciales ?? []).filter((l) => !esDescripcionAuditoriaCco(l.descripcion)),
    );
    setAbierto(false);
    setError(null);
  }, [compraId, moneda, lineasIniciales]);

  useEffect(() => {
    if (!abierto) {
      setLineas(
        (lineasIniciales ?? []).filter((l) => !esDescripcionAuditoriaCco(l.descripcion)),
      );
    }
  }, [lineasIniciales, abierto]);

  const totalLineas = lineas.length || lineCountHint || (lineasIniciales?.length ?? 0);

  const montosBoton = useMemo(
    () => ({
      usd: montoUsdFactura,
      bs: montoBsFactura,
    }),
    [montoBsFactura, montoUsdFactura],
  );

  const lineasVista = useMemo(() => {
    const src = (lineas.length > 0 ? lineas : (lineasIniciales ?? [])).filter(
      (l) => !esDescripcionAuditoriaCco(l.descripcion),
    );
    return lineasConMontosCoherentes(src, filaMoneda, tasaBcv);
  }, [lineas, lineasIniciales, filaMoneda, tasaBcv]);

  const cargarLineas = useCallback(async () => {
    if (lineas.length > 0) return;
    const iniciales = (lineasIniciales ?? []).filter(
      (l) => !esDescripcionAuditoriaCco(l.descripcion),
    );
    if (iniciales.length > 0) {
      setLineas(iniciales);
      return;
    }
    if (compraId.startsWith('canal-')) return;
    setCargando(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data, error: qErr } = await supabase
        .from('contabilidad_compra_lineas')
        .select('descripcion,item_code,subtotal,cantidad,unidad,precio_unitario')
        .eq('compra_id', compraId)
        .order('created_at', { ascending: true });

      if (qErr) {
        setError(qErr.message);
        return;
      }
      setLineas(
        (data ?? [])
          .map((r) => mapLinea(r as Record<string, unknown>))
          .filter((l) => !esDescripcionAuditoriaCco(l.descripcion)),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar los productos');
    } finally {
      setCargando(false);
    }
  }, [compraId, lineas.length, lineasIniciales]);

  async function handleToggle() {
    const next = !abierto;
    setAbierto(next);
    if (next) await cargarLineas();
  }

  return (
    <div style={{ marginTop: '10px' }}>
      <button
        type="button"
        onClick={() => void handleToggle()}
        aria-expanded={abierto}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 14px',
          borderRadius: '10px',
          border: abierto ? '1px solid rgba(88,86,214,0.55)' : '1px solid rgba(255,255,255,0.14)',
          background: abierto ? 'rgba(88,86,214,0.22)' : 'rgba(255,255,255,0.06)',
          color: abierto ? '#fff' : 'rgba(255,255,255,0.85)',
          fontSize: '11px',
          fontWeight: 800,
          cursor: 'pointer',
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          flexWrap: 'wrap',
        }}
      >
        <Package size={15} strokeWidth={2.2} />
        Productos
        <span
          style={{
            minWidth: '20px',
            borderRadius: '999px',
            background: 'rgba(88,86,214,0.35)',
            padding: '2px 7px',
            fontSize: '10px',
            fontWeight: 800,
          }}
        >
          {totalLineas || '—'}
        </span>
        {(montosBoton.usd != null || montosBoton.bs > 0) && (
          <EtiquetaBimonetariaCompra
            usd={montosBoton.usd}
            bs={montosBoton.bs}
            tasa={tasaBcv}
            tasaEsDelDia={tasaEsDelDia}
            layout="inline"
            style={{ fontSize: 10, textTransform: 'none', letterSpacing: 0 }}
          />
        )}
        {abierto ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {abierto ? (
        <div
          style={{
            marginTop: '10px',
            borderRadius: '12px',
            border: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(0,0,0,0.35)',
            overflow: 'hidden',
          }}
        >
          {cargando ? (
            <p
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '14px',
                color: 'rgba(255,255,255,0.45)',
                fontSize: '12px',
              }}
            >
              <Loader2 size={16} className="animate-spin" />
              Cargando productos…
            </p>
          ) : error ? (
            <p style={{ padding: '14px', color: '#FF6B6B', fontSize: '12px', fontWeight: 600 }}>{error}</p>
          ) : lineasVista.length === 0 ? (
            <p style={{ padding: '14px', color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>
              Esta factura no tiene líneas de detalle registradas.
            </p>
          ) : (
            <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.04)', textAlign: 'left' }}>
                    <th style={{ padding: '10px 12px', color: 'rgba(255,255,255,0.4)', fontWeight: 700 }}>
                      Producto
                    </th>
                    <th style={{ padding: '10px 8px', color: 'rgba(255,255,255,0.4)', fontWeight: 700 }}>
                      Cant.
                    </th>
                    <th
                      style={{
                        padding: '10px 8px',
                        color: 'rgba(255,255,255,0.4)',
                        fontWeight: 700,
                        textAlign: 'right',
                      }}
                    >
                      {esUsd ? 'P. unit. (USD)' : 'P. unit. (Bs)'}
                    </th>
                    <th
                      style={{
                        padding: '10px 12px',
                        color: 'rgba(255,255,255,0.4)',
                        fontWeight: 700,
                        textAlign: 'right',
                      }}
                    >
                      Subtotal
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {lineasVista.map((l, i) => {
                    const precioFmt =
                      formatearPrecioUnitarioLineaCompra({
                        esLinea: true,
                        cantidad: l.cantidad,
                        precioUnitario: l.precio_unitario ?? 0,
                        montoBs: 0,
                        monedaOriginal: moneda,
                      }) ?? '—';

                    return (
                      <tr
                        key={`${l.descripcion}-${i}`}
                        style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
                      >
                        <td style={{ padding: '10px 12px', color: 'rgba(255,255,255,0.88)' }}>
                          <span style={{ fontWeight: 700 }}>{l.descripcion || '—'}</span>
                          {l.item_code ? (
                            <span
                              style={{ display: 'block', color: 'rgba(255,255,255,0.4)', fontSize: '10px' }}
                            >
                              Ref: {l.item_code}
                            </span>
                          ) : null}
                        </td>
                        <td style={{ padding: '10px 8px', color: 'rgba(255,255,255,0.65)' }}>
                          {l.cantidad} {l.unidad || 'UND'}
                        </td>
                        <td
                          style={{
                            padding: '10px 8px',
                            textAlign: 'right',
                            color: esLineaCompraUsd({ monedaOriginal: moneda }) ? '#FF3B30' : '#FFD60A',
                            fontWeight: 700,
                          }}
                        >
                          {precioFmt}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                          {esUsd ? (
                            <>
                              <span style={{ display: 'block', fontWeight: 800, color: '#FF3B30' }}>
                                {l.subtotalUsd != null ? formatearUsd(l.subtotalUsd) : formatearUsd(l.subtotal)}
                              </span>
                              <span
                                style={{
                                  display: 'block',
                                  fontSize: '10px',
                                  color: 'rgba(255,255,255,0.45)',
                                  marginTop: '2px',
                                }}
                              >
                                {formatearBs(l.subtotalBs)}
                              </span>
                            </>
                          ) : (
                            <>
                              <span style={{ display: 'block', fontWeight: 800, color: '#FF3B30' }}>
                                {l.subtotalUsd != null ? formatearUsd(l.subtotalUsd) : '—'}
                              </span>
                              <span
                                style={{
                                  display: 'block',
                                  fontSize: '10px',
                                  color: 'rgba(255,255,255,0.45)',
                                  marginTop: '2px',
                                }}
                              >
                                {formatearBs(l.subtotalBs)}
                              </span>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
