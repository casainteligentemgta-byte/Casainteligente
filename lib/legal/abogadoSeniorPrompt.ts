/**
 * Prompt del Abogado Senior (Derecho Venezolano) para respuestas RAG.
 */

export const ABOGADO_SENIOR_SYSTEM = `Eres un Abogado Senior especialista en Derecho Venezolano. Tu objetivo es redactar respuestas legales basadas EXCLUSIVAMENTE en el contexto proporcionado y en tu conocimiento legal general.

### Reglas de Operación:
1. CITACIÓN OBLIGATORIA: Siempre que respondas, debes citar el fundamento legal (Ej: "Según el Art. 142 de la LOTTT...") y, si usaste el buscador, indicar la fuente con un formato de referencia como [Fuente N: referencia / documento].
2. TONO: Profesional, técnico, preciso y empático con el cliente (el empleador).
3. ESTRUCTURA:
    - Análisis jurídico breve.
    - Cita de la normativa vigente.
    - Recomendación práctica o solución.
    - Si vas a redactar un contrato, utiliza un formato claro y divide las cláusulas.
4. SEGURIDAD LEGAL: Si el contexto no tiene suficiente información para responder con certeza, indícalo claramente: "La información disponible no permite confirmar con precisión, se recomienda verificar [X aspecto]...".
5. No inventes artículos, números de gaceta ni jurisprudencia que no aparezcan en el contexto ni sean de conocimiento general consolidado. Si dudas, declara la incertidumbre.
6. Responde siempre en español.`;

export type ContextoLegalFragmento = {
  index: number;
  content: string;
  referencia?: string | null;
  source?: string | null;
  categoria?: string | null;
  tipo?: string | null;
  jurisdiccion?: string | null;
  similarity?: number | null;
};

export function formatContextoLegal(fragments: ContextoLegalFragmento[]): string {
  if (!fragments.length) {
    return '(No se recuperaron fragmentos relevantes de la base de conocimiento.)';
  }

  return fragments
    .map((f) => {
      const ref =
        f.referencia?.trim() ||
        f.source?.trim() ||
        'Documento sin referencia';
      const meta = [
        f.categoria && `categoría: ${f.categoria}`,
        f.tipo && `tipo: ${f.tipo}`,
        f.jurisdiccion && `jurisdicción: ${f.jurisdiccion}`,
        typeof f.similarity === 'number' &&
          `similitud: ${(f.similarity * 100).toFixed(1)}%`,
      ]
        .filter(Boolean)
        .join(' · ');
      return `[Fuente ${f.index}: ${ref}]${meta ? `\n(${meta})` : ''}\n${f.content.trim()}`;
    })
    .join('\n\n---\n\n');
}

export function buildAbogadoSeniorUserPrompt(
  userQuery: string,
  fragments: ContextoLegalFragmento[],
): string {
  const context = formatContextoLegal(fragments);
  return `### Contexto Recuperado (Fragmentos de Leyes/Documentos):
${context}

### Consulta del Usuario:
${userQuery.trim()}`;
}
