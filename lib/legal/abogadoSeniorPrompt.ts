/**
 * Prompt del Abogado Senior (Derecho Venezolano) para respuestas RAG.
 *
 * Ensamble conceptual:
 *   context = search_results.map(r => r.content).join("\n\n")
 *   final_prompt = system_prompt_template.format({ context, user_query })
 */

/** Plantilla con placeholders {context} y {user_query}. */
export const SYSTEM_PROMPT_TEMPLATE = `Eres un Abogado Senior especialista en Derecho Venezolano con competencia en Laboral, Civil, Mercantil, Tributario, Corporativo e Internacional. Tu objetivo es redactar respuestas legales basadas EXCLUSIVAMENTE en el contexto proporcionado y en tu conocimiento legal general.

### Reglas de Operación:
1. CITACIÓN OBLIGATORIA: Siempre que respondas, debes citar el fundamento legal (Ej: "Según el Art. 142 de la LOTTT...") y, si usaste el buscador, indicar la fuente con un formato de referencia como [Fuente N: referencia / documento].
2. TONO: Profesional, técnico, preciso y empático con el cliente (empresa, empleador o particular).
3. ESTRUCTURA:
    - Identifica la rama del derecho aplicable.
    - Análisis jurídico breve.
    - Cita de la normativa vigente.
    - Recomendación práctica o solución.
    - Si vas a redactar un contrato o carta, utiliza un formato claro y divide las cláusulas.
4. SEGURIDAD LEGAL: Si el contexto no tiene suficiente información para responder con certeza, indícalo claramente: "La información disponible no permite confirmar con precisión, se recomienda verificar [X aspecto]...".
5. No inventes artículos, números de gaceta ni jurisprudencia que no aparezcan en el contexto ni sean de conocimiento general consolidado. Si dudas, declara la incertidumbre.
6. Responde siempre en español.

### Contexto Recuperado (Fragmentos de Leyes/Documentos):
{context}

### Consulta del Usuario:
{user_query}`;

/** @deprecated usar SYSTEM_PROMPT_TEMPLATE */
export const ABOGADO_SENIOR_SYSTEM = SYSTEM_PROMPT_TEMPLATE.split(
  '\n### Contexto Recuperado',
)[0]!.trim();

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

/** Une contenidos como en el backend conceptual: "\\n\\n".join(item.content). */
export function joinSearchContents(
  results: Array<{ content?: string | null }>,
): string {
  const parts = results
    .map((r) => (r.content ?? '').trim())
    .filter(Boolean);
  if (!parts.length) {
    return '(No se recuperaron fragmentos relevantes de la base de conocimiento.)';
  }
  return parts.join('\n\n');
}

/**
 * system_prompt_template.format(context=..., user_query=...)
 * Solo reemplaza {context} y {user_query}; el resto del texto se conserva.
 */
export function formatSystemPromptTemplate(
  template: string,
  vars: { context: string; user_query: string },
): string {
  return template
    .replaceAll('{context}', vars.context)
    .replaceAll('{user_query}', vars.user_query);
}

export function buildFinalAbogadoPrompt(
  userQuery: string,
  searchResults: Array<{ content?: string | null }>,
  template: string = SYSTEM_PROMPT_TEMPLATE,
): string {
  const context = joinSearchContents(searchResults);
  return formatSystemPromptTemplate(template, {
    context,
    user_query: userQuery.trim(),
  });
}

/** Formato enriquecido con etiquetas [Fuente N] (opcional para citas). */
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
  return buildFinalAbogadoPrompt(userQuery, fragments);
}
