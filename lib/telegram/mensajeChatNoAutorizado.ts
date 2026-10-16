/**
 * Respuesta a un chat que el bot no conoce. Incluye su número de chat: es lo que el
 * administrador debe cargar en la nómina de la obra (o en Configuración → Telegram)
 * para darle acceso, y sin él no hay forma sencilla de averiguarlo.
 */
export function mensajeChatNoAutorizado(
  chatId: string | number,
  opts?: { conBotonCompartir?: boolean },
): string {
  const compartir = opts?.conBotonCompartir
    ? 'Si su teléfono ya está cargado en la nómina de la obra, toque <b>«📱 Compartir mi número»</b> ' +
      'aquí abajo y quedará registrado al instante.\n\n'
    : '';
  return (
    '⛔ Este chat todavía no está autorizado.\n\n' +
    compartir +
    `Su número de chat es: <code>${String(chatId).replace(/[^0-9-]/g, '')}</code>\n\n` +
    (opts?.conBotonCompartir ? 'Si no, envíeselo' : 'Envíeselo') +
    ' al administrador para que lo registre en la nómina de la obra. ' +
    'Cuando le confirme, escriba /start de nuevo.'
  );
}
