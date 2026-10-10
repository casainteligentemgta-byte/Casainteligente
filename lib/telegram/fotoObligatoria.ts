/**
 * Regla de almacén: todo movimiento de material (recepción, salida, traspaso) lleva
 * registro fotográfico. Una sola fuente para los flujos del bot.
 *
 * Válvula de emergencia: `TELEGRAM_FOTO_OPCIONAL=1` devuelve los flujos a «foto opcional»
 * (p. ej. si el almacenamiento de fotos está caído y no se puede parar la obra).
 */
export function fotoMovimientoObligatoria(): boolean {
  const v = process.env.TELEGRAM_FOTO_OPCIONAL?.trim().toLowerCase();
  return !(v === '1' || v === 'true' || v === 'si' || v === 'sí');
}

/** Sufijo para títulos de paso: «(obligatoria)» u «(opcional)». */
export function etiquetaRequisitoFoto(): string {
  return fotoMovimientoObligatoria() ? '(obligatoria)' : '(opcional)';
}

/** Alerta corta para `answerCallbackQuery` (límite de Telegram: 200 caracteres). */
export const ALERTA_FOTO_OBLIGATORIA =
  'La foto es obligatoria. Envíela al chat para continuar.';

export const MENSAJE_FOTO_OBLIGATORIA =
  '📷 La <b>foto es obligatoria</b> para registrar el movimiento.\n' +
  'Envíela a este chat para continuar, o <code>/cancelar</code> para abortar.';

/** ¿Se puede avanzar con esta cantidad de fotos? */
export function fotosSuficientes(cantidadFotos: number): boolean {
  return !fotoMovimientoObligatoria() || cantidadFotos > 0;
}
