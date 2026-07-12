import { geminiGenerateText, getGeminiApiKey } from '@/lib/gemini/client';
import { GEMINI_MODEL } from '@/lib/recruitment/constants';

const PROMPT_BASE =
  'Analiza si la distribución de niveles (ej. demasiados maestros de obra nivel 9 vs. pocos ayudantes nivel 2) es óptima para el presupuesto asignado.';

export async function analizarDistribucionNivelesNominaGemini(payload: {
  presupuestoManoObraVES: number;
  costoRealMesVES: number;
  añoMes: string;
  distribucionPorNivel: Record<string, number>;
  filasResumidas: Array<{ nombre: string; nivel: number; totalMesVES: number }>;
}): Promise<{ texto: string; desdeGemini: boolean }> {
  const userBlock = [
    PROMPT_BASE,
    '',
    'Datos de nómina mensual (JSON):',
    JSON.stringify(payload, null, 2),
    '',
    'Responde en español, en 2–4 párrafos breves, con recomendaciones accionables para el gestor de obra. Sin markdown.',
  ].join('\n');

  if (!getGeminiApiKey()) {
    return {
      desdeGemini: false,
      texto: [
        '**Modo sin GEMINI_API_KEY** — no se llamó a la API.',
        'Revisa la tabla: si hay muchos trabajadores en niveles altos (7–9) respecto a ayudantes (1–3), el costo diario convencional suele tensionar el presupuesto de mano de obra.',
        `Presupuesto referencia: ${payload.presupuestoManoObraVES.toFixed(2)} VES · Costo mes estimado: ${payload.costoRealMesVES.toFixed(2)} VES (${payload.añoMes}).`,
      ].join('\n\n'),
    };
  }

  try {
    const text = await geminiGenerateText({
      model: GEMINI_MODEL,
      prompt: `Actúa como asesor de costos de obra en Venezuela (convención colectiva construcción, tabulador por niveles). Sé concreto y conservador en conclusiones legales.\n\n${userBlock}`,
      temperature: 0.35,
      maxOutputTokens: 1024,
    });
    return { desdeGemini: true, texto: text };
  } catch (err) {
    console.error('[geminiAnalisisNivelesNomina]', err);
    return {
      desdeGemini: false,
      texto: 'No se pudo obtener análisis de Gemini en este momento. Reintenta más tarde o revisa la clave API.',
    };
  }
}
