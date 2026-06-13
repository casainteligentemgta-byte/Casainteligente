import type { AlertaProcuraAdminRow } from '@/lib/procuras/alertaAdminProcuraTelegram';
import { etiquetaCapituloMaestro } from '@/lib/compras/capitulosMaestro';
import { limpiarDescripcionProcura } from '@/lib/compras/procuraMaterialTexto';

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

export type MensajesProcuraRegistradaPendiente = {
  canalAdmin: string;
  dmProjectManager: string;
  dmAdministrador: string;
};

type FilaProcuraMensaje = AlertaProcuraAdminRow & {
  ci_compras_capitulos_maestro?: { codigo?: string; nombre?: string } | null;
};

function cuerpoDetalleProcura(row: FilaProcuraMensaje, prioridad: string): string {
  const capRel = row.ci_compras_capitulos_maestro;
  const capLabel = capRel
    ? etiquetaCapituloMaestro({
        codigo: String(capRel.codigo ?? ''),
        nombre: String(capRel.nombre ?? ''),
      })
    : null;
  const obra = capLabel || nombreObra(row.ci_proyectos);
  const solicitante = row.solicitante_nombre?.trim() || '—';
  const cantidad = Number(row.cantidad).toLocaleString('es-VE');
  const material = limpiarDescripcionProcura(row.material_txt);
  const montoUsd =
    row.monto_estimado_usd != null && Number.isFinite(Number(row.monto_estimado_usd))
      ? `\n💵 Estimado: <b>USD ${Number(row.monto_estimado_usd).toFixed(2)}</b>`
      : '';

  return (
    `🎫 <b>Ticket:</b> ${escHtml(row.ticket)}\n` +
    `👷‍♂️ <b>Solicitante:</b> ${escHtml(solicitante)}\n` +
    `📁 <b>Capítulo / Obra:</b> ${escHtml(obra)}\n` +
    `📦 <b>Material:</b> ${cantidad} ${escHtml(row.unidad)} de ${escHtml(material)}\n` +
    `🔴 <b>Prioridad:</b> ${escHtml(prioridad)}${montoUsd}`
  );
}

/** Mensaje único para aprobadores: registrada + pendiente, sin duplicar cabeceras. */
export function construirMensajesProcuraRegistradaPendiente(
  row: FilaProcuraMensaje,
  prioridad: string,
): MensajesProcuraRegistradaPendiente {
  const cuerpo = cuerpoDetalleProcura(row, prioridad);
  const titulo =
    '✅ <b>PROCURA REGISTRADA</b> — <i>pendiente de autorización</i>\n\n';

  return {
    canalAdmin: titulo + cuerpo + '\n\n¿Autoriza el <b>Administrador</b>?',
    dmProjectManager:
      titulo + cuerpo + '\n\n¿Autoriza el <b>Project Manager</b>?',
    dmAdministrador: titulo + cuerpo + '\n\n¿Autoriza el <b>Administrador</b>?',
  };
}

/** @deprecated Usar construirMensajesProcuraRegistradaPendiente */
export function construirMensajesAlertaProcuraPendiente(
  row: FilaProcuraMensaje,
  prioridad: string,
): MensajesProcuraRegistradaPendiente {
  return construirMensajesProcuraRegistradaPendiente(row, prioridad);
}

const PENDIENTE_APROBACION_PM_ADMIN =
  '⏳ Pendiente de aprobación del <b>Administrador</b> y el <b>Project Manager</b>.';

/** Confirmación breve al obrero (vía larga): ya vio los detalles al confirmar. */
export function construirMensajeSolicitanteProcuraViaLarga(ticket: string): string {
  return (
    '✅ <b>PROCURA REGISTRADA</b>\n\n' +
    `🎫 <b>Ticket:</b> ${escHtml(ticket)}\n` +
    PENDIENTE_APROBACION_PM_ADMIN
  );
}

/** Confirmación al obrero (vía rápida): incluye resumen porque no hay alerta posterior. */
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

/** Confirmación al obrero cuando falla histórico (vía larga forzada). */
export function construirMensajeSolicitanteProcuraViaLargaHistorico(ticket: string): string {
  return (
    construirMensajeSolicitanteProcuraViaLarga(ticket) +
    '\n\n⚠️ No se pudo verificar el costo histórico; la oficina revisará la solicitud.'
  );
}

/** Ejemplo fijo para vista previa / pruebas Telegram. */
export function mensajesAlertaProcuraDemo(prioridad = 'Media'): MensajesProcuraRegistradaPendiente {
  return construirMensajesProcuraRegistradaPendiente(
    {
      id: '00000000-0000-4000-8000-000000000099',
      ticket: 'PR-2026-00024',
      solicitante_nombre: 'Obrero de prueba',
      material_txt: 'CEMENTO GRIS',
      cantidad: 50,
      unidad: 'SACO',
      estado: 'solicitada',
      prioridad,
      monto_estimado_usd: 42.5,
      ci_compras_capitulos_maestro: { codigo: '03', nombre: 'Estructura' },
    },
    prioridad,
  );
}

/** @deprecated Usar mensajesAlertaProcuraDemo().dmAdministrador */
export function mensajeAlertaProcuraAdminDemo(): string {
  return mensajesAlertaProcuraDemo('Alta').dmAdministrador;
}
