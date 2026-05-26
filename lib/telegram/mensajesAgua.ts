/** Textos del flujo /agua en Telegram (mantener tono instructivo de campo). */

export const MSJ_AGUA_PICKER_OBRA =
  '💧 <b>Registro de agua</b>\n\nSelecciona la obra en la lista:';

export const MSJ_AGUA_FOTO_CAMION =
  'Por favor, toma foto del <b>camión de agua</b>. Verifica que se <b>visualice la placa</b>.';

export const MSJ_AGUA_FOTO_PRUEBA =
  'Recuerda verificar el agua y no te olvides de cargar la foto.';

export function textoProgresoCargaAgua(pct: number, etapa: string): string {
  const p = Math.max(0, Math.min(100, Math.round(pct)));
  const total = 10;
  const filled = Math.max(0, Math.min(total, Math.round((p / 100) * total)));
  const barra = `${'█'.repeat(filled)}${'░'.repeat(total - filled)}`;
  return (
    `⏳ <b>Subiendo foto… ${p}%</b>\n` +
    `<code>${barra}</code>\n` +
    `<i>${etapa}</i>`
  );
}
