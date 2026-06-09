'use client';

import { useMemo } from 'react';
import type { CSSProperties } from 'react';
import { CalendarClock, Loader2, Pencil, Trash2 } from 'lucide-react';
import {
  claseBlinkFechaCompra,
  etiquetaFechaAnomalaCorta,
  metaAlertaFechaCompra,
} from '@/lib/contabilidad/auditoriaFechaCompra';
import { etiquetaAlmacenIngresoCompra } from '@/lib/contabilidad/etiquetaAlmacenCompra';
import type { FilaFacturaCanal } from '@/lib/contabilidad/filtrosFacturaCanal';
import type { ColumnaOrdenCompras, DireccionOrden } from '@/lib/contabilidad/ordenarLineasCompras';
import {
  formatearBs,
  formatearTasaBcv,
  formatearUsd,
} from '@/lib/contabilidad/comprasMontos';
import {
  esLineaCompraUsd,
  formatearPrecioUnitarioLineaCompra,
  subtotalBsLineaCompra,
  subtotalUsdLineaCompra,
} from '@/lib/contabilidad/monedaCompra';

export type AccionesCompraLinea = {
  puedeModificar: boolean;
  /** Editar una línea concreta en contabilidad (UUID). */
  puedeModificarLinea?: boolean;
  etiquetaEliminar: string;
  /** Si false, no se puede borrar línea (p. ej. pendiente Telegram sin id). */
  puedeEliminarLinea?: boolean;
};

type Props = {
  filas: FilaFacturaCanal[];
  onScrollToCompra?: (compraId: string) => void;
  accionesPorCompra?: (compraId: string) => AccionesCompraLinea | null;
  onModificar?: (compraId: string) => void;
  onModificarLinea?: (row: FilaFacturaCanal) => void;
  onVerificarFecha?: (row: FilaFacturaCanal) => void;
  onEliminar?: (compraId: string) => void;
  onEliminarLinea?: (compraId: string, lineaId: string) => void;
  deletingId?: string | null;
  deletingLineaId?: string | null;
  sortColumn?: ColumnaOrdenCompras | null;
  sortDir?: DireccionOrden;
  onSort?: (column: ColumnaOrdenCompras) => void;
  /** Sin rowSpan cuando el orden no agrupa por factura. */
  ordenPlano?: boolean;
  /** Selección por factura (vista agrupada). */
  selectedIds?: Set<string>;
  onToggleCompra?: (compraId: string) => void;
  onToggleSelectAll?: () => void;
  todasSeleccionadas?: boolean;
  selectAllIndeterminate?: boolean;
  /** Selección línea a línea (vista por artículo). */
  modoSeleccionLinea?: boolean;
  selectedLineaIds?: Set<string>;
  onToggleLinea?: (lineaId: string) => void;
  onToggleSelectAllLineas?: () => void;
  todasLineasSeleccionadas?: boolean;
  lineasSelectIndeterminate?: boolean;
};

function esFilaAcciones(filas: FilaFacturaCanal[], row: FilaFacturaCanal, index: number): boolean {
  if (!row.esLinea) return true;
  const first = filas.findIndex((f) => f.pendienteId === row.pendienteId);
  return first === index;
}

export default function ComprasLineasTable({
  filas,
  onScrollToCompra,
  accionesPorCompra,
  onModificar,
  onModificarLinea,
  onVerificarFecha,
  onEliminar,
  onEliminarLinea,
  deletingId = null,
  deletingLineaId = null,
  sortColumn = null,
  sortDir = 'asc',
  onSort,
  ordenPlano = false,
  selectedIds,
  onToggleCompra,
  onToggleSelectAll,
  todasSeleccionadas = false,
  selectAllIndeterminate = false,
  modoSeleccionLinea = false,
  selectedLineaIds,
  onToggleLinea,
  onToggleSelectAllLineas,
  todasLineasSeleccionadas = false,
  lineasSelectIndeterminate = false,
}: Props) {
  const muestraAcciones = Boolean(onEliminar || onEliminarLinea || onModificar || onModificarLinea);
  const eliminarPorLinea = Boolean(onEliminarLinea);
  const muestraSeleccionFactura = Boolean(onToggleCompra) && !modoSeleccionLinea;
  const muestraSeleccionLinea = Boolean(modoSeleccionLinea && onToggleLinea);

  const lineasSeleccionables = useMemo(
    () => filas.filter((f) => f.esLinea && f.lineaId).map((f) => f.lineaId!),
    [filas],
  );

  const filasPorFactura = useMemo(() => {
    const m = new Map<string, number>();
    for (const f of filas) {
      m.set(f.pendienteId, (m.get(f.pendienteId) ?? 0) + 1);
    }
    return m;
  }, [filas]);

  function SortTh({
    col,
    label,
    align = 'left',
  }: {
    col: ColumnaOrdenCompras;
    label: string;
    align?: 'left' | 'right';
  }) {
    const active = sortColumn === col;
    const arrow = active ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '';
    if (!onSort) {
      return (
        <th style={{ ...th, textAlign: align }}>
          {label}
        </th>
      );
    }
    return (
      <th style={{ ...th, textAlign: align }}>
        <button
          type="button"
          onClick={() => onSort(col)}
          title={`Ordenar por ${label}`}
          style={{
            background: 'none',
            border: 'none',
            color: active ? '#a5b4fc' : 'inherit',
            font: 'inherit',
            fontWeight: 800,
            cursor: 'pointer',
            padding: 0,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            whiteSpace: 'nowrap',
          }}
        >
          {label}
          {arrow}
        </button>
      </th>
    );
  }

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
    <div className="compras-lineas-table-wrap">
      <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.45)' }}>
            {muestraSeleccionFactura || muestraSeleccionLinea ? (
              <th style={{ ...th, width: 36, padding: '10px 8px' }}>
                {muestraSeleccionLinea ? (
                  <input
                    type="checkbox"
                    checked={todasLineasSeleccionadas}
                    ref={(el) => {
                      if (el) el.indeterminate = lineasSelectIndeterminate;
                    }}
                    onChange={() => onToggleSelectAllLineas?.()}
                    disabled={lineasSeleccionables.length === 0}
                    aria-label="Seleccionar todas las líneas"
                    style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#5856D6' }}
                  />
                ) : (
                  <input
                    type="checkbox"
                    checked={todasSeleccionadas}
                    ref={(el) => {
                      if (el) el.indeterminate = selectAllIndeterminate;
                    }}
                    onChange={() => onToggleSelectAll?.()}
                    aria-label="Seleccionar todas las facturas"
                    style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#5856D6' }}
                  />
                )}
              </th>
            ) : null}
            <SortTh col="fecha" label="Fecha" />
            <SortTh col="factura" label="Factura" />
            <SortTh col="proveedor" label="Proveedor" />
            <SortTh col="rif" label="RIF" />
            <th style={th}>Entidad</th>
            <th style={th}>Proyecto</th>
            <th style={th}>Almacén</th>
            <SortTh col="articulo" label="Artículo" />
            <SortTh col="cantidad" label="Cant." align="right" />
            <SortTh col="precioUnitario" label="P.U." align="right" />
            <SortTh col="subtotalBs" label="Subtotal (Bs)" align="right" />
            <SortTh col="usd" label="USD" align="right" />
            <SortTh col="tasaBcv" label="Tasa BCV" align="right" />
            <th style={th}>Ver imagen</th>
            {muestraAcciones ? <th style={th}>Acciones</th> : null}
          </tr>
        </thead>
        <tbody>
          {filas.map((row, i) => {
            const subtotalBs = subtotalBsLineaCompra(row);
            const usd = subtotalUsdLineaCompra(row);
            const mostrarAccionesFactura =
              muestraAcciones && !eliminarPorLinea && esFilaAcciones(filas, row, i);
            const mostrarAccionesEnFila =
              mostrarAccionesFactura ||
              (eliminarPorLinea && row.esLinea && Boolean(row.lineaId)) ||
              (onModificarLinea && row.esLinea && Boolean(row.lineaId)) ||
              (eliminarPorLinea && onModificar && esFilaAcciones(filas, row, i));
            const acc =
              mostrarAccionesEnFila && accionesPorCompra
                ? accionesPorCompra(row.pendienteId)
                : null;
            const metaFecha = metaAlertaFechaCompra({
              fecha: row.fecha,
              alertaAlmacenada: row.alertaFecha,
              fechaConfirmadaManual: row.fechaConfirmadaManual,
            });
            const rowSpan = ordenPlano
              ? 1
              : mostrarAccionesFactura
                ? (filasPorFactura.get(row.pendienteId) ?? 1)
                : 1;

            const seleccionadaFactura = selectedIds?.has(row.pendienteId) ?? false;
            const seleccionadaLinea = row.lineaId
              ? (selectedLineaIds?.has(row.lineaId) ?? false)
              : false;
            const filaResaltada = modoSeleccionLinea ? seleccionadaLinea : seleccionadaFactura;

            return (
              <tr
                key={`${row.pendienteId}-${i}`}
                style={{
                  borderTop: '1px solid rgba(255,255,255,0.06)',
                  background: filaResaltada ? 'rgba(88,86,214,0.08)' : undefined,
                }}
              >
                {muestraSeleccionFactura ? (
                  muestraAcciones ? (
                    <td style={{ ...td, verticalAlign: 'top' }} rowSpan={rowSpan}>
                      <input
                        type="checkbox"
                        checked={seleccionadaFactura}
                        onChange={() => onToggleCompra?.(row.pendienteId)}
                        aria-label={`Seleccionar factura ${row.factura || row.proveedor}`}
                        style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#5856D6' }}
                      />
                    </td>
                  ) : ordenPlano ? (
                    <td style={td}>
                      <input
                        type="checkbox"
                        checked={seleccionadaFactura}
                        onChange={() => onToggleCompra?.(row.pendienteId)}
                        aria-label={`Seleccionar factura ${row.factura || row.proveedor}`}
                        style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#5856D6' }}
                      />
                    </td>
                  ) : null
                ) : null}
                {muestraSeleccionLinea ? (
                  <td style={td}>
                    {row.esLinea && row.lineaId ? (
                      <input
                        type="checkbox"
                        checked={seleccionadaLinea}
                        onChange={() => onToggleLinea?.(row.lineaId!)}
                        aria-label={`Seleccionar línea ${row.articulo}`}
                        style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#5856D6' }}
                      />
                    ) : null}
                  </td>
                ) : null}
                <td style={td}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
                    <span>{row.fecha || '—'}</span>
                    {metaFecha.nivel === 'ok' ? null : metaFecha.requiereVerificacion ? (
                      <button
                        type="button"
                        className={claseBlinkFechaCompra(metaFecha.nivel) ?? undefined}
                        onClick={() => onVerificarFecha?.(row)}
                        title={metaFecha.mensaje}
                        style={
                          metaFecha.nivel === 'advertencia' ? btnFechaAdvertencia : btnFechaCritica
                        }
                      >
                        <CalendarClock size={11} />
                        {etiquetaFechaAnomalaCorta(metaFecha.nivel)}
                      </button>
                    ) : metaFecha.verificada ? (
                      <span style={badgeFechaVerificada} title="Fecha fiscal verificada manualmente">
                        ✓ fecha verificada
                      </span>
                    ) : null}
                  </div>
                </td>
                <td style={{ ...td, fontFamily: 'monospace' }}>{row.factura || '—'}</td>
                <td style={{ ...td, maxWidth: 140 }}>{row.proveedor}</td>
                <td style={{ ...td, color: 'rgba(255,255,255,0.5)' }}>{row.rif}</td>
                <td style={{ ...td, maxWidth: 120, color: 'rgba(255,255,255,0.55)' }}>
                  {row.entidad || '—'}
                </td>
                <td style={{ ...td, maxWidth: 120, color: 'rgba(255,255,255,0.55)' }}>
                  {row.proyecto || '—'}
                </td>
                <td style={{ ...td, maxWidth: 130 }}>
                  {(() => {
                    const { texto, pendienteIngreso } = etiquetaAlmacenIngresoCompra({
                      ubicacionNombre: row.almacen,
                      proyectoNombre: row.proyecto,
                    });
                    return (
                      <span
                        style={{
                          color: pendienteIngreso ? 'rgba(251,191,36,0.85)' : '#fdba74',
                          fontStyle: pendienteIngreso ? 'italic' : undefined,
                          fontWeight: pendienteIngreso ? 600 : undefined,
                        }}
                        title={
                          pendienteIngreso
                            ? 'Registrada en contabilidad; almacén se asigna al ingresar el material'
                            : undefined
                        }
                      >
                        {texto}
                      </span>
                    );
                  })()}
                </td>
                <td style={{ ...td, maxWidth: 180 }}>
                  {row.esLinea ? row.articulo : <span style={{ opacity: 0.4 }}>(cabecera)</span>}
                </td>
                <td style={{ ...td, textAlign: 'right' }}>{row.esLinea ? row.cantidad : '—'}</td>
                <td
                  style={{
                    ...td,
                    textAlign: 'right',
                    color: row.esLinea && esLineaCompraUsd(row) ? '#FF3B30' : '#FFD60A',
                    fontWeight: 700,
                  }}
                >
                  {row.esLinea ? formatearPrecioUnitarioLineaCompra(row) ?? '—' : '—'}
                </td>
                <td style={{ ...td, textAlign: 'right', fontWeight: 800 }}>
                  {formatearBs(subtotalBs)}
                </td>
                <td style={{ ...td, textAlign: 'right', color: '#FF3B30', fontWeight: 700 }}>
                  {usd != null ? formatearUsd(usd) : '—'}
                </td>
                <td
                  style={{
                    ...td,
                    textAlign: 'right',
                    color: 'rgba(255,255,255,0.55)',
                    fontWeight: 700,
                    fontVariantNumeric: 'tabular-nums',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {row.tasaBcv != null && row.tasaBcv > 0
                    ? formatearTasaBcv(row.tasaBcv)
                    : '—'}
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
                      Ver imagen
                    </button>
                  ) : null}
                </td>
                {muestraAcciones ? (
                  mostrarAccionesEnFila ? (
                    <td
                      style={{ ...td, verticalAlign: 'top' }}
                      rowSpan={mostrarAccionesFactura ? rowSpan : 1}
                    >
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px',
                          minWidth: '108px',
                        }}
                      >
                        {onVerificarFecha &&
                        esFilaAcciones(filas, row, i) &&
                        metaFecha.requiereVerificacion &&
                        !row.pendienteId.startsWith('canal-') ? (
                          <button
                            type="button"
                            className={claseBlinkFechaCompra(metaFecha.nivel) ?? undefined}
                            onClick={() => onVerificarFecha(row)}
                            disabled={deletingId !== null || deletingLineaId !== null}
                            style={
                              metaFecha.nivel === 'advertencia'
                                ? btnVerificarFechaAdvertencia
                                : btnVerificarFecha
                            }
                          >
                            <CalendarClock size={12} />
                            Verificar fecha
                          </button>
                        ) : null}
                        {acc?.puedeModificar && onModificar && esFilaAcciones(filas, row, i) ? (
                          <button
                            type="button"
                            onClick={() => onModificar(row.pendienteId)}
                            disabled={deletingId !== null || deletingLineaId !== null}
                            style={btnModificar}
                          >
                            <Pencil size={12} />
                            Modificar factura
                          </button>
                        ) : null}
                        {acc?.puedeModificarLinea &&
                        onModificarLinea &&
                        row.esLinea &&
                        row.lineaId ? (
                          <button
                            type="button"
                            onClick={() => onModificarLinea(row)}
                            disabled={deletingId !== null || deletingLineaId !== null}
                            style={btnModificar}
                          >
                            <Pencil size={12} />
                            Modificar línea
                          </button>
                        ) : null}
                        {eliminarPorLinea &&
                        row.esLinea &&
                        row.lineaId &&
                        acc?.puedeEliminarLinea !== false ? (
                          <button
                            type="button"
                            onClick={() => onEliminarLinea?.(row.pendienteId, row.lineaId!)}
                            disabled={deletingId !== null || deletingLineaId !== null}
                            style={{
                              ...btnEliminar,
                              opacity:
                                deletingLineaId === row.lineaId || deletingId !== null ? 0.6 : 1,
                            }}
                          >
                            {deletingLineaId === row.lineaId ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <Trash2 size={12} />
                            )}
                            Borrar línea
                          </button>
                        ) : null}
                        {mostrarAccionesFactura && onEliminar ? (
                          <button
                            type="button"
                            onClick={() => onEliminar(row.pendienteId)}
                            disabled={deletingId !== null || deletingLineaId !== null}
                            style={{
                              ...btnEliminar,
                              opacity: deletingId === row.pendienteId ? 0.6 : 1,
                            }}
                          >
                            {deletingId === row.pendienteId ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <Trash2 size={12} />
                            )}
                            {acc?.etiquetaEliminar ?? 'Eliminar'}
                          </button>
                        ) : null}
                      </div>
                    </td>
                  ) : null
                ) : null}
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

const btnModificar: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px',
  padding: '6px 10px',
  borderRadius: '8px',
  border: '1px solid rgba(56,189,248,0.45)',
  background: 'rgba(14,116,144,0.35)',
  color: '#7dd3fc',
  fontSize: '10px',
  fontWeight: 800,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

const btnFechaAdvertencia: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '3px 8px',
  borderRadius: 8,
  border: '1px solid rgba(255,149,0,0.55)',
  background: 'rgba(255,149,0,0.18)',
  color: '#FFC56D',
  fontSize: 9,
  fontWeight: 800,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

const btnFechaCritica: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '3px 8px',
  borderRadius: 8,
  border: '1px solid rgba(255,59,48,0.55)',
  background: 'rgba(255,59,48,0.18)',
  color: '#FF8A85',
  fontSize: 9,
  fontWeight: 800,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

const btnVerificarFecha: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '6px 10px',
  borderRadius: 8,
  border: '1px solid rgba(255,59,48,0.55)',
  background: 'rgba(255,59,48,0.2)',
  color: '#FF8A85',
  fontSize: 10,
  fontWeight: 800,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

const btnVerificarFechaAdvertencia: CSSProperties = {
  ...btnVerificarFecha,
  border: '1px solid rgba(255,149,0,0.55)',
  background: 'rgba(255,149,0,0.2)',
  color: '#FFC56D',
};

const badgeFechaVerificada: CSSProperties = {
  fontSize: 9,
  fontWeight: 700,
  color: '#86efac',
  whiteSpace: 'nowrap',
};

const btnEliminar: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px',
  padding: '6px 10px',
  borderRadius: '8px',
  border: '1px solid rgba(255,59,48,0.4)',
  background: 'rgba(255,59,48,0.15)',
  color: '#FF6B6B',
  fontSize: '10px',
  fontWeight: 800,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};
