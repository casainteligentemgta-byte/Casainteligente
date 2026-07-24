/** Textos del flujo /agua en Telegram (cortos, tono de campo). */

export const MSJ_AGUA_PICKER_OBRA = '💧 <b>Agua</b> — selecciona la obra 👇';

export function mensajeObraSeleccionadaAgua(nombreObra: string): string {
  const obra = nombreObra.trim() || 'Obra';
  return `🏗 <b>${obra}</b>\n1/3 Foto del <b>camión</b> (con <b>placa</b>).`;
}

export const MSJ_AGUA_RECORDATORIO_PRUEBA =
  '✅ Camión listo.\n👋 <b>¡Ey!</b> Sube la <b>prueba de minerales</b> (medidor azul, PPM).';

export const MSJ_AGUA_PEDIR_LITROS =
  '✅ Prueba cargada.\n3/3 Escribe los <b>litros entregados</b> (solo número, ej. <code>1500</code>).';

export function textoProgresoCargaAgua(
  pct: number,
  etapa: string,
  titulo = 'Carga',
): string {
  const p = Math.max(0, Math.min(100, Math.round(pct)));
  const total = 8;
  const filled = Math.max(0, Math.min(total, Math.round((p / 100) * total)));
  const barra = `${'█'.repeat(filled)}${'░'.repeat(total - filled)}`;
  return `⏳ <b>${titulo} ${p}%</b>\n<code>${barra}</code>\n<i>${etapa}</i>`;
}

export function mensajeRegistroAguaCompleto(params: {
  fecha: string;
  placa: string;
  litros: number;
  ppm: string;
}): string {
  return (
    '✅ <b>Agua guardada</b>\n' +
    `📅 ${params.fecha}\n` +
    `🚛 ${params.placa}\n` +
    `🛢 <b>${params.litros.toLocaleString('es-VE')} L</b>\n` +
    `🔬 PPM: ${params.ppm}`
  );
}
