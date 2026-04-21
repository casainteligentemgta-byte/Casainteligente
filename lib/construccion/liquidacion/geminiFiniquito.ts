import { GEMINI_MODEL } from '@/lib/recruitment/constants';
import type { ResultadoLiquidacionConstruccion } from '@/lib/construccion/liquidacion/types';

function textoFiniquitoFallback(r: ResultadoLiquidacionConstruccion, nombre?: string): string {
  const n = nombre?.trim() || 'el/la trabajador(a)';
  return `DOCUMENTO DE FINIQUITO (BORRADOR — NO LEGALIZADO)

Yo, ${n}, declaro haber recibido de la empresa, en fecha ___________, la suma de Bs. ___________ (___________________________________________), por concepto de liquidación de haberes conforme a la Ley Orgánica del Trabajo y demás normas aplicables, incluyendo en forma orientativa los conceptos simulados: prestaciones sociales, intereses, vacaciones y bono vacacional, utilidades e indemnización según el caso.

Gran total referencial de la simulación: ${r.granTotalVES.toFixed(2)} VES.

Declaro que con este pago no mantengo reclamo alguno sobre salarios, beneficios sociales o indemnizaciones, salvo los derechos que por ley no puedan renunciarse.

Firma trabajador(a): ______________________   C.I.: ________________

Firma representante patronal: ______________________   RIF: ________________

Nota: Sin GEMINI_API_KEY se usa este modelo genérico. Revise un abogado laboral antes de firmar.`;
}

/**
 * Redacta un borrador de finiquito con Gemini (texto plano, español).
 * Con `requiereGemini: true` falla si no hay API key (flujo de seguridad antes de confirmar).
 */
export async function redactarDocumentoFiniquitoConGemini(
  resultado: ResultadoLiquidacionConstruccion,
  nombreEmpleado?: string,
  opciones?: { requiereGemini?: boolean },
): Promise<{ texto: string; generadoConGemini: boolean }> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) {
    if (opciones?.requiereGemini) {
      throw new Error('GEMINI_API_KEY no configurada: no se puede redactar el finiquito con IA.');
    }
    return { texto: textoFiniquitoFallback(resultado, nombreEmpleado), generadoConGemini: false };
  }

  const prompt = `Eres abogado laboral venezolano. Redacta un DOCUMENTO DE FINIQUITO breve y formal en español, listo para imprimir, donde el trabajador declare haber recibido sus haberes conforme a la ley y a la convención colectiva de construcción 2023 en lo que corresponda.

Datos de la simulación (referencia, montos en VES):
- Días de servicio: ${resultado.entrada.diasTotalesServicio}
- Salario básico diario último: ${resultado.entrada.ultimoSalarioBasicoDiarioVES}
- Motivo de retiro: ${resultado.entrada.motivoRetiro}
- Gran total referencial: ${resultado.granTotalVES}

Desglose:
${resultado.resumenLineas.map((l) => `- ${l.concepto}: ${l.montoVES}`).join('\n')}

Nombre del trabajador (si falta, deja espacio en blanco con guiones): ${nombreEmpleado ?? '[___]'}

Requisitos:
1) Encabezado "DOCUMENTO DE FINIQUITO".
2) Declaración de recepción conforme a la ley.
3) Líneas para firma del trabajador y del patrono, fecha y cédulas/RIF.
4) Aviso de que los montos definitivos sujetan a liquidación oficial y revisión legal.
5) Sin markdown; solo texto plano.`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(key)}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.25, maxOutputTokens: 2048 },
    }),
  });

  if (!res.ok) {
    console.error('[geminiFiniquito]', res.status, await res.text());
    return { texto: textoFiniquitoFallback(resultado, nombreEmpleado), generadoConGemini: false };
  }

  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const texto = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
  if (!texto) {
    if (opciones?.requiereGemini) {
      throw new Error('Gemini devolvió un documento vacío.');
    }
    return { texto: textoFiniquitoFallback(resultado, nombreEmpleado), generadoConGemini: false };
  }
  return { texto, generadoConGemini: true };
}
