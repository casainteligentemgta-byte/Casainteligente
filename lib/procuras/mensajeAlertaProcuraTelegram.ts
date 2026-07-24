import type { SupabaseClient } from '@supabase/supabase-js';
import type { AlertaProcuraAdminRow } from '@/lib/procuras/alertaAdminProcuraTelegram';
import { etiquetaCapituloMaestro } from '@/lib/compras/capitulosMaestro';
import {
  limpiarDescripcionProcura,
  nombreMaterialProcuraVisible,
} from '@/lib/compras/procuraMaterialTexto';
import type { AlmacenStockEntidad } from '@/lib/procuras/disponibilidadMaterialProcura';
import {
  lineasAlmacenesEntidadProcura,
  listarAlmacenesStockMaterialEntidad,
} from '@/lib/procuras/disponibilidadMaterialProcura';

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function nombreObra(
  rel: { nombre?: string } | { nombre?: string }[] | null | undefined,
): string {
  if (!rel) return '—';
  if (Array.isArray(rel)) return rel[0]?.nombre?.trim() || '—';
  return rel.nombre?.trim() || '—';
}

export type ResumenStockProcuraTicket = {
  cantidadSolicitada: number;
  cantidadDespacho: number;
  cantidadCompra: number;
  stockDisponible: number;
  unidad: string;
  almacenesEntidad?: AlmacenStockEntidad[];
};

export type FilaProcuraMensaje = AlertaProcuraAdminRow & {
  ci_compras_capitulos_maestro?: { codigo?: string; nombre?: string } | null;
  cantidad_despacho?: number | null;
  cantidad_compra?: number | null;
  stock_almacen_detectado?: number | null;
  viabilidad_presupuestaria?: string | null;
  viabilidad_informada_por?: string | null;
  material_id?: string | null;
  entidad_id?: string | null;
};

function materialVisible(row: FilaProcuraMensaje): string {
  return nombreMaterialProcuraVisible(row.material_txt ?? '');
}

function lineasStockTicket(
  row: FilaProcuraMensaje,
  stock?: ResumenStockProcuraTicket | null,
): string {
  const unidad = row.unidad?.trim() || 'UND';
  const solicitado = Number(row.cantidad);
  const despacho =
    stock?.cantidadDespacho ??
    (row.cantidad_despacho != null ? Number(row.cantidad_despacho) : null);
  const compra =
    stock?.cantidadCompra ??
    (row.cantidad_compra != null ? Number(row.cantidad_compra) : null);
  const enAlmacen =
    stock?.stockDisponible ??
    (row.stock_almacen_detectado != null ? Number(row.stock_almacen_detectado) : null);

  if (despacho == null && compra == null && enAlmacen == null) {
    return '';
  }

  const qtySol = solicitado.toLocaleString('es-VE');
  const qtyAlm = Number(enAlmacen ?? 0).toLocaleString('es-VE');
  const qtyDesp = Number(despacho ?? 0).toLocaleString('es-VE');
  const qtyComp = Number(compra ?? solicitado).toLocaleString('es-VE');

  return (
    `\n📦 <b>Solicitado:</b> ${qtySol} ${escHtml(unidad)}\n` +
    `🏪 <b>En almacén obra:</b> ${qtyAlm} ${escHtml(unidad)}\n` +
    `🚚 <b>Despacho almacén:</b> ${qtyDesp} ${escHtml(unidad)}\n` +
    `🛒 <b>A comprar:</b> ${qtyComp} ${escHtml(unidad)}` +
    lineasAlmacenesEntidadProcura(stock?.almacenesEntidad ?? [], unidad, escHtml)
  );
}

function cuerpoDetalleProcura(
  row: FilaProcuraMensaje,
  prioridad: string,
  stock?: ResumenStockProcuraTicket | null,
): string {
  const capRel = row.ci_compras_capitulos_maestro;
  const capLabel = capRel
    ? etiquetaCapituloMaestro({
        codigo: String(capRel.codigo ?? ''),
        nombre: String(capRel.nombre ?? ''),
      })
    : null;
  const obra = capLabel || nombreObra(row.ci_proyectos);
  const solicitante = row.solicitante_nombre?.trim() || '—';
  const material = materialVisible(row);
  const montoUsd =
    row.monto_estimado_usd != null && Number.isFinite(Number(row.monto_estimado_usd))
      ? `\n💵 Estimado: <b>USD ${Number(row.monto_estimado_usd).toFixed(2)}</b>`
      : '';
  const stockBlock = lineasStockTicket(row, stock);

  return (
    `🎫 <b>Ticket:</b> ${escHtml(row.ticket)}\n` +
    `👷 <b>Solicitante:</b> ${escHtml(solicitante)}\n` +
    `📦 <b>Material:</b> ${escHtml(material)}\n` +
    `📁 <b>Capítulo / Obra:</b> ${escHtml(obra)}\n` +
    `🔴 <b>Prioridad:</b> ${escHtml(prioridad)}${montoUsd}${stockBlock}`
  );
}

function etiquetaViabilidad(v: string | null | undefined): string {
  const t = String(v ?? '').trim().toLowerCase();
  if (t === 'si' || t === 'sí') return 'SÍ';
  if (t === 'no') return 'NO';
  return '—';
}

/** Ticket para Contador: informar viabilidad presupuestaria (manual). */
export function construirMensajeAdminViabilidadProcura(
  row: FilaProcuraMensaje,
  prioridad: string,
  stock?: ResumenStockProcuraTicket | null,
): string {
  return (
    '📊 <b>PROCURA — revisión de fondos (Contador)</b>\n\n' +
    cuerpoDetalleProcura(row, prioridad, stock) +
    '\n\n¿Hay <b>disponibilidad presupuestaria</b> para la compra?'
  );
}

/** Ticket para PM tras informe de viabilidad (contador o supervisor). */
export function construirMensajePmDecisionProcura(
  row: FilaProcuraMensaje,
  prioridad: string,
  stock?: ResumenStockProcuraTicket | null,
  informadoPorRol: 'contador' | 'supervisor' = 'contador',
): string {
  const informante = row.viabilidad_informada_por?.trim() || (informadoPorRol === 'supervisor' ? 'Supervisor' : 'Contador');
  const rolLabel =
    informadoPorRol === 'supervisor' ? 'Supervisor (auditoría formal)' : 'Contador';
  return (
    '🏗️ <b>PROCURA — decisión Project Manager</b>\n\n' +
    cuerpoDetalleProcura(row, prioridad, stock) +
    `\n💰 <b>Disponibilidad presupuestaria:</b> ${escHtml(etiquetaViabilidad(row.viabilidad_presupuestaria))}\n` +
    `👤 <b>Informó:</b> ${escHtml(informante)} (${rolLabel})\n\n` +
    '¿Aprueba la procura?\n' +
    '<i>Tras aprobar: orden de compra al comprador y/o verificación de almacén según stock.</i>'
  );
}

/** Confirmación breve al obrero (vía larga). */
export function construirMensajeSolicitanteProcuraViaLarga(ticket: string): string {
  return (
    '✅ <b>PROCURA REGISTRADA</b>\n\n' +
    `🎫 <b>Ticket:</b> ${escHtml(ticket)}\n` +
    '⏳ Pendiente del <b>Contador</b> (revisión de fondos).'
  );
}

/** Stock suficiente en almacén obra — despacho por depositario. */
export function construirMensajeSolicitanteProcuraStockSuficiente(params: {
  ticket: string;
  materialTxt: string;
  cantidad: number;
  unidad: string;
  almacenNombre?: string | null;
}): string {
  const material = nombreMaterialProcuraVisible(params.materialTxt);
  const qty = params.cantidad.toLocaleString('es-VE');
  const almacen = params.almacenNombre?.trim();
  const lineaAlmacen = almacen
    ? `\n🏪 Hay stock suficiente en <b>${escHtml(almacen)}</b>`
    : '\n🏪 Hay stock suficiente en almacén de la obra';

  return (
    '✅ <b>PROCURA REGISTRADA — DESDE ALMACÉN</b>\n\n' +
    `🎫 <b>Ticket:</b> ${escHtml(params.ticket)}\n` +
    `📦 ${escHtml(material)} — <b>${qty}</b> ${escHtml(params.unidad)}` +
    `${lineaAlmacen}\n` +
    '📋 Tu solicitud fue enviada al <b>depositario</b> para despacho.'
  );
}

/** Sin stock suficiente — entra evaluación de compra (vía rápida o larga). */
export function construirMensajeSolicitanteProcuraCompra(params: {
  ticket: string;
  materialTxt: string;
  cantidad: number;
  unidad: string;
  stockDisponible: number;
  cantidadCompra: number;
  viaRapida: boolean;
  motivoVia?: string;
  capituloLabel?: string;
  prioridad?: string;
}): string {
  const material = nombreMaterialProcuraVisible(params.materialTxt);
  const qty = params.cantidad.toLocaleString('es-VE');
  const stock = params.stockDisponible.toLocaleString('es-VE');
  const saldo = params.cantidadCompra.toLocaleString('es-VE');

  let cuerpo =
    '✅ <b>PROCURA REGISTRADA</b>\n\n' +
    `🎫 <b>Ticket:</b> ${escHtml(params.ticket)}\n` +
    `📦 ${escHtml(material)} — <b>${qty}</b> ${escHtml(params.unidad)}\n`;

  if (params.stockDisponible > 0 && params.cantidadCompra < params.cantidad) {
    cuerpo +=
      `🏪 En almacén: <b>${stock}</b> ${escHtml(params.unidad)} (insuficiente)\n` +
      `🛒 Saldo a comprar: <b>${saldo}</b> ${escHtml(params.unidad)}\n`;
  } else {
    cuerpo += '🏪 <b>NO HAY DISPONIBILIDAD</b> en almacén de la obra\n';
  }

  if (params.viaRapida) {
    cuerpo += `\n⚡ <b>Vía rápida</b> — ${escHtml(params.motivoVia ?? 'monto bajo techo')}`;
  } else {
    cuerpo += '\n⏳ Pendiente del <b>Contador</b> (revisión de fondos).';
  }

  return cuerpo;
}

/** Confirmación al obrero (vía rápida). */
export function construirMensajeSolicitanteProcuraViaRapida(params: {
  ticket: string;
  capituloLabel: string;
  materialTxt: string;
  cantidad: number;
  unidad: string;
  prioridad: string;
  motivoVia: string;
}): string {
  return (
    '✅ <b>PROCURA REGISTRADA</b>\n\n' +
    `🎫 <b>Ticket:</b> ${escHtml(params.ticket)}\n` +
    `📂 ${escHtml(params.capituloLabel)}\n` +
    `📦 ${escHtml(limpiarDescripcionProcura(params.materialTxt))}\n` +
    `🔢 ${params.cantidad.toLocaleString('es-VE')} ${escHtml(params.unidad)}\n` +
    `⚡ Prioridad: <b>${escHtml(params.prioridad)}</b>\n\n` +
    `⚡ <b>Vía rápida</b> — ${escHtml(params.motivoVia)}`
  );
}

export function construirMensajeSolicitanteProcuraViaLargaHistorico(ticket: string): string {
  return (
    construirMensajeSolicitanteProcuraViaLarga(ticket) +
    '\n\n⚠️ No se pudo verificar el costo histórico; la oficina revisará la solicitud.'
  );
}

/** @deprecated Flujo anterior simultáneo Admin+PM */
export type MensajesProcuraRegistradaPendiente = {
  canalAdmin: string;
  dmProjectManager: string;
  dmAdministrador: string;
};

/** @deprecated */
export function construirMensajesProcuraRegistradaPendiente(
  row: FilaProcuraMensaje,
  prioridad: string,
): MensajesProcuraRegistradaPendiente {
  const msg = construirMensajeAdminViabilidadProcura(row, prioridad);
  return { canalAdmin: msg, dmProjectManager: msg, dmAdministrador: msg };
}

export function mensajesAlertaProcuraDemo(prioridad = 'Media'): MensajesProcuraRegistradaPendiente {
  const row: FilaProcuraMensaje = {
    id: '00000000-0000-4000-8000-000000000099',
    ticket: 'PR-2026-00024',
    solicitante_nombre: 'Obrero de prueba',
    material_txt: 'CEMENTO GRIS',
    cantidad: 50,
    unidad: 'SACO',
    estado: 'solicitada',
    prioridad,
    monto_estimado_usd: 42.5,
    cantidad_despacho: 30,
    cantidad_compra: 20,
    stock_almacen_detectado: 30,
    ci_compras_capitulos_maestro: { codigo: '03', nombre: 'Estructura' },
  };
  const stock: ResumenStockProcuraTicket = {
    cantidadSolicitada: 50,
    cantidadDespacho: 30,
    cantidadCompra: 20,
    stockDisponible: 30,
    unidad: 'SACO',
  };
  return {
    canalAdmin: construirMensajeAdminViabilidadProcura(row, prioridad, stock),
    dmAdministrador: construirMensajeAdminViabilidadProcura(row, prioridad, stock),
    dmProjectManager: construirMensajePmDecisionProcura(
      { ...row, viabilidad_presupuestaria: 'si', viabilidad_informada_por: 'Admin demo' },
      prioridad,
      stock,
    ),
  };
}

export function mensajeAlertaProcuraAdminDemo(): string {
  return mensajesAlertaProcuraDemo('Alta').dmAdministrador;
}

export function resumenStockDesdeEvaluacion(
  evaluacion: {
    cantidadSolicitada: number;
    cantidadDespacho: number;
    cantidadCompra: number;
    stockDisponible: number;
  },
  unidad: string,
  almacenesEntidad?: AlmacenStockEntidad[],
): ResumenStockProcuraTicket {
  return {
    cantidadSolicitada: evaluacion.cantidadSolicitada,
    cantidadDespacho: evaluacion.cantidadDespacho,
    cantidadCompra: evaluacion.cantidadCompra,
    stockDisponible: evaluacion.stockDisponible,
    unidad,
    almacenesEntidad,
  };
}

/** Stock obra + almacenes de la entidad para mensajes de viabilidad / PM. */
export async function construirResumenStockProcuraMensaje(
  supabase: SupabaseClient,
  row: {
    cantidad: number;
    cantidad_despacho?: number | null;
    cantidad_compra?: number | null;
    stock_almacen_detectado?: number | null;
    unidad: string;
    material_id?: string | null;
    entidad_id?: string | null;
    proyecto_id?: string | null;
  },
): Promise<ResumenStockProcuraTicket> {
  const almacenesEntidad = await listarAlmacenesStockMaterialEntidad(supabase, {
    materialId: row.material_id,
    entidadId: row.entidad_id,
    proyectoId: row.proyecto_id,
  });
  return resumenStockDesdeEvaluacion(
    {
      cantidadSolicitada: Number(row.cantidad),
      cantidadDespacho: Number(row.cantidad_despacho ?? 0),
      cantidadCompra: Number(row.cantidad_compra ?? row.cantidad),
      stockDisponible: Number(row.stock_almacen_detectado ?? 0),
    },
    row.unidad?.trim() || 'UND',
    almacenesEntidad,
  );
}
