import { geminiGenerateText, getGeminiApiKey } from '@/lib/gemini/client';
import { GEMINI_MODEL } from '@/lib/recruitment/constants';
import type { RolExamenPsique } from '@/lib/talento/psique/recomendarPruebasPsique';
import { esRolExamenCanonico } from '@/lib/talento/rolesExamenCatalogo';

/**
 * Ajuste opcional con Gemini del banco de examen a partir del cargo.
 * Si no hay API key o falla, devuelve null (se usa heurística/RPC).
 */
export async function geminiAfinarRolExamen(opts: {
  cargo: string;
  tipoPersonal: 'obrero' | 'empleado';
  rolHeuristico: RolExamenPsique;
}): Promise<{ rol: RolExamenPsique; desdeGemini: boolean; nota?: string } | null> {
  if (!getGeminiApiKey()) return null;

  const prompt = [
    'Eres Psique, agente de talento de una empresa de construcción en Venezuela.',
    'Dado el cargo y el tipo de personal, elige UN solo banco de examen canónico.',
    'Bancos válidos exactamente: obrero | vigilante | tecnico | empleado | programador',
    '',
    'Reglas:',
    '- Obrero de oficio de tabulador GOE → obrero (salvo vigilante o roles muy técnicos de campo → tecnico).',
    '- Vigilante / seguridad → vigilante.',
    '- Oficina administrativa (contador, ayudante, administrador) → empleado.',
    '- TI / programador → programador.',
    '- Dibujante, ingeniero, arquitecto, residente → tecnico.',
    '',
    `Tipo personal: ${opts.tipoPersonal}`,
    `Cargo: ${opts.cargo}`,
    `Heurística local: ${opts.rolHeuristico}`,
    '',
    'Responde SOLO JSON: {"rol":"obrero|vigilante|tecnico|empleado|programador","nota":"máx 12 palabras"}',
  ].join('\n');

  try {
    const text = await geminiGenerateText({
      model: GEMINI_MODEL,
      prompt,
      temperature: 0.1,
      maxOutputTokens: 120,
    });
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return null;
    const parsed = JSON.parse(m[0]) as { rol?: string; nota?: string };
    const rol = String(parsed.rol ?? '').trim();
    if (!esRolExamenCanonico(rol)) return null;
    return {
      rol,
      desdeGemini: true,
      nota: parsed.nota ? String(parsed.nota).slice(0, 80) : undefined,
    };
  } catch (e) {
    console.warn('[psique/geminiAfinarRol]', e instanceof Error ? e.message : e);
    return null;
  }
}
