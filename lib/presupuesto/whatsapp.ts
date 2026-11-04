/**
 * Un solo helper para abrir WhatsApp desde presupuestos.
 * Normaliza 0414… / +58 / 412… a 58XXXXXXXXXX reusando `numeroWhatsapp`.
 * Si no hay teléfono, avisa: nunca arma wa.me/58.
 */
import { numeroWhatsapp } from '@/lib/clientes/presupuestosCliente';
import { etiquetaIva, formatearUsdPresupuesto, totalConIvaDe } from './iva';

export type UrlWhatsAppOk = { ok: true; url: string; numero: string };
export type UrlWhatsAppFail = { ok: false; motivo: string };

export const AVISO_SIN_TELEFONO_WHATSAPP =
  'Este cliente no tiene un teléfono de WhatsApp. Agrégalo en la ficha del cliente antes de compartir.';

/** Chat de WhatsApp al número del cliente, o aviso si no hay teléfono usable. */
export function urlChatWhatsApp(
  telefono: string | null | undefined,
  mensaje: string,
): UrlWhatsAppOk | UrlWhatsAppFail {
  const numero = numeroWhatsapp(telefono);
  if (!numero) {
    return { ok: false, motivo: AVISO_SIN_TELEFONO_WHATSAPP };
  }
  const url = `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;
  return { ok: true, url, numero };
}

export function mensajeWhatsAppPresupuesto(opts: {
  numero: string;
  cliente: string;
  subtotal: number;
  ivaPct?: number;
  urlDocumento: string;
}): string {
  const ivaPct = opts.ivaPct ?? 16;
  const total = totalConIvaDe(opts.subtotal, ivaPct);
  const iva = etiquetaIva(ivaPct);
  return [
    '*PRESUPUESTO CASA INTELIGENTE*',
    `Nro: ${opts.numero}`,
    `Cliente: ${opts.cliente || '—'}`,
    `Total: ${formatearUsdPresupuesto(total)} (${iva})`,
    '',
    'Documento (enlace seguro, sin precios de costo):',
    opts.urlDocumento,
  ].join('\n');
}
