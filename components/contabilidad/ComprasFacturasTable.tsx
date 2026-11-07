'use client';

import type { CSSProperties } from 'react';
import Link from 'next/link';
import {
  CalendarClock,
  Loader2,
  MapPin,
  PackageCheck,
  Pencil,
  Trash2,
} from 'lucide-react';
import {
  claseBlinkFechaCompra,
  etiquetaFechaAnomalaCorta,
  metaAlertaFechaCompra,
  type UmbralesFechaCompra,
} from '@/lib/contabilidad/auditoriaFechaCompra';
import { esDescripcionAuditoriaCco } from '@/lib/contabilidad/compraEsAuditoriaCco';
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
import { rutaDocumentoPendienteCanal } from '@/lib/contabilidad/facturaCanalApi';
import {
  compraTieneDetallePuenteInventario,
  lineasDetallePuenteInventario,
} from '@/lib/contabilidad/formatDetalleLogisticaCompra';
import { esGastoEntidadImputacion } from '@/lib/contabilidad/imputacionCompra';
import {
  etiquetaOrigenCompra,
  type CompraListaUnificada,
} from '@/lib/contabilidad/mapCanalPendienteCompra';
import {
  monedaOriginalCompra,
  montosBimonetariosLista,
} from '@/lib/contabilidad/monedaCompra';
import { etiquetaRifCompra } from '@/lib/contabilidad/rifVenezolano';
import { tooltipClienteCrmCompra } from '@/lib/clientes/tooltipClienteCrmCompra';
import type { MonedaOrigen } from '@/lib/finanzas/currency-converter';
import { normalizarMonedaExtracted } from '@/lib/contabilidad/extractedCanal';
import CompraFacturaAdjunto from '@/components/contabilidad/CompraFacturaAdjunto';
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

function compraPuedeAdjuntarFactura(c: CompraListaUnificada): boolean {
  return (
    c.origen === 'HISTORICO_TABLA' &&
    !c.document_storage_path &&
    !c.purchase_invoice_id &&
    !c.pendiente_canal_id
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
  return lineasDetalle(row)
    .filter((l) => !esDescripcionAuditoriaCco(l.descripcion))
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
    label === 'RIF' ||
    label === 'Total (Bs)' ||
    label === 'USD' ||
    label === 'Tasa BCV' ||
    label === 'Días crédito' ||
    label === 'Vencimiento'
  );
}

function minWidthHeader(label: string): CSSProperties {
  if (label === 'Fecha') return { minWidth: 108 };
  if (label === 'RIF') return { minWidth: 120 };
  if (label === 'Total (Bs)') return { minWidth: 120 };
  if (label === 'USD') return { minWidth: 88 };
  if (label === 'Tasa BCV') return { minWidth: 112 };
  if (label === 'Días crédito') return { minWidth: 88 };
  if (label === 'Vencimiento') return { minWidth: 108 };
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
}) {
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
        <td style={{ ...td, maxWidth: 160 }}>{c.supplier_name}</td>
        <td
          className="whitespace-nowrap"
          style={{ ...tdRif, color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace' }}
        >
          {etiquetaRifCompra(c.supplier_rif)}
        </td>
        <td className="whitespace-nowrap" style={{ ...tdMonto, minWidth: 120, fontWeight: 800 }}>
          {formatearBs(montos.bs)}
        </td>
        <td className="whitespace-nowrap" style={{ ...tdMonto, minWidth: 88, color: '#FF3B30', fontWeight: 700 }}>
          {montos.usd != null ? formatearUsd(montos.usd) : '—'}
        </td>
        <td style={{ ...td, maxWidth: 120, color: 'rgba(255,255,255,0.55)' }}>{c.entidad_nombre || '—'}</td>
        <td style={{ ...td, maxWidth: 140 }}>
          {almacen.texto && almacen.texto !== '—' ? (
            <span
              style={{
                color: almacen.pendienteIngreso ? 'rgba(251,191,36,0.85)' : '#fdba74',
                fontStyle: almacen.pendienteIngreso ? 'italic' : undefined,
                fontWeight: almacen.pendienteIngreso ? 600 : undefined,
              }}
              title={
                almacen.pendienteIngreso
                  ? 'Registrada en contabilidad; almacén se asigna al ingresar el material'
                  : undefined
              }
            >
              {almacen.texto}
            </span>
          ) : (
            '—'
          )}
        </td>
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
      {imagenAbierta && puedeImagen ? (
        <tr>
          <td colSpan={COLSPAN} style={td}>
            <CompraFacturaAdjunto
              compraId={c.id}
              documentApiPath={
                c.pendiente_canal_id && (c.id.startsWith('canal-') || !c.purchase_invoice_id)
                  ? rutaDocumentoPendienteCanal(c.pendiente_canal_id)
                  : undefined
              }
              expanded
              tieneDocumento={Boolean(c.document_storage_path || c.purchase_invoice_id || c.pendiente_canal_id)}
              puedeAdjuntar={compraPuedeAdjuntarFactura(c)}
              esRecepcion={c.origen === 'RECEPCION_MERCANCIA' || c.origen === 'TELEGRAM'}
              onAdjuntado={onReload}
            />
          </td>
        </tr>
      ) : !puedeImagen && c.document_file_name ? (
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
}) {
  return (
    <div className="compras-factura-acciones compras-no-imprimir" style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 118 }}>
      {puedeReubicarCompra(c) ? (
        <button
          type="button"
          className="compras-factura-accion-btn"
          onClick={() =>
            onReubicar({
              id: c.id,
              entidadId: c.entidad_id,
              proyectoId: c.proyecto_id,
              ubicacionId: c.ubicacion_destino_id,
              titulo: `Reubicar — ${c.supplier_name}`,
            })
          }
          disabled={bloqueado}
          style={{ border: '1px solid rgba(251,146,60,0.45)', background: 'rgba(234,88,12,0.15)', color: '#fdba74' }}
        >
          <MapPin className="h-3.5 w-3.5" />
          Obra / almacén
        </button>
      ) : null}
      {c.purchase_invoice_id &&
      compraMuestraBotonConfirmacionRecepcion(c) &&
      !esGastoEntidadImputacion(c.imputacion) ? (
        !c.ubicacion_destino_id ? (
          <button
            type="button"
            className="compras-factura-accion-btn"
            onClick={() =>
              onReubicar({
                id: c.id,
                entidadId: c.entidad_id,
                proyectoId: c.proyecto_id,
                ubicacionId: c.ubicacion_destino_id,
                titulo: `Asignar almacén — ${c.supplier_name}`,
              })
            }
            disabled={bloqueado}
            style={{ border: '1px solid rgba(251,191,36,0.45)', background: 'rgba(251,191,36,0.12)', color: '#fcd34d' }}
          >
            <MapPin className="h-3.5 w-3.5" />
            Asignar almacén
          </button>
        ) : (
          <button
            type="button"
            className="compras-factura-accion-btn"
            onClick={() => onIngresoAlmacen(c)}
            disabled={bloqueado || ingresandoAlmacenId !== null}
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
            {c.estado_logistica === 'en_almacen_parcial' ? 'Liberar pendiente' : 'Confirmación recepción'}
          </button>
        )
      ) : null}
      {metaFecha.requiereVerificacion ? (
        <button
          type="button"
          className={['compras-factura-accion-btn', claseBlinkFechaCompra(metaFecha.nivel)].filter(Boolean).join(' ') || undefined}
          onClick={() => onVerificarFecha(c)}
          disabled={bloqueado}
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
          Verificar fecha
        </button>
      ) : null}
      {c.pendiente_canal_id ? (
        <button
          type="button"
          className="compras-factura-accion-btn"
          onClick={() => onModificar(c)}
          disabled={bloqueado}
          style={{ border: '1px solid rgba(56,189,248,0.4)', background: 'rgba(14,116,144,0.25)', color: '#7dd3fc' }}
        >
          <Pencil className="h-3.5 w-3.5" />
          Modificar
        </button>
      ) : null}
      <button
        type="button"
        className="compras-factura-accion-btn"
        onClick={() => onEliminar(c)}
        disabled={bloqueado}
        style={{
          border: '1px solid rgba(255,59,48,0.35)',
          background: 'rgba(255,59,48,0.12)',
          color: '#FF6B6B',
          opacity: deletingId === c.id ? 0.6 : 1,
        }}
      >
        {deletingId === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
        Borrar
      </button>
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
