/**
 * Parser puro de respuestas IurisVigía (sin dependencias de Gemini).
 */

export type EstadoCumplimientoIuris =
  | 'Conforme'
  | 'No Conforme'
  | 'Observación'
  | 'No analizable';

export type IurisVigiaReport = {
  descripcion: string;
  nota_legal: string;
  estado_cumplimiento: EstadoCumplimientoIuris | string;
  riesgo_identificado: string;
};

/** Schema Gemini para forzar JSON estructurado (mismo patrón que Metron / seriales). */
export const IURISVIGIA_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    descripcion: {
      type: 'string',
      description: 'Descripción técnica detallada de lo observado en la imagen.',
    },
    nota_legal: {
      type: 'string',
      description: 'Referencia técnica o legal (ej. Art. 62 LOPCYMAT).',
    },
    estado_cumplimiento: {
      type: 'string',
      description: 'Conforme | No Conforme | Observación | No analizable',
    },
    riesgo_identificado: {
      type: 'string',
      description: 'Riesgo técnico o legal identificado.',
    },
  },
  required: [
    'descripcion',
    'nota_legal',
    'estado_cumplimiento',
    'riesgo_identificado',
  ],
} as const;

function pickString(obj: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  }
  return '';
}

/**
 * Extrae un objeto JSON de respuestas Gemini (texto puro, fences markdown o prosa + JSON).
 */
export function extractIurisJsonObject(raw: string): Record<string, unknown> {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) throw new Error('Respuesta vacía de IurisVigía');

  const tryParse = (text: string): Record<string, unknown> | null => {
    try {
      const parsed: unknown = JSON.parse(text);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      // A veces el modelo envuelve el reporte en un array de un elemento.
      if (Array.isArray(parsed) && parsed[0] && typeof parsed[0] === 'object') {
        return parsed[0] as Record<string, unknown>;
      }
      // JSON doble-codificado
      if (typeof parsed === 'string') {
        return tryParse(parsed.trim());
      }
      return null;
    } catch {
      return null;
    }
  };

  const direct = tryParse(trimmed);
  if (direct) return direct;

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    const fromFence = tryParse(fenced[1].trim());
    if (fromFence) return fromFence;
  }

  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) {
    const fromSlice = tryParse(trimmed.slice(start, end + 1));
    if (fromSlice) return fromSlice;
  }

  throw new Error('No se pudo parsear JSON de IurisVigía');
}

/** Normaliza la respuesta del modelo al reporte IurisVigía. */
export function parseIurisVigiaReport(raw: string): IurisVigiaReport {
  const parsed = extractIurisJsonObject(raw);
  const descripcion = pickString(parsed, [
    'descripcion',
    'descripción',
    'description',
    'detalle',
  ]);
  const nota_legal = pickString(parsed, [
    'nota_legal',
    'notaLegal',
    'nota legal',
    'referencia_legal',
    'referenciaLegal',
    'legal_note',
  ]);
  const estado_cumplimiento = pickString(parsed, [
    'estado_cumplimiento',
    'estadoCumplimiento',
    'estado',
    'cumplimiento',
    'status',
  ]);
  const riesgo_identificado = pickString(parsed, [
    'riesgo_identificado',
    'riesgoIdentificado',
    'riesgo',
    'risk',
  ]);

  return {
    descripcion: descripcion || 'No analizable',
    nota_legal: nota_legal || 'No analizable',
    estado_cumplimiento: estado_cumplimiento || 'No analizable',
    riesgo_identificado: riesgo_identificado || 'No analizable',
  };
}
