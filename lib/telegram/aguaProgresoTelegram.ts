import {
  editTelegramMessage,
  sendTelegramMessageWithId,
} from '@/lib/telegram/botApi';
import { textoProgresoCargaAgua } from '@/lib/telegram/mensajesAgua';

type EtapaMedidor = { pct: number; texto: string; pausaMs?: number };

export type MedidorCargaAgua = {
  reportar: (pct: number, etapa: string) => Promise<void>;
  animarEtapas: (etapas: EtapaMedidor[]) => Promise<void>;
  finalizar: (textoHtml: string) => Promise<void>;
  error: (texto: string) => Promise<void>;
};

/** Medidor de porcentaje editable en el chat (una sola burbuja). */
export async function crearMedidorCargaAgua(
  chatId: string,
  titulo: string,
): Promise<MedidorCargaAgua> {
  let messageId: number | null = null;

  async function reportar(pct: number, etapa: string): Promise<void> {
    const html = textoProgresoCargaAgua(pct, etapa, titulo);
    if (messageId == null) {
      messageId = await sendTelegramMessageWithId(chatId, html, { parse_mode: 'HTML' });
    } else {
      await editTelegramMessage(chatId, messageId, html, { parse_mode: 'HTML' });
    }
  }

  async function animarEtapas(etapas: EtapaMedidor[]): Promise<void> {
    for (const step of etapas) {
      await reportar(step.pct, step.texto);
      if (step.pausaMs && step.pausaMs > 0) {
        await new Promise((r) => setTimeout(r, step.pausaMs));
      }
    }
  }

  async function finalizar(textoHtml: string): Promise<void> {
    if (messageId != null) {
      await editTelegramMessage(chatId, messageId, textoHtml, { parse_mode: 'HTML' });
    } else {
      await sendTelegramMessageWithId(chatId, textoHtml, { parse_mode: 'HTML' });
    }
  }

  async function error(texto: string): Promise<void> {
    const html = `❌ ${texto}`;
    if (messageId != null) {
      await editTelegramMessage(chatId, messageId, html, { parse_mode: 'HTML' });
    } else {
      await sendTelegramMessageWithId(chatId, html, { parse_mode: 'HTML' });
    }
  }

  return { reportar, animarEtapas, finalizar, error };
}

const ETAPAS_FOTO_CAMION: EtapaMedidor[] = [
  { pct: 15, texto: 'Recibiendo…', pausaMs: 300 },
  { pct: 40, texto: 'Placa…', pausaMs: 350 },
  { pct: 70, texto: 'Guardando…', pausaMs: 320 },
  { pct: 100, texto: 'Listo', pausaMs: 220 },
];

const ETAPAS_INICIO_PRUEBA: EtapaMedidor[] = [
  { pct: 20, texto: 'Recibiendo…', pausaMs: 300 },
  { pct: 45, texto: 'Verificando…', pausaMs: 320 },
];

/** Medidor al recibir la foto del camión (paso 1). */
export async function medidorCargaFotoCamionAgua(chatId: string): Promise<MedidorCargaAgua> {
  const medidor = await crearMedidorCargaAgua(chatId, 'Camión');
  await medidor.animarEtapas(ETAPAS_FOTO_CAMION);
  return medidor;
}

/** Medidor al recibir la foto de prueba (paso 2, antes de IA y storage). */
export async function medidorCargaFotoPruebaAgua(chatId: string): Promise<MedidorCargaAgua> {
  const medidor = await crearMedidorCargaAgua(chatId, 'PPM');
  await medidor.animarEtapas(ETAPAS_INICIO_PRUEBA);
  return medidor;
}
