import { geminiGenerateText, getGeminiApiKey } from '@/lib/gemini/client';
import { GEMINI_MODEL } from '@/lib/recruitment/constants';

export type EquipoResumen = {
  nombre: string;
  marca?: string | null;
  modelo?: string | null;
  cantidad?: number | null;
};

export async function sugerirHerramientasEInsumosProyecto(payload: {
  proyecto: {
    nombre: string;
    ubicacion: string;
    observaciones?: string | null;
  };
  inventarioActual: EquipoResumen[];
}): Promise<{ texto: string; desdeGemini: boolean }> {
  const block = [
    'Eres planificador de logística de campo para obras e instalaciones en Venezuela.',
    'Analiza el proyecto y su inventario actual.',
    'Devuelve una recomendación práctica en español con esta estructura:',
    '1) Herramientas faltantes sugeridas.',
    '2) Insumos/consumibles sugeridos.',
    '3) Riesgos por faltantes críticos.',
    '4) Prioridad de carga para cuadrilla de trabajo.',
    'Sé breve, operativo y sin markdown complejo.',
    '',
    'Contexto (JSON):',
    JSON.stringify(payload, null, 2),
  ].join('\n');

  if (!getGeminiApiKey()) {
    return {
      desdeGemini: false,
      texto:
        'Modo local (sin GEMINI_API_KEY): no se pudo consultar IA. Recomendación base: valida EPP, herramientas de corte/medición, fijaciones, cableado, conectores, protección eléctrica y consumibles de instalación según alcance del proyecto.',
    };
  }

  try {
    const text = await geminiGenerateText({
      model: GEMINI_MODEL,
      prompt: block,
      temperature: 0.35,
      maxOutputTokens: 1000,
    });
    return { desdeGemini: true, texto: text };
  } catch (err) {
    console.error('[geminiSugerirKit]', err);
    return {
      desdeGemini: false,
      texto: 'No se pudo generar sugerencias en este momento. Intenta nuevamente.',
    };
  }
}
