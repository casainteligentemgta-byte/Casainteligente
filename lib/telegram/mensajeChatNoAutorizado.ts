/**
 * Respuesta a un chat que el bot no conoce. Incluye su número de chat: es lo que el
 * administrador debe cargar en la nómina de la obra (o en Configuración → Telegram)
 * para darle acceso, y sin él no hay forma sencilla de averiguarlo.
 */
export function mensajeChatNoAutorizado(chatId: string | number): string {
  return (
    '⛔ Este chat todavía no está autorizado.\n\n' +
    `Su número de chat es: <code>${String(chatId).replace(/[^0-9-]/g, '')}</code>\n\n` +
    'Envíeselo al administrador para que lo registre en la nómina de la obra. ' +
    'Cuando le confirme, escriba /start de nuevo.'
  );
}
