'use client';

import { useCallback, useState } from 'react';
import { ChevronDown, ChevronUp, Loader2, Package } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export type LineaProductoCompra = {
  descripcion: string;
  item_code: string | null;
  subtotal: number;
  cantidad: number;
  unidad: string | null;
  precio_unitario: number | null;
};

type Props = {
  compraId: string;
  lineasIniciales?: LineaProductoCompra[];
  lineCountHint?: number;
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

export default function CompraProductosToggle({ compraId, lineasIniciales, lineCountHint = 0 }: Props) {
  const [abierto, setAbierto] = useState(false);
  const [lineas, setLineas] = useState<LineaProductoCompra[]>(lineasIniciales ?? []);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalLineas = lineas.length || lineCountHint;

  const cargarLineas = useCallback(async () => {
    if (lineas.length > 0) return;
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
      setLineas((data ?? []).map((r) => mapLinea(r as Record<string, unknown>)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar los productos');
    } finally {
      setCargando(false);
    }
  }, [compraId, lineas.length]);

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
          ) : lineas.length === 0 ? (
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
                      P. unit.
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
                  {lineas.map((l, i) => (
                    <tr
                      key={`${l.descripcion}-${i}`}
                      style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
                    >
                      <td style={{ padding: '10px 12px', color: 'rgba(255,255,255,0.88)' }}>
                        <span style={{ fontWeight: 700 }}>{l.descripcion || '—'}</span>
                        {l.item_code ? (
                          <span style={{ display: 'block', color: 'rgba(255,255,255,0.4)', fontSize: '10px' }}>
                            Ref: {l.item_code}
                          </span>
                        ) : null}
                      </td>
                      <td style={{ padding: '10px 8px', color: 'rgba(255,255,255,0.65)' }}>
                        {l.cantidad} {l.unidad || 'UND'}
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'right', color: 'rgba(255,255,255,0.55)' }}>
                        ${(l.precio_unitario ?? 0).toFixed(2)}
                      </td>
                      <td
                        style={{
                          padding: '10px 12px',
                          textAlign: 'right',
                          fontWeight: 800,
                          color: '#FFD60A',
                        }}
                      >
                        ${l.subtotal.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
