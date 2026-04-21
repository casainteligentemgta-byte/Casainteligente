import { GEMINI_MODEL } from '@/lib/recruitment/constants';

const PROMPT_BASE =
  'Analiza si la distribución de niveles (ej. demasiados maestros de obra nivel 9 vs. pocos ayudantes nivel 2) es óptima para el presupuesto asignado.';

/**
 * Envía a Gemini el contexto de nómina mensual y la distribución por nivel (obreros en obra).
 * Sin `GEMINI_API_KEY` devuelve texto genérico local.
 */
export async function analizarDistribucionNivelesNominaGemini(payload: {
  presupuestoManoObraVES: number;
  costoRealMesVES: number;
  añoMes: string;
  distribucionPorNivel: Record<string, number>;
  filasResumidas: Array<{ nombre: string; nivel: number; totalMesVES: number }>;
}): Promise<{ texto: string; desdeGemini: boolean }> {
  const key = process.env.GEMINI_API_KEY?.trim();
  const userBlock = [
    PROMPT_BASE,
    '',
    'Datos de nómina mensual (JSON):',
    JSON.stringify(payload, null, 2),
    '',
    'Responde en español, en 2–4 párrafos breves, con recomendaciones accionables para el gestor de obra. Sin markdown.',
  ].join('\n');

  if (!key) {
    return {
      desdeGemini: false,
      texto: [
        '**Modo sin GEMINI_API_KEY** — no se llamó a la API.',
        'Revisa la tabla: si hay muchos trabajadores en niveles altos (7–9) respecto a ayudantes (1–3), el costo diario convencional suele tensionar el presupuesto de mano de obra.',
        `Presupuesto referencia: ${payload.presupuestoManoObraVES.toFixed(2)} VES · Costo mes estimado: ${payload.costoRealMesVES.toFixed(2)} VES (${payload.añoMes}).`,
      ].join('\n\n'),
    };
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(key)}`;

  const body = {
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `Actúa como asesor de costos de obra en Venezuela (convención colectiva construcción, tabulador por niveles). Sé concreto y conservador en conclusiones legales.\n\n${userBlock}`,
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.35,
      maxOutputTokens: 1024,
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('[geminiAnalisisNivelesNomina]', res.status, err);
    return {
      desdeGemini: false,
      texto: 'No se pudo obtener análisis de Gemini en este momento. Reintenta más tarde o revisa la clave API.',
    };
  }

  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
  if (!text) {
    return { desdeGemini: false, texto: 'Gemini no devolvió texto utilizable.' };
  }
  return { desdeGemini: true, texto: text };
}
