import {
  GEMINI_PROCUREMENT_DEFAULT_MODEL,
  procurementModelCandidates,
} from '@/lib/almacen/geminiProcurementModels';
import { geminiGenerateWithDocument } from '@/lib/gemini/client';

export type ExtraccionPlacaTanque = {
  placa_vehiculo: string | null;
  confianza: number | null;
  visible: boolean;
  notas: string | null;
};

export type ExtraccionMedicionPrueba = {
  medicion_agua: number | null;
  unidad_medicion: string | null;
  tipo_medicion: string | null;
  detalle_medicion: string | null;
  confianza: number | null;
};

export type ExtraccionRegistroAgua = {
  placa: ExtraccionPlacaTanque;
  medicion: ExtraccionMedicionPrueba;
};

const PLACA_SCHEMA = {
  type: 'object',
  properties: {
    placa_vehiculo: {
      type: 'string',
      description: 'Placa venezolana visible (ej. ABC12D, AB123CD). Vacío si no se lee.',
    },
    confianza: {
      type: 'number',
      description: 'Confianza 0 a 1 de la lectura de placa',
    },
    visible: {
      type: 'boolean',
      description: 'true si hay vehículo/camión con placa en la imagen',
    },
    notas: {
      type: 'string',
      description: 'Observaciones breves',
    },
  },
  required: ['placa_vehiculo', 'confianza', 'visible', 'notas'],
};

const MEDICION_SCHEMA = {
  type: 'object',
  properties: {
    medicion_agua: {
      type: 'number',
      description: 'Valor numérico principal (litros, m³, %, psi). null si no hay lectura clara',
    },
    unidad_medicion: {
      type: 'string',
      description: 'Unidad: L, m3, %, psi, bar, gal, etc.',
    },
    tipo_medicion: {
      type: 'string',
      description: 'Tipo: medidor, nivel_tanque, ticket_entrega, manometro, otro',
    },
    detalle_medicion: {
      type: 'string',
      description: 'Texto legible en la foto (lectura, ticket, etiqueta)',
    },
    confianza: {
      type: 'number',
      description: 'Confianza 0 a 1',
    },
  },
  required: ['medicion_agua', 'unidad_medicion', 'tipo_medicion', 'detalle_medicion', 'confianza'],
};

const PROMPT_PLACA = `Analiza esta foto de obra relacionada con suministro de agua (camión cisterna, tanque en vehículo o placa visible).

TAREA: Lee la PLACA del vehículo (matrícula venezolana). Formatos comunes: ABC12D, AB123CD, A12BC3D.
- Si la placa no es legible o no hay vehículo, placa_vehiculo = "" y visible = false.
- No inventes caracteres; solo lo que se ve con claridad razonable.
- confianza entre 0 y 1.`;

const PROMPT_MEDICION = `Analiza esta foto de PRUEBA DE AGUA en obra (medidor, ticket de entrega, nivel de tanque, manómetro, pantalla digital, etc.).

TAREA: Extrae la MEDICIÓN de agua más relevante:
- medicion_agua: número (litros entregados, m³, porcentaje de nivel, presión, etc.)
- unidad_medicion: L, m3, %, psi, bar, gal u otra
- tipo_medicion: medidor | nivel_tanque | ticket_entrega | manometro | otro
- detalle_medicion: texto o lectura tal como aparece
- Si no hay dato numérico claro, medicion_agua = null y explica en detalle_medicion.
- confianza entre 0 y 1.`;

function normalizarPlaca(raw: string | undefined): string | null {
  const t = (raw ?? '').trim().toUpperCase().replace(/\s+/g, '');
  if (!t || t.length < 4) return null;
  return t.slice(0, 12);
}

function clampConfianza(n: unknown): number | null {
  const v = Number(n);
  if (!Number.isFinite(v)) return null;
  return Math.min(1, Math.max(0, v));
}

async function geminiVisionJson<T>(
  buffer: Buffer,
  mimeType: string,
  prompt: string,
  schema: object,
): Promise<T | null> {
  const base64 = buffer.toString('base64');
  const models = procurementModelCandidates();
  let lastErr: unknown;

  for (const model of models) {
    try {
      const raw = await geminiGenerateWithDocument({
        model,
        prompt,
        mimeType,
        base64,
        systemInstruction:
          'Eres OCR de campo para construcción en Venezuela. Responde solo JSON válido según el esquema.',
        temperature: 0,
        maxOutputTokens: 1024,
        responseSchema: schema,
      });
      return JSON.parse(raw) as T;
    } catch (err) {
      lastErr = err;
      const retryable =
        err instanceof Error &&
        ((err as Error & { retryable?: boolean }).retryable ||
          /429|503|quota/i.test(err.message));
      if (!retryable && model !== GEMINI_PROCUREMENT_DEFAULT_MODEL) break;
    }
  }

  console.warn('[extractAguaGemini]', lastErr);
  return null;
}

export async function extraerPlacaDesdeFotoTanque(
  buffer: Buffer,
  mimeType: string,
): Promise<ExtraccionPlacaTanque> {
  const parsed = await geminiVisionJson<{
    placa_vehiculo?: string;
    confianza?: number;
    visible?: boolean;
    notas?: string;
  }>(buffer, mimeType, PROMPT_PLACA, PLACA_SCHEMA);

  if (!parsed) {
    return {
      placa_vehiculo: null,
      confianza: null,
      visible: false,
      notas: 'IA no disponible o sin lectura',
    };
  }

  return {
    placa_vehiculo: normalizarPlaca(parsed.placa_vehiculo),
    confianza: clampConfianza(parsed.confianza),
    visible: Boolean(parsed.visible),
    notas: parsed.notas?.trim() || null,
  };
}

export async function extraerMedicionDesdeFotoPrueba(
  buffer: Buffer,
  mimeType: string,
): Promise<ExtraccionMedicionPrueba> {
  const parsed = await geminiVisionJson<{
    medicion_agua?: number | null;
    unidad_medicion?: string;
    tipo_medicion?: string;
    detalle_medicion?: string;
    confianza?: number;
  }>(buffer, mimeType, PROMPT_MEDICION, MEDICION_SCHEMA);

  if (!parsed) {
    return {
      medicion_agua: null,
      unidad_medicion: null,
      tipo_medicion: null,
      detalle_medicion: null,
      confianza: null,
    };
  }

  const valor = parsed.medicion_agua;
  const medicion =
    valor != null && Number.isFinite(Number(valor)) ? Number(valor) : null;

  return {
    medicion_agua: medicion,
    unidad_medicion: parsed.unidad_medicion?.trim() || null,
    tipo_medicion: parsed.tipo_medicion?.trim() || null,
    detalle_medicion: parsed.detalle_medicion?.trim() || null,
    confianza: clampConfianza(parsed.confianza),
  };
}

/** Extrae placa (tanque/camión) y medición (prueba) en paralelo. */
export async function extraerDatosRegistroAguaGemini(params: {
  bufferTanque: Buffer;
  mimeTanque: string;
  bufferPrueba: Buffer;
  mimePrueba: string;
}): Promise<ExtraccionRegistroAgua> {
  const [placa, medicion] = await Promise.all([
    extraerPlacaDesdeFotoTanque(params.bufferTanque, params.mimeTanque),
    extraerMedicionDesdeFotoPrueba(params.bufferPrueba, params.mimePrueba),
  ]);
  return { placa, medicion };
}

export function formatearFechaHoraRegistroAgua(iso: string): string {
  try {
    return new Intl.DateTimeFormat('es-VE', {
      timeZone: 'America/Caracas',
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 16).replace('T', ' ');
  }
}

export function mensajeResumenExtraccionAgua(
  registradoEn: string,
  extraccion: ExtraccionRegistroAgua,
): string {
  const fecha = formatearFechaHoraRegistroAgua(registradoEn);
  const placa =
    extraccion.placa.placa_vehiculo ??
    (extraccion.placa.visible ? 'no legible' : 'no detectada');
  const med =
    extraccion.medicion.medicion_agua != null
      ? `${extraccion.medicion.medicion_agua}${extraccion.medicion.unidad_medicion ? ` ${extraccion.medicion.unidad_medicion}` : ''}`
      : extraccion.medicion.detalle_medicion?.slice(0, 80) || 'no detectada';

  return (
    '¡Éxito! Registro de agua guardado en el ERP.\n\n' +
    `📅 <b>Fecha y hora:</b> ${fecha} (VE)\n` +
    `🚛 <b>Placa:</b> ${placa}\n` +
    `💧 <b>Medición:</b> ${med}` +
    (extraccion.medicion.tipo_medicion
      ? `\n📋 <i>Tipo:</i> ${extraccion.medicion.tipo_medicion}`
      : '')
  );
}
