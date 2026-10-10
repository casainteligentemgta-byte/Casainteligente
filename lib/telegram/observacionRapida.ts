/**
 * Observaciones opcionales en los flujos del bot: un toque para continuar sin escribir,
 * y una respuesta útil cuando llega una foto antes del paso de la foto.
 */

export const TEXTO_BOTON_SIN_OBSERVACIONES = '⏭ Sin observaciones';
export const TEXTO_BOTON_SIN_NOTA = '⏭ Sin nota';

export const MENSAJE_PEDIR_OBSERVACIONES =
  '📝 <b>Observaciones</b> (opcional)\n' +
  'Escriba una nota, o pulse <b>Sin observaciones</b> para continuar.';

const RESPUESTAS_SIN_OBSERVACION = new Set([
  '-',
  'no',
  'nada',
  'ninguna',
  'ninguno',
  'n/a',
  'na',
  'omitir',
  'sin nota',
  'sin observacion',
  'sin observaciones',
]);

function sinAcentos(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** El usuario escribió algo que significa «no tengo observaciones». */
export function esTextoSinObservacion(texto: string): boolean {
  const t = sinAcentos(texto.trim().toLowerCase()).replace(/[.!]+$/, '');
  return t === '' || RESPUESTAS_SIN_OBSERVACION.has(t);
}

/** Texto a guardar como observación: vacío si el usuario indicó que no tiene. */
export function observacionDesdeTexto(texto: string): string {
  return esTextoSinObservacion(texto) ? '' : texto.trim();
}

export function tecladoSinObservaciones(
  callbackData: string,
  texto: string = TEXTO_BOTON_SIN_OBSERVACIONES,
): { inline_keyboard: Array<Array<{ text: string; callback_data: string }>> } {
  return { inline_keyboard: [[{ text: texto, callback_data: callbackData }]] };
}

/**
 * Respuesta cuando llega una foto y el flujo activo todavía no la está pidiendo.
 * Antes el bot contestaba «Ya recibí la foto. Envía solo el texto de la observación»,
 * que no era cierto: la foto no se había guardado.
 */
export function mensajeFotoFueraDePaso(paso?: string | null): string {
  if (paso === 'confirmar') {
    return (
      '📷 Este movimiento ya tiene su foto.\n\n' +
      'Revise el resumen y pulse <b>Confirmar</b> en el mensaje anterior.'
    );
  }
  return (
    '📷 <b>Todavía no toca la foto</b>; esta no se guardó.\n\n' +
    'El bot la pide al final, después de elegir los materiales. ' +
    'Continúe con el último mensaje (botones o texto) y envíela cuando se la pida.'
  );
}

/**
 * Respuesta cuando la foto llega antes del paso de la foto y el flujo la acepta igual:
 * queda guardada y el bot no la vuelve a pedir.
 */
export const MENSAJE_FOTO_GUARDADA_ANTES =
  '✅ <b>Foto guardada.</b> No tendrá que enviarla de nuevo.\n\n' +
  'Continúe con el último mensaje (botones o texto).';
