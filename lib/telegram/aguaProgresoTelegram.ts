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
  { pct: 8, texto: 'Recibiendo foto del camión de agua…', pausaMs: 350 },
  { pct: 28, texto: 'Verificando que se visualice la placa…', pausaMs: 450 },
  { pct: 52, texto: 'Procesando imagen…', pausaMs: 400 },
  { pct: 78, texto: 'Guardando en el sistema…', pausaMs: 380 },
  { pct: 100, texto: '¡Foto del camión cargada al 100%!', pausaMs: 280 },
];

const ETAPAS_INICIO_PRUEBA: EtapaMedidor[] = [
  { pct: 10, texto: 'Recibiendo foto de la prueba de agua…', pausaMs: 350 },
  { pct: 30, texto: 'Verificando imagen…', pausaMs: 400 },
  { pct: 45, texto: 'Preparando registro en el ERP…', pausaMs: 300 },
];

/** Medidor al recibir la foto del camión (paso 1). */
export async function medidorCargaFotoCamionAgua(chatId: string): Promise<MedidorCargaAgua> {
  const medidor = await crearMedidorCargaAgua(chatId, 'Foto del camión');
  await medidor.animarEtapas(ETAPAS_FOTO_CAMION);
  return medidor;
}

/** Medidor al recibir la foto de prueba (paso 2, antes de IA y storage). */
export async function medidorCargaFotoPruebaAgua(chatId: string): Promise<MedidorCargaAgua> {
  const medidor = await crearMedidorCargaAgua(chatId, 'Prueba de agua');
  await medidor.animarEtapas(ETAPAS_INICIO_PRUEBA);
  return medidor;
}
