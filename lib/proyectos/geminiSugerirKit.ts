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
  const key = process.env.GEMINI_API_KEY?.trim();
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

  if (!key) {
    return {
      desdeGemini: false,
      texto:
        'Modo local (sin GEMINI_API_KEY): no se pudo consultar IA. Recomendación base: valida EPP, herramientas de corte/medición, fijaciones, cableado, conectores, protección eléctrica y consumibles de instalación según alcance del proyecto.',
    };
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(key)}`;
  const body = {
    contents: [
      {
        role: 'user',
        parts: [{ text: block }],
      },
    ],
    generationConfig: {
      temperature: 0.35,
      maxOutputTokens: 1000,
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('[geminiSugerirKit]', res.status, err);
    return {
      desdeGemini: false,
      texto: 'No se pudo generar sugerencias en este momento. Intenta nuevamente.',
    };
  }

  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
  if (!text) {
    return { desdeGemini: false, texto: 'La IA no devolvió contenido utilizable.' };
  }
  return { desdeGemini: true, texto: text };
}
