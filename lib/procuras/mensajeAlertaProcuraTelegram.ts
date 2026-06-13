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

export type MensajesAlertaProcuraPendiente = {
  canalAdmin: string;
  dmProjectManager: string;
  dmAdministrador: string;
};

export function construirMensajesAlertaProcuraPendiente(
  row: AlertaProcuraAdminRow & {
    ci_compras_capitulos_maestro?: { codigo?: string; nombre?: string } | null;
  },
  prioridad: string,
): MensajesAlertaProcuraPendiente {
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

  const cuerpo =
    `🎫 <b>Ticket:</b> ${escHtml(row.ticket)}\n` +
    `👷‍♂️ <b>Solicitante:</b> ${escHtml(solicitante)}\n` +
    `📁 <b>Capítulo / Obra:</b> ${escHtml(obra)}\n` +
    `📦 <b>Material:</b> ${cantidad} ${escHtml(row.unidad)} de ${escHtml(material)}\n` +
    `🔴 <b>Prioridad:</b> ${escHtml(prioridad)}${montoUsd}`;

  return {
    canalAdmin:
      '🏗️ <b>ALERTA DE PROCURA PENDIENTE</b>\n\n' +
      cuerpo +
      '\n\n¿Autoriza el <b>Administrador</b>?',
    dmProjectManager:
      '👷‍♂️ <b>ALERTA — Procura pendiente (Project Manager)</b>\n\n' +
      cuerpo +
      '\n\n¿Autoriza el <b>Project Manager</b>?',
    dmAdministrador:
      '🛡️ <b>ALERTA — Procura pendiente (Administrador)</b>\n\n' +
      cuerpo +
      '\n\n¿Autoriza el <b>Administrador</b>?',
  };
}

/** Ejemplo fijo para vista previa / pruebas Telegram. */
export function mensajeAlertaProcuraAdminDemo(): string {
  return construirMensajesAlertaProcuraPendiente(
    {
      id: '00000000-0000-4000-8000-000000000099',
      ticket: 'PR-2026-DEMO',
      solicitante_nombre: 'Obrero de prueba',
      material_txt: 'CABILLA 3/8',
      cantidad: 120,
      unidad: 'UND',
      estado: 'solicitada',
      prioridad: 'Alta',
      monto_estimado_usd: 85.5,
      ci_compras_capitulos_maestro: { codigo: '03', nombre: 'Estructura' },
    },
    'Alta',
  ).dmAdministrador;
}
