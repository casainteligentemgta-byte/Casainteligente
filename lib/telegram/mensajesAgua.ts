/** Textos del flujo /agua en Telegram (mantener tono instructivo de campo). */

export const MSJ_AGUA_PICKER_OBRA =
  '💧 <b>Registro de agua</b>\n\n' +
  '<b>Selecciona la obra</b> en el listado de proyectos de abajo 👇';

export function mensajeObraSeleccionadaAgua(nombreObra: string): string {
  const obra = nombreObra.trim() || 'Obra';
  return (
    `🏗 Obra: <b>${obra}</b>\n\n` +
    'Paso 1 de 2 — Envía la foto del <b>camión de agua</b>.\n' +
    'Verifica que se <b>visualice la placa</b> del vehículo.'
  );
}

/** Tras cargar el camión al 100% (medidor). */
export const MSJ_AGUA_RECORDATORIO_PRUEBA =
  '✅ Foto del camión cargada correctamente.\n\n' +
  '👋 <b>¡Ey! No se te olvide</b> cargar la foto de la <b>prueba de agua</b>.\n\n' +
  'Paso 2 de 2 — Envía la foto de la prueba (medición, ticket, hidrante o comprobante en obra).';

export function textoProgresoCargaAgua(
  pct: number,
  etapa: string,
  titulo = 'Subiendo foto',
): string {
  const p = Math.max(0, Math.min(100, Math.round(pct)));
  const total = 10;
  const filled = Math.max(0, Math.min(total, Math.round((p / 100) * total)));
  const barra = `${'█'.repeat(filled)}${'░'.repeat(total - filled)}`;
  return (
    `⏳ <b>${titulo} — ${p}%</b>\n` +
    `<code>${barra}</code>\n` +
    `<i>${etapa}</i>`
  );
}
