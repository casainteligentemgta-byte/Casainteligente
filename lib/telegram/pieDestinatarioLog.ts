function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Tipo de acción que debe realizar el destinatario en el flujo procura. */
export type AccionDestinatarioLog =
  | 'informar_viabilidad'
  | 'aprobar_rechazar'
  | 'confirmar_almacen'
  | 'ejecutar_compra'
  | 'solo_notificacion';

const ETIQUETA_ACCION: Record<AccionDestinatarioLog, string> = {
  informar_viabilidad: 'debe informar viabilidad presupuestaria',
  aprobar_rechazar: 'debe aprobar o rechazar',
  confirmar_almacen: 'debe confirmar verificación y abastecer',
  ejecutar_compra: 'debe ejecutar la compra',
  solo_notificacion: 'solo notificación',
};

export type DestinatarioLogPie = {
  rol: string;
  nombre?: string | null;
  chatId?: string | number | null;
};

/** Pie estándar al final del mensaje en el bot de logs. */
export function pieDestinatarioLog(params: {
  rol: string;
  nombre?: string | null;
  accion?: AccionDestinatarioLog;
  chatId?: string | number | null;
}): string {
  const rol = params.rol.trim() || 'Destinatario';
  const nombre = params.nombre?.trim();
  const quien = nombre ? `${nombre} · ${rol}` : rol;
  const chat =
    params.chatId != null && String(params.chatId).trim()
      ? ` <i>(chat ${escHtml(String(Math.trunc(Number(params.chatId))))})</i>`
      : '';
  let pie = `\n\n—\n👤 <b>Corresponde a:</b> ${escHtml(quien)}${chat}`;
  if (params.accion) {
    pie += `\n<i>(${escHtml(ETIQUETA_ACCION[params.accion])})</i>`;
  }
  return pie;
}

/** Pie con varios destinatarios (contadores, compradores). */
export function pieDestinatariosLog(
  destinatarios: DestinatarioLogPie[],
  accion: AccionDestinatarioLog,
): string {
  if (!destinatarios.length) {
    return pieDestinatarioLog({ rol: 'Sin destinatario Telegram', accion });
  }
  if (destinatarios.length === 1) {
    const d = destinatarios[0];
    return pieDestinatarioLog({
      rol: d.rol,
      nombre: d.nombre,
      chatId: d.chatId,
      accion,
    });
  }
  const lineas = destinatarios.map((d) => {
    const rol = d.rol.trim() || 'Destinatario';
    const quien = d.nombre?.trim() ? `${d.nombre.trim()} · ${rol}` : rol;
    const chat =
      d.chatId != null && String(d.chatId).trim()
        ? ` <i>(chat ${escHtml(String(Math.trunc(Number(d.chatId))))})</i>`
        : '';
    return `• ${escHtml(quien)}${chat}`;
  });
  return (
    `\n\n—\n👤 <b>Corresponde a:</b>\n${lineas.join('\n')}` +
    `\n<i>(${escHtml(ETIQUETA_ACCION[accion])})</i>`
  );
}

export type PieDestinatarioMensajeExtra = {
  rolDestinatario?: string;
  nombreDestinatario?: string | null;
  accionLogDestinatario?: AccionDestinatarioLog;
};

export function debeMostrarPieDestinatario(extra?: PieDestinatarioMensajeExtra): boolean {
  return Boolean(extra?.rolDestinatario?.trim() || extra?.accionLogDestinatario);
}

/** Anexa pie al mensaje del bot operativo (sin chat id en el pie). */
export function anexarPieDestinatarioOperativo(
  text: string,
  params: {
    rol: string;
    nombre?: string | null;
    accion?: AccionDestinatarioLog;
  },
): string {
  return text + pieDestinatarioLog({ ...params, chatId: undefined });
}
