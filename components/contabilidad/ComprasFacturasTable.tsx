'use client';

import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import Link from 'next/link';
import {
  Banknote,
  CalendarClock,
  Loader2,
  MapPin,
  PackageCheck,
  Pencil,
  Trash2,
} from 'lucide-react';
import { etiquetaEstadoPagoCredito } from '@/lib/contabilidad/creditoPagos';
import { createClient } from '@/lib/supabase/client';
import {
  claseBlinkFechaCompra,
  etiquetaFechaAnomalaCorta,
  metaAlertaFechaCompra,
  type UmbralesFechaCompra,
} from '@/lib/contabilidad/auditoriaFechaCompra';
import {
  COMPRAS_FACTURAS_HEADERS_EXTRA,
  COMPRAS_FACTURAS_HEADERS_PRINCIPALES,
} from '@/lib/contabilidad/comprasFacturasColumnas';
import { formatearBs, formatearTasaBcv, formatearUsd, tasaBcvCompra } from '@/lib/contabilidad/comprasMontos';
import { etiquetaAlmacenIngresoCompra } from '@/lib/contabilidad/etiquetaAlmacenCompra';
import { etiquetaClasificacionGastoEntidad } from '@/lib/contabilidad/clasificacionGastoEntidad';
import {
  coloresEstadoLogistica,
  compraMuestraBotonConfirmacionRecepcion,
  etiquetaEstadoLogistica,
} from '@/lib/contabilidad/estadoLogisticaCompra';
import {
  compraTieneDetallePuenteInventario,
  lineasDetallePuenteInventario,
} from '@/lib/contabilidad/formatDetalleLogisticaCompra';
import { esGastoEntidadImputacion } from '@/lib/contabilidad/imputacionCompra';
import {
  etiquetaOrigenCompra,
  type CompraLineaUi,
  type CompraListaUnificada,
} from '@/lib/contabilidad/mapCanalPendienteCompra';
import {
  formatearPrecioUnitarioLineaCompra,
  monedaOriginalCompra,
  montosBimonetariosLista,
} from '@/lib/contabilidad/monedaCompra';
import {
  etiquetaProductoFactura,
  lineasProductoVisibles,
  resumenProductoFactura,
} from '@/lib/contabilidad/resumenProductoFactura';
import { etiquetaRifCompra } from '@/lib/contabilidad/rifVenezolano';
import { tooltipClienteCrmCompra } from '@/lib/clientes/tooltipClienteCrmCompra';
import type { MonedaOrigen } from '@/lib/finanzas/currency-converter';
import { normalizarMonedaExtracted } from '@/lib/contabilidad/extractedCanal';
import CompraProductosToggle from '@/components/contabilidad/CompraProductosToggle';
import ImputacionCompraToggle from '@/components/contabilidad/ImputacionCompraToggle';
import ClasificacionGastoEntidadSelect from '@/components/contabilidad/ClasificacionGastoEntidadSelect';

export type ReubicarCompraOpts = {
  id: string;
  entidadId?: string | null;
  proyectoId?: string | null;
  ubicacionId?: string | null;
  titulo?: string;
};

type Props = {
  compras: CompraListaUnificada[];
  umbralesFecha?: UmbralesFechaCompra;
  selectedIds: Set<string>;
  onToggleCompra: (compraId: string) => void;
  imagenFacturaAbierta: string | null;
  onToggleImagen: (compraId: string) => void;
  deletingId: string | null;
  deletingBulk?: boolean;
  ingresandoAlmacenId: string | null;
  cambiandoMonedaId: string | null;
  tasaDisplayCompra: (c: CompraListaUnificada) => number | null;
  onReubicar: (opts: ReubicarCompraOpts) => void;
  onIngresoAlmacen: (c: CompraListaUnificada) => void;
  onVerificarFecha: (c: CompraListaUnificada) => void;
  onModificar: (c: CompraListaUnificada) => void;
  onEliminar: (c: CompraListaUnificada) => void;
  onCambiarMoneda: (c: CompraListaUnificada, moneda: MonedaOrigen) => void;
  onReload: () => void;
  onMarcarPagado?: (c: CompraListaUnificada) => void;
};

function puedeReubicarCompra(c: CompraListaUnificada): boolean {
  return (
    c.fuente_lista === 'app' ||
    Boolean(c.purchase_invoice_id) ||
    Boolean(c.pendiente_canal_id) ||
    c.estado === 'REGISTRADA' ||
    c.canal_estado === 'confirmado' ||
    c.canal_estado === 'extraido'
  );
}

function compraPuedeVerImagen(c: CompraListaUnificada): boolean {
  return Boolean(
    c.document_storage_path ||
      c.purchase_invoice_id ||
      c.origen === 'RECEPCION_MERCANCIA' ||
      c.origen === 'TELEGRAM' ||
      c.origen === 'HISTORICO_TABLA' ||
      c.pendiente_canal_id,
  );
}

function lineasDetalle(row: CompraListaUnificada) {
  const nested = row.contabilidad_compra_lineas;
  if (!Array.isArray(nested) || !nested.length) return [];
  const first = nested[0];
  if (first && 'descripcion' in first) return nested;
  return [];
}

function lineCount(row: CompraListaUnificada): number {
  const det = lineasDetalle(row);
  if (det.length) return det.length;
  const nested = row.contabilidad_compra_lineas;
  if (Array.isArray(nested) && nested[0] && 'count' in nested[0] && typeof nested[0].count === 'number') {
    return nested[0].count;
  }
  return 0;
}

function lineasParaProductosToggle(row: CompraListaUnificada) {
  return lineasProductoVisibles(lineasDetalle(row))
    .map((l) => ({
      descripcion: l.descripcion,
      item_code: l.item_code,
      subtotal: l.subtotal,
      cantidad: l.cantidad,
      unidad: null,
      precio_unitario: l.precio_unitario ?? (l.cantidad > 0 ? l.subtotal / l.cantidad : null),
    }));
}

const COLSPAN =
  1 + COMPRAS_FACTURAS_HEADERS_PRINCIPALES.length + COMPRAS_FACTURAS_HEADERS_EXTRA.length;

export default function ComprasFacturasTable({
  compras,
  umbralesFecha,
  selectedIds,
  onToggleCompra,
  imagenFacturaAbierta,
  onToggleImagen,
  deletingId,
  deletingBulk = false,
  ingresandoAlmacenId,
  cambiandoMonedaId,
  tasaDisplayCompra,
  onReubicar,
  onIngresoAlmacen,
  onVerificarFecha,
  onModificar,
  onEliminar,
  onCambiarMoneda,
  onReload,
  onMarcarPagado,
}: Props) {
  if (compras.length === 0) {
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
        <p style={{ fontSize: '15px', fontWeight: 700 }}>Sin facturas con estos filtros</p>
      </div>
    );
  }

  return (
    <div className="compras-lineas-table-wrap compras-facturas-table-wrap">
      <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.45)' }}>
            <th style={{ ...th, width: 36, padding: '10px 8px' }} />
            {COMPRAS_FACTURAS_HEADERS_PRINCIPALES.map((label) => (
              <th
                key={label}
                className={esNowrapHeader(label) ? 'whitespace-nowrap' : undefined}
                style={{
                  ...th,
                  textAlign: esMontoHeader(label) ? 'right' : 'left',
                  ...(esNowrapHeader(label) ? minWidthHeader(label) : {}),
                }}
              >
                {label}
              </th>
            ))}
            {COMPRAS_FACTURAS_HEADERS_EXTRA.map((label) => (
              <th
                key={label}
                className={esNowrapHeader(label) ? 'whitespace-nowrap' : undefined}
                style={{
                  ...th,
                  textAlign: esMontoHeader(label) ? 'right' : 'left',
                  ...(esNowrapHeader(label) ? minWidthHeader(label) : {}),
                }}
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {compras.map((c) => {
            const seleccionada = selectedIds.has(c.id);
            const tasaDisp = tasaDisplayCompra(c);
            const montos = montosBimonetariosLista(c, tasaDisp);
            const metaFecha = metaAlertaFechaCompra({
              fecha: String(c.fecha ?? '').slice(0, 10),
              alertaAlmacenada: c.alerta_fecha,
              fechaConfirmadaManual: c.fecha_confirmada_manual,
              umbrales: umbralesFecha,
            });
            const almacen = etiquetaAlmacenIngresoCompra({
              ubicacionNombre: c.ubicacion_nombre,
              ubicacionDestinoId: c.ubicacion_destino_id,
              proyectoNombre: c.proyecto_nombre,
              imputacionEntidad: esGastoEntidadImputacion(c.imputacion),
              yaIngresadoAlmacen: Boolean(c.ingresado_almacen_at || c.compra_factura_id),
              estadoLogistica: c.estado_logistica,
            });
            const puedeImagen = compraPuedeVerImagen(c);
            const imagenAbierta = imagenFacturaAbierta === c.id;
            const bloqueado = deletingId !== null || deletingBulk;

            return (
              <FilaFactura
                key={c.id}
                c={c}
                seleccionada={seleccionada}
                onToggleCompra={onToggleCompra}
                metaFecha={metaFecha}
                montos={montos}
                tasaDisp={tasaDisp}
                almacen={almacen}
                puedeImagen={puedeImagen}
                imagenAbierta={imagenAbierta}
                onToggleImagen={onToggleImagen}
                bloqueado={bloqueado}
                deletingId={deletingId}
                ingresandoAlmacenId={ingresandoAlmacenId}
                cambiandoMonedaId={cambiandoMonedaId}
                onReubicar={onReubicar}
                onIngresoAlmacen={onIngresoAlmacen}
                onVerificarFecha={onVerificarFecha}
                onModificar={onModificar}
                onEliminar={onEliminar}
                onCambiarMoneda={onCambiarMoneda}
                onReload={onReload}
                onMarcarPagado={onMarcarPagado}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function esMontoHeader(label: string): boolean {
  return label === 'Total (Bs)' || label === 'USD' || label === 'Tasa BCV';
}

function esNowrapHeader(label: string): boolean {
  return (
    label === 'Fecha' ||
    label === 'Proveedor' ||
    label === 'RIF' ||
    label === 'Producto' ||
    label === 'Total (Bs)' ||
    label === 'USD' ||
    label === 'Entidad' ||
    label === 'Almacén' ||
    label === 'Tasa BCV' ||
    label === 'Días crédito' ||
    label === 'Vencimiento' ||
    label === 'Pago' ||
    label === 'Acciones'
  );
}

function minWidthHeader(label: string): CSSProperties {
  if (label === 'Fecha') return { minWidth: 108 };
  if (label === 'Proveedor') return { minWidth: 140 };
  if (label === 'RIF') return { minWidth: 120 };
  if (label === 'Producto') return { minWidth: 168 };
  if (label === 'Total (Bs)') return { minWidth: 120 };
  if (label === 'USD') return { minWidth: 88 };
  if (label === 'Entidad') return { minWidth: 112 };
  if (label === 'Almacén') return { minWidth: 120 };
  if (label === 'Tasa BCV') return { minWidth: 112 };
  if (label === 'Días crédito') return { minWidth: 88 };
  if (label === 'Vencimiento') return { minWidth: 108 };
  if (label === 'Pago') return { minWidth: 96 };
  if (label === 'Acciones') return { minWidth: 168 };
  return {};
}

type MetaFecha = ReturnType<typeof metaAlertaFechaCompra>;

function FilaFactura({
  c,
  seleccionada,
  onToggleCompra,
  metaFecha,
  montos,
  tasaDisp,
  almacen,
  puedeImagen,
  imagenAbierta,
  onToggleImagen,
  bloqueado,
  deletingId,
  ingresandoAlmacenId,
  cambiandoMonedaId,
  onReubicar,
  onIngresoAlmacen,
  onVerificarFecha,
  onModificar,
  onEliminar,
  onCambiarMoneda,
  onReload,
  onMarcarPagado,
}: {
  c: CompraListaUnificada;
  seleccionada: boolean;
  onToggleCompra: (id: string) => void;
  metaFecha: MetaFecha;
  montos: { bs: number; usd: number | null; moneda: MonedaOrigen };
  tasaDisp: number | null;
  almacen: { texto: string; pendienteIngreso: boolean };
  puedeImagen: boolean;
  imagenAbierta: boolean;
  onToggleImagen: (id: string) => void;
  bloqueado: boolean;
  deletingId: string | null;
  ingresandoAlmacenId: string | null;
  cambiandoMonedaId: string | null;
  onReubicar: (opts: ReubicarCompraOpts) => void;
  onIngresoAlmacen: (c: CompraListaUnificada) => void;
  onVerificarFecha: (c: CompraListaUnificada) => void;
  onModificar: (c: CompraListaUnificada) => void;
  onEliminar: (c: CompraListaUnificada) => void;
  onCambiarMoneda: (c: CompraListaUnificada, moneda: MonedaOrigen) => void;
  onReload: () => void;
  onMarcarPagado?: (c: CompraListaUnificada) => void;
}) {
  const compraId = c.id;
  const lineasBase = lineasProductoVisibles(lineasDetalle(c));
  const [productoAbierto, setProductoAbierto] = useState(false);
  const [lineasFetch, setLineasFetch] = useState<CompraLineaUi[]>([]);
  const [cargandoProductos, setCargandoProductos] = useState(false);
  const [errorProductos, setErrorProductos] = useState<string | null>(null);
  const lineasProducto = lineasBase.length > 0 ? lineasBase : lineasFetch;

  useEffect(() => {
    setProductoAbierto(false);
    setLineasFetch([]);
    setErrorProductos(null);
    setCargandoProductos(false);
  }, [compraId]);

  const cargarLineasProducto = useCallback(async () => {
    if (compraId.startsWith('canal-')) return;
    setCargandoProductos(true);
    setErrorProductos(null);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('contabilidad_compra_lineas')
        .select('id,descripcion,item_code,subtotal,cantidad,precio_unitario')
        .eq('compra_id', compraId)
        .order('created_at', { ascending: true });
      if (error) {
        setErrorProductos(error.message);
        return;
      }
      setLineasFetch(
        lineasProductoVisibles(
          (data ?? []).map((r) => ({
            id: r.id != null ? String(r.id) : undefined,
            descripcion: String(r.descripcion ?? ''),
            item_code: r.item_code != null ? String(r.item_code) : null,
            subtotal: Number(r.subtotal) || 0,
            cantidad: Number(r.cantidad) || 0,
            precio_unitario: r.precio_unitario != null ? Number(r.precio_unitario) : undefined,
          })),
        ),
      );
    } catch (e) {
      setErrorProductos(e instanceof Error ? e.message : 'No se pudieron cargar los productos');
    } finally {
      setCargandoProductos(false);
    }
  }, [compraId]);

  async function toggleProducto() {
    const next = !productoAbierto;
    setProductoAbierto(next);
    if (next && lineasBase.length === 0 && lineasFetch.length === 0) {
      await cargarLineasProducto();
    }
  }

  return (
    <>
      <tr
        id={`compra-row-${c.id}`}
        style={{
          borderTop: '1px solid rgba(255,255,255,0.06)',
          background: seleccionada ? 'rgba(88,86,214,0.08)' : undefined,
        }}
      >
        <td style={{ ...td, verticalAlign: 'top' }}>
          <input
            type="checkbox"
            checked={seleccionada}
            onChange={() => onToggleCompra(c.id)}
            aria-label={`Seleccionar factura ${c.invoice_number || c.supplier_name}`}
            style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#5856D6' }}
          />
        </td>
        <td className="whitespace-nowrap" style={tdFecha}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
            <span className="whitespace-nowrap">{c.fecha || '—'}</span>
            {metaFecha.nivel === 'ok' ? null : metaFecha.requiereVerificacion ? (
              <button
                type="button"
                className={claseBlinkFechaCompra(metaFecha.nivel) ?? undefined}
                onClick={() => onVerificarFecha(c)}
                title={metaFecha.mensaje}
                style={metaFecha.nivel === 'advertencia' ? btnFechaAdvertencia : btnFechaCritica}
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
        <td style={{ ...td, fontFamily: 'monospace' }}>{c.invoice_number || '—'}</td>
        <CeldaTruncada texto={c.supplier_name} minWidth={140} maxWidth={180} />
        <td
          className="whitespace-nowrap"
          style={{ ...tdRif, color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace' }}
        >
          {etiquetaRifCompra(c.supplier_rif)}
        </td>
        <td
          className="whitespace-nowrap compras-cell-ellipsis"
          style={{ ...td, minWidth: 168, maxWidth: 240, overflow: 'hidden' }}
        >
          <ProductoFacturaCelda
            c={c}
            abierto={productoAbierto}
            onToggle={() => void toggleProducto()}
          />
        </td>
        <td className="whitespace-nowrap" style={{ ...tdMonto, minWidth: 120, fontWeight: 800 }}>
          {formatearBs(montos.bs)}
        </td>
        <td className="whitespace-nowrap" style={{ ...tdMonto, minWidth: 88, color: '#FF3B30', fontWeight: 700 }}>
          {montos.usd != null ? formatearUsd(montos.usd) : '—'}
        </td>
        <CeldaTruncada
          texto={c.entidad_nombre || '—'}
          minWidth={112}
          maxWidth={150}
          style={{ color: 'rgba(255,255,255,0.55)' }}
        />
        <CeldaTruncada
          texto={almacen.texto && almacen.texto !== '—' ? almacen.texto : '—'}
          minWidth={120}
          maxWidth={170}
          title={
            almacen.pendienteIngreso
              ? `${almacen.texto} — Registrada en contabilidad; almacén se asigna al ingresar el material`
              : almacen.texto && almacen.texto !== '—'
                ? almacen.texto
                : undefined
          }
          style={{
            color: almacen.pendienteIngreso ? 'rgba(251,191,36,0.85)' : '#fdba74',
            fontStyle: almacen.pendienteIngreso ? 'italic' : undefined,
            fontWeight: almacen.pendienteIngreso ? 600 : undefined,
          }}
        />
        <td
          style={{ ...td, maxWidth: 140, color: 'rgba(255,255,255,0.55)' }}
          title={tooltipClienteCrmCompra({
            clienteCrmNombre: c.cliente_crm_nombre,
            entidadNombre: c.entidad_nombre,
          })}
        >
          {c.proyecto_nombre || '—'}
        </td>
        <td style={td}>
          {puedeImagen ? (
            <button
              type="button"
              onClick={() => onToggleImagen(c.id)}
              style={btnLink}
              aria-expanded={imagenAbierta}
              aria-haspopup="dialog"
            >
              {imagenAbierta ? 'Ocultar imagen' : c.document_storage_path ? 'Ver imagen' : 'Factura / adjuntar'}
            </button>
          ) : (
            <span style={{ opacity: 0.4 }}>—</span>
          )}
        </td>
        <td style={{ ...td, verticalAlign: 'top' }}>
          <AccionesFactura
            c={c}
            metaFecha={metaFecha}
            bloqueado={bloqueado}
            deletingId={deletingId}
            ingresandoAlmacenId={ingresandoAlmacenId}
            onReubicar={onReubicar}
            onIngresoAlmacen={onIngresoAlmacen}
            onVerificarFecha={onVerificarFecha}
            onModificar={onModificar}
            onEliminar={onEliminar}
            onMarcarPagado={onMarcarPagado}
          />
        </td>
        <td className="whitespace-nowrap" style={{ ...td, whiteSpace: 'nowrap', minWidth: 96, color: 'rgba(255,255,255,0.55)' }}>
          {c.notas?.trim() || '—'}
        </td>
        <td
          className="whitespace-nowrap"
          style={{ ...tdMonto, minWidth: 112, color: 'rgba(255,255,255,0.55)', fontWeight: 700 }}
        >
          {tasaDisp != null && tasaDisp > 0
            ? `${formatearTasaBcv(tasaDisp)}${!tasaBcvCompra(c) && tasaDisp ? ' (BCV fecha)' : ''}`
            : '—'}
        </td>
        <td className="whitespace-nowrap" style={{ ...td, minWidth: 88, textAlign: 'right' }}>
          {c.dias_credito != null && c.dias_credito > 0 ? c.dias_credito : c.condicion_pago === 'credito' ? '—' : 'Contado'}
        </td>
        <td className="whitespace-nowrap" style={{ ...tdFecha, minWidth: 108 }}>
          {c.fecha_vencimiento || '—'}
        </td>
        <td className="whitespace-nowrap" style={{ ...td, minWidth: 96 }}>
          {c.pago_credito_estado ? (
            <span
              style={{
                fontSize: '10px',
                fontWeight: 800,
                padding: '2px 7px',
                borderRadius: '6px',
                ...(c.pago_credito_estado === 'pagado'
                  ? { background: 'rgba(52,199,89,0.18)', color: '#86efac' }
                  : c.pago_credito_estado === 'vencido'
                    ? { background: 'rgba(255,59,48,0.18)', color: '#FF8A85' }
                    : { background: 'rgba(251,191,36,0.16)', color: '#fcd34d' }),
              }}
            >
              {etiquetaEstadoPagoCredito(c.pago_credito_estado)}
            </span>
          ) : (
            '—'
          )}
        </td>
        <td style={{ ...td, whiteSpace: 'nowrap', color: 'rgba(255,255,255,0.7)' }}>{c.estado || '—'}</td>
        <td style={{ ...td, whiteSpace: 'nowrap', color: '#a78bfa', fontWeight: 700 }}>
          {etiquetaOrigenCompra(c)}
        </td>
        <td style={td}>
          {c.estado_logistica && c.estado_logistica !== 'sin_documento' ? (
            <span
              style={{
                fontSize: '10px',
                fontWeight: 800,
                padding: '2px 7px',
                borderRadius: '6px',
                ...coloresEstadoLogistica(c.estado_logistica),
              }}
            >
              {etiquetaEstadoLogistica(c.estado_logistica, c.logistica_conteos)}
            </span>
          ) : (
            '—'
          )}
        </td>
        <td style={td}>
          {c.fuente_lista === 'app' && !c.id.startsWith('canal-') ? (
            <ImputacionCompraToggle compraId={c.id} imputacion={c.imputacion} onChanged={onReload} />
          ) : (
            <span style={{ color: 'rgba(255,255,255,0.45)' }}>
              {esGastoEntidadImputacion(c.imputacion) ? 'Gasto entidad' : 'Obra'}
            </span>
          )}
        </td>
        <td style={td}>
          {esGastoEntidadImputacion(c.imputacion) && !c.id.startsWith('canal-') ? (
            <ClasificacionGastoEntidadSelect
              compraId={c.id}
              value={c.clasificacion_gasto_entidad}
              compact
              onChanged={onReload}
            />
          ) : esGastoEntidadImputacion(c.imputacion) && c.clasificacion_gasto_entidad ? (
            <span style={{ color: '#c4b5fd', fontWeight: 700 }}>
              {etiquetaClasificacionGastoEntidad(c.clasificacion_gasto_entidad)}
            </span>
          ) : (
            '—'
          )}
        </td>
        <td style={td}>
          <select
            id={`moneda-${c.id}`}
            value={monedaOriginalCompra(c)}
            disabled={cambiandoMonedaId === c.id || bloqueado}
            onChange={(e) => onCambiarMoneda(c, normalizarMonedaExtracted(e.target.value))}
            style={selectMoneda}
          >
            <option value="VES">Bs</option>
            <option value="USD">USD</option>
          </select>
        </td>
        <td style={{ ...td, minWidth: 180 }}>
          <CompraProductosToggle
            compraId={c.id}
            tasaBcv={tasaDisp}
            tasaEsDelDia={!tasaBcvCompra(c) && !!tasaDisp}
            montoBsFactura={montos.bs}
            montoUsdFactura={montos.usd}
            monedaOriginal={montos.moneda}
            filaMoneda={{
              total_amount: Number(c.total_amount) || 0,
              total_amount_usd: c.total_amount_usd,
              tasa_bcv_ves_por_usd: c.tasa_bcv_ves_por_usd,
              moneda: c.moneda,
              moneda_original: c.moneda_original,
              monto_ves: c.monto_ves,
              monto_usd: c.monto_usd,
            }}
            lineCountHint={lineCount(c)}
            lineasIniciales={lineasParaProductosToggle(c)}
          />
        </td>
        <td style={{ ...td, maxWidth: 140, color: 'rgba(255,255,255,0.55)' }}>
          {c.cliente_crm_nombre ? `CRM: ${c.cliente_crm_nombre}` : c.proyecto_nombre ? 'Sin cliente CRM' : '—'}
        </td>
      </tr>
      {productoAbierto ? (
        <tr>
          <td colSpan={COLSPAN} style={{ ...td, paddingTop: 0 }}>
            <ProductoFacturaDetalle
              c={c}
              lineas={lineasProducto}
              cargando={cargandoProductos}
              error={errorProductos}
            />
          </td>
        </tr>
      ) : null}
      {compraTieneDetallePuenteInventario(c) ? (
        <tr>
          <td colSpan={COLSPAN} style={{ ...td, paddingTop: 0, color: c.cuarentena_rechazo_total ? '#fca5a5' : 'rgba(134,239,172,0.95)' }}>
            {lineasDetallePuenteInventario(c).map((linea) => (
              <p key={linea} style={{ margin: 0, fontSize: 11, fontWeight: 600, lineHeight: 1.45 }}>
                {linea}
              </p>
            ))}
          </td>
        </tr>
      ) : null}
      {c.mensaje_error_canal ? (
        <tr>
          <td colSpan={COLSPAN} style={{ ...td, paddingTop: 0, color: '#FF6B6B', fontSize: 11 }}>
            {c.mensaje_error_canal}
          </td>
        </tr>
      ) : null}
      {!puedeImagen && c.document_file_name ? (
        <tr>
          <td colSpan={COLSPAN} style={{ ...td, fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
            Archivo «{c.document_file_name}» registrado sin imagen en Storage. Adjúntala en{' '}
            <Link href="/almacen/procurement" style={{ color: '#5856D6', fontWeight: 700 }}>
              recepción de mercancía
            </Link>
            .
          </td>
        </tr>
      ) : null}
    </>
  );
}

function AccionesFactura({
  c,
  metaFecha,
  bloqueado,
  deletingId,
  ingresandoAlmacenId,
  onReubicar,
  onIngresoAlmacen,
  onVerificarFecha,
  onModificar,
  onEliminar,
  onMarcarPagado,
}: {
  c: CompraListaUnificada;
  metaFecha: MetaFecha;
  bloqueado: boolean;
  deletingId: string | null;
  ingresandoAlmacenId: string | null;
  onReubicar: (opts: ReubicarCompraOpts) => void;
  onIngresoAlmacen: (c: CompraListaUnificada) => void;
  onVerificarFecha: (c: CompraListaUnificada) => void;
  onModificar: (c: CompraListaUnificada) => void;
  onEliminar: (c: CompraListaUnificada) => void;
  onMarcarPagado?: (c: CompraListaUnificada) => void;
}) {
  return (
    <div
      className="compras-factura-acciones compras-no-imprimir"
      style={{ display: 'flex', flexDirection: 'row', flexWrap: 'nowrap', gap: 4, whiteSpace: 'nowrap' }}
    >
      {puedeReubicarCompra(c) ? (
        <AccionIcono
          label="Obra / almacén"
          disabled={bloqueado}
          onClick={() =>
            onReubicar({
              id: c.id,
              entidadId: c.entidad_id,
              proyectoId: c.proyecto_id,
              ubicacionId: c.ubicacion_destino_id,
              titulo: `Reubicar — ${c.supplier_name}`,
            })
          }
          style={{ border: '1px solid rgba(251,146,60,0.45)', background: 'rgba(234,88,12,0.15)', color: '#fdba74' }}
        >
          <MapPin className="h-3.5 w-3.5" />
        </AccionIcono>
      ) : null}
      {c.purchase_invoice_id &&
      compraMuestraBotonConfirmacionRecepcion(c) &&
      !esGastoEntidadImputacion(c.imputacion) ? (
        !c.ubicacion_destino_id ? (
          <AccionIcono
            label="Asignar almacén"
            disabled={bloqueado}
            onClick={() =>
              onReubicar({
                id: c.id,
                entidadId: c.entidad_id,
                proyectoId: c.proyecto_id,
                ubicacionId: c.ubicacion_destino_id,
                titulo: `Asignar almacén — ${c.supplier_name}`,
              })
            }
            style={{ border: '1px solid rgba(251,191,36,0.45)', background: 'rgba(251,191,36,0.12)', color: '#fcd34d' }}
          >
            <MapPin className="h-3.5 w-3.5" />
          </AccionIcono>
        ) : (
          <AccionIcono
            label={c.estado_logistica === 'en_almacen_parcial' ? 'Liberar pendiente' : 'Confirmación recepción'}
            disabled={bloqueado || ingresandoAlmacenId !== null}
            onClick={() => onIngresoAlmacen(c)}
            style={{
              border:
                c.estado_logistica === 'cuarentena' || c.estado_logistica === 'en_almacen_parcial'
                  ? '1px solid rgba(245,158,11,0.45)'
                  : '1px solid rgba(52,199,89,0.45)',
              background:
                c.estado_logistica === 'cuarentena' || c.estado_logistica === 'en_almacen_parcial'
                  ? 'rgba(245,158,11,0.14)'
                  : 'rgba(52,199,89,0.14)',
              color:
                c.estado_logistica === 'cuarentena' || c.estado_logistica === 'en_almacen_parcial'
                  ? '#fcd34d'
                  : '#86efac',
              opacity: ingresandoAlmacenId === c.id ? 0.6 : 1,
            }}
          >
            {ingresandoAlmacenId === c.id ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <PackageCheck className="h-3.5 w-3.5" />
            )}
          </AccionIcono>
        )
      ) : null}
      {metaFecha.requiereVerificacion ? (
        <AccionIcono
          label="Verificar fecha"
          className={claseBlinkFechaCompra(metaFecha.nivel) ?? undefined}
          disabled={bloqueado}
          onClick={() => onVerificarFecha(c)}
          style={{
            border:
              metaFecha.nivel === 'advertencia'
                ? '1px solid rgba(255,149,0,0.55)'
                : '1px solid rgba(255,59,48,0.55)',
            background: metaFecha.nivel === 'advertencia' ? 'rgba(255,149,0,0.18)' : 'rgba(255,59,48,0.18)',
            color: metaFecha.nivel === 'advertencia' ? '#FFC56D' : '#FF8A85',
          }}
        >
          <CalendarClock className="h-3.5 w-3.5" />
        </AccionIcono>
      ) : null}
      {onMarcarPagado &&
      c.purchase_invoice_id &&
      (c.pago_credito_estado === 'por_pagar' || c.pago_credito_estado === 'vencido') ? (
        <AccionIcono
          label="Marcar pagado"
          disabled={bloqueado}
          onClick={() => onMarcarPagado(c)}
          style={{ border: '1px solid rgba(52,199,89,0.45)', background: 'rgba(52,199,89,0.14)', color: '#86efac' }}
        >
          <Banknote className="h-3.5 w-3.5" />
        </AccionIcono>
      ) : null}
      {c.pendiente_canal_id ? (
        <AccionIcono
          label="Modificar"
          disabled={bloqueado}
          onClick={() => onModificar(c)}
          style={{ border: '1px solid rgba(56,189,248,0.4)', background: 'rgba(14,116,144,0.25)', color: '#7dd3fc' }}
        >
          <Pencil className="h-3.5 w-3.5" />
        </AccionIcono>
      ) : null}
      <AccionIcono
        label="Borrar"
        disabled={bloqueado}
        onClick={() => onEliminar(c)}
        style={{
          border: '1px solid rgba(255,59,48,0.35)',
          background: 'rgba(255,59,48,0.12)',
          color: '#FF6B6B',
          opacity: deletingId === c.id ? 0.6 : 1,
        }}
      >
        {deletingId === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
      </AccionIcono>
    </div>
  );
}

function AccionIcono({
  label,
  disabled,
  onClick,
  className,
  style,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  className?: string;
  style: CSSProperties;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={['compras-factura-accion-btn', className].filter(Boolean).join(' ')}
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      style={style}
    >
      {children}
    </button>
  );
}

function CeldaTruncada({
  texto,
  minWidth,
  maxWidth,
  title,
  style,
}: {
  texto: string;
  minWidth: number;
  maxWidth: number;
  title?: string;
  style?: CSSProperties;
}) {
  const display = texto?.trim() ? texto : '—';
  return (
    <td
      className="whitespace-nowrap compras-cell-ellipsis"
      style={{
        ...td,
        ...style,
        minWidth,
        maxWidth,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}
      title={title ?? (display !== '—' ? display : undefined)}
    >
      {display}
    </td>
  );
}

function ProductoFacturaCelda({
  c,
  abierto,
  onToggle,
}: {
  c: CompraListaUnificada;
  abierto: boolean;
  onToggle: () => void;
}) {
  const resumen = resumenProductoFactura(lineasDetalle(c), lineCount(c));
  const etiqueta = etiquetaProductoFactura(resumen);
  if (!etiqueta && resumen.total <= 0) {
    return <span style={{ opacity: 0.4 }}>—</span>;
  }
  return (
    <button
      type="button"
      className="compras-producto-toggle"
      onClick={onToggle}
      aria-expanded={abierto}
      title={etiqueta}
    >
      <span className="compras-producto-toggle-label">{etiqueta}</span>
      {resumen.extra > 0 ? <span className="compras-producto-extra">+{resumen.extra}</span> : null}
    </button>
  );
}

function ProductoFacturaDetalle({
  c,
  lineas,
  cargando,
  error,
}: {
  c: CompraListaUnificada;
  lineas: CompraLineaUi[];
  cargando: boolean;
  error: string | null;
}) {
  const moneda = monedaOriginalCompra(c);
  return (
    <div
      className="compras-producto-detalle"
      style={{
        position: 'sticky',
        left: 8,
        width: 'min(720px, calc(100vw - 48px))',
        borderRadius: 12,
        border: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(0,0,0,0.35)',
        overflow: 'auto',
        maxWidth: 'calc(100vw - 48px)',
      }}
    >
      {cargando ? (
        <p style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 14, color: 'rgba(255,255,255,0.45)', fontSize: 12 }}>
          <Loader2 size={16} className="animate-spin" />
          Cargando productos…
        </p>
      ) : error ? (
        <p style={{ padding: 14, color: '#FF6B6B', fontSize: 12, fontWeight: 600 }}>{error}</p>
      ) : lineas.length === 0 ? (
        <p style={{ padding: 14, color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>
          Esta factura no tiene líneas de detalle registradas.
        </p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.04)', textAlign: 'left' }}>
              <th style={{ padding: '10px 12px', color: 'rgba(255,255,255,0.4)', fontWeight: 700 }}>Descripción</th>
              <th style={{ padding: '10px 8px', color: 'rgba(255,255,255,0.4)', fontWeight: 700 }}>Cantidad</th>
              <th style={{ padding: '10px 8px', color: 'rgba(255,255,255,0.4)', fontWeight: 700, textAlign: 'right' }}>P.U.</th>
              <th style={{ padding: '10px 12px', color: 'rgba(255,255,255,0.4)', fontWeight: 700, textAlign: 'right' }}>Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {lineas.map((l, i) => {
              const pu =
                l.precio_unitario ?? (l.cantidad > 0 ? l.subtotal / l.cantidad : 0);
              const precioFmt =
                formatearPrecioUnitarioLineaCompra({
                  esLinea: true,
                  cantidad: l.cantidad,
                  precioUnitario: pu,
                  montoBs: 0,
                  monedaOriginal: moneda,
                }) ?? '—';
              return (
                <tr key={l.id ?? `${l.descripcion}-${i}`} style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <td style={{ padding: '10px 12px', color: 'rgba(255,255,255,0.88)', fontWeight: 700 }}>
                    {l.descripcion || '—'}
                  </td>
                  <td className="whitespace-nowrap" style={{ padding: '10px 8px', color: 'rgba(255,255,255,0.65)', whiteSpace: 'nowrap' }}>
                    {l.cantidad}
                  </td>
                  <td
                    className="whitespace-nowrap"
                    style={{
                      padding: '10px 8px',
                      textAlign: 'right',
                      whiteSpace: 'nowrap',
                      color: moneda === 'USD' ? '#FF3B30' : '#FFD60A',
                      fontWeight: 700,
                    }}
                  >
                    {precioFmt}
                  </td>
                  <td
                    className="whitespace-nowrap"
                    style={{ padding: '10px 12px', textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 800 }}
                  >
                    {moneda === 'USD' ? formatearUsd(l.subtotal) : formatearBs(l.subtotal)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
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

const tdFecha: CSSProperties = { ...td, whiteSpace: 'nowrap', minWidth: 108 };
const tdRif: CSSProperties = { ...td, whiteSpace: 'nowrap', minWidth: 120 };
const tdMonto: CSSProperties = {
  ...td,
  textAlign: 'right',
  whiteSpace: 'nowrap',
  fontVariantNumeric: 'tabular-nums',
};

const btnLink: CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#5856D6',
  fontSize: '11px',
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
  ...btnFechaAdvertencia,
  border: '1px solid rgba(255,59,48,0.55)',
  background: 'rgba(255,59,48,0.18)',
  color: '#FF8A85',
};

const badgeFechaVerificada: CSSProperties = {
  fontSize: 9,
  fontWeight: 700,
  color: '#86efac',
  whiteSpace: 'nowrap',
};

const selectMoneda: CSSProperties = {
  borderRadius: '8px',
  border: '1px solid rgba(255,255,255,0.12)',
  background: '#0A0A0F',
  color: '#f4f4f5',
  fontSize: '11px',
  fontWeight: 800,
  padding: '4px 8px',
  cursor: 'pointer',
};
