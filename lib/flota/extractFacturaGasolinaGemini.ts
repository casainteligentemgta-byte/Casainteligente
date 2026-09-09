import {
  GEMINI_PROCUREMENT_DEFAULT_MODEL,
  procurementModelCandidates,
} from '@/lib/almacen/geminiProcurementModels';
import { geminiGenerateWithDocument, getGeminiApiKey } from '@/lib/gemini/client';
import {
  MAX_BYTES_FACTURA_GASOLINA,
  parseJsonFacturaGasolina,
  parsearExtraccionFacturaGasolina,
  type ExtraccionFacturaGasolina,
} from '@/lib/flota/extractFacturaGasolina';

const PROMPT = `Lee esta foto o PDF de una factura, ticket o vale de gasolina / diésel en Venezuela
(PDVSA, estación privada, ticket fiscal o comprobante de carga).

Extrae SOLO lo que se ve. No inventes.

Campos:
- fecha: emisión o carga, preferible YYYY-MM-DD. Si está en DD/MM/AAAA, conviértela.
- litros: volumen cargado. Si está en galones, pon el número original y unidad_volumen="gal".
- unidad_volumen: "L" o "gal"
- monto_usd: total en dólares si aparece (USD, $). 0 si no hay.
- monto_bs: total en bolívares (Bs, VES) si aparece. 0 si no hay.
- estacion: nombre de la estación de servicio / bomba (ej. PDVSA La California, Estación El Recreo).
- tipo_gasolina: regular (91), premium (95) o diesel (gasoil). Vacío si no se distingue.
- placa: placa del vehículo si aparece.
- numero_factura: número de factura o ticket si aparece.
- confianza: 0 a 100.
- es_factura_combustible: false si el documento NO es una carga de combustible.
- notas: observaciones breves (moneda poco clara, ticket cortado, etc.).

Si hay total en USD y en Bs, reporta ambos. El total de la carga (no el precio por litro) va en monto_*.`;

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    fecha: { type: 'string', description: 'Fecha YYYY-MM-DD o DD/MM/YYYY' },
    litros: { type: 'number', description: 'Volumen cargado; 0 si no aparece' },
    unidad_volumen: { type: 'string', description: 'L o gal' },
    monto_usd: { type: 'number', description: 'Total USD; 0 si no aparece' },
    monto_bs: { type: 'number', description: 'Total bolívares; 0 si no aparece' },
    estacion: { type: 'string', description: 'Nombre de la estación de servicio' },
    tipo_gasolina: { type: 'string', description: 'regular, premium o diesel' },
    placa: { type: 'string', description: 'Placa si aparece' },
    numero_factura: { type: 'string', description: 'Número de ticket o factura' },
    confianza: { type: 'number', description: 'Confianza 0 a 100' },
    es_factura_combustible: { type: 'boolean' },
    notas: { type: 'string' },
  },
  required: [
    'fecha',
    'litros',
    'unidad_volumen',
    'monto_usd',
    'monto_bs',
    'estacion',
    'tipo_gasolina',
    'placa',
    'numero_factura',
    'confianza',
    'es_factura_combustible',
    'notas',
  ],
};

export async function extraerFacturaGasolinaDesdeArchivo(params: {
  buffer: Buffer;
  mimeType: string;
  fileName?: string;
}): Promise<{ data: ExtraccionFacturaGasolina; modelUsed: string }> {
  if (params.buffer.length > MAX_BYTES_FACTURA_GASOLINA) {
    throw new Error('La foto supera el límite de 10 MB. Use una imagen más liviana.');
  }
  if (!getGeminiApiKey()) {
    throw new Error(
      'GEMINI_API_KEY no está configurada. Añádala en .env.local para leer facturas de gasolina.',
    );
  }

  const base64 = params.buffer.toString('base64');
  const models = procurementModelCandidates();
  let text = '';
  let modelUsed = '';
  let lastError: Error | null = null;

  for (const model of models) {
    try {
      text = await geminiGenerateWithDocument({
        model,
        prompt: PROMPT,
        mimeType: params.mimeType,
        base64,
        systemInstruction:
          'Eres OCR de tickets de gasolina en Venezuela. Responde solo JSON válido según el esquema. No inventes montos ni litros.',
        temperature: 0,
        maxOutputTokens: 1024,
        responseSchema: RESPONSE_SCHEMA,
      });
      modelUsed = model;
      break;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const retryable = (err as { retryable?: boolean }).retryable === true;
      if (!retryable && model !== GEMINI_PROCUREMENT_DEFAULT_MODEL) break;
    }
  }

  if (!text) {
    throw lastError ?? new Error('No se pudo leer la factura de gasolina.');
  }

  const data = parsearExtraccionFacturaGasolina(parseJsonFacturaGasolina(text));
  if (!data.es_factura_combustible) {
    throw new Error(
      'La foto no parece una factura o ticket de gasolina. Tome de nuevo el comprobante de la carga.',
    );
  }
  if (!data.fecha && data.litros == null && data.monto_usd == null && data.monto_bs == null && !data.estacion) {
    throw new Error(
      'No se pudieron leer datos. Tome la foto de frente, con buena luz y el ticket completo.',
    );
  }

  return { data, modelUsed };
}
