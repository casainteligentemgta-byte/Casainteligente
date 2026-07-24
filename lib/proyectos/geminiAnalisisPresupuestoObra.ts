import { geminiGenerateText, getGeminiApiKey } from '@/lib/gemini/client';
import { GEMINI_MODEL } from '@/lib/recruitment/constants';
import { fmtMontoLulo } from '@/lib/proyectos/presupuestoCapitulosFormat';
import type { CapituloPresupuestoGrupo } from '@/lib/proyectos/presupuestoObraCalculos';

export async function analizarPresupuestoPorCapitulosGemini(input: {
  nombreObra: string;
  grupos: CapituloPresupuestoGrupo[];
  totalGeneral: number;
}): Promise<{ texto: string; desdeGemini: boolean }> {
  const lineas = input.grupos.map(
    (g) =>
      `- ${g.titulo} ${g.rango}: ${fmtMontoLulo(g.subtotal)} (${g.porcentaje.toFixed(2)}%)`,
  );

  const bloque = [
    `Obra: ${input.nombreObra}`,
    `Total presupuesto: ${fmtMontoLulo(input.totalGeneral)}`,
    `${input.grupos.length} capítulos`,
    '',
    'Resumen por capítulo:',
    ...lineas,
  ].join('\n');

  if (!getGeminiApiKey()) {
    return {
      desdeGemini: false,
      texto:
        'Modo local (sin GEMINI_API_KEY): revisa que los capítulos con mayor % (estructura, albañilería) estén alineados con el cronograma y que no falten partidas en capítulos pequeños.',
    };
  }

  try {
    const texto = await geminiGenerateText({
      model: GEMINI_MODEL,
      systemInstruction:
        'Eres ingeniero de costos en Venezuela. Analizas presupuestos de obra por capítulos (formato Lulo).',
      prompt: [
        'Analiza este presupuesto por capítulos y responde en español en 3–5 viñetas breves:',
        '1) Capítulos que concentran el costo.',
        '2) Posibles desbalances o riesgos.',
        '3) Una recomendación operativa para control de obra.',
        'Sin markdown. Solo texto plano.',
        '',
        bloque,
      ].join('\n'),
      temperature: 0.35,
      maxOutputTokens: 800,
    });
    return { desdeGemini: true, texto };
  } catch (err) {
    console.error('[geminiAnalisisPresupuestoObra]', err);
    return {
      desdeGemini: false,
      texto: 'No se pudo obtener el análisis de Gemini. Reintenta más tarde.',
    };
  }
}
