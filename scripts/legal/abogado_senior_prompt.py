"""Prompt del Abogado Senior — ensamble conceptual RAG + OpenAI."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

SYSTEM_PROMPT_TEMPLATE = """Eres un Abogado Senior especialista en Derecho Venezolano. Tu objetivo es redactar respuestas legales basadas EXCLUSIVAMENTE en el contexto proporcionado y en tu conocimiento legal general.

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
6. Responde siempre en español.

### Contexto Recuperado (Fragmentos de Leyes/Documentos):
{context}

### Consulta del Usuario:
{user_query}
"""


def assemble_final_prompt(
    search_results: List[Dict[str, Any]],
    user_query: str,
    template: str = SYSTEM_PROMPT_TEMPLATE,
) -> str:
    """
    context = "\\n\\n".join([item['content'] for item in search_results])
    final_prompt = system_prompt_template.format(context=context, user_query=user_query)
    """
    context = "\n\n".join(
        (item.get("content") or "").strip()
        for item in search_results
        if (item.get("content") or "").strip()
    )
    if not context:
        context = "(No se recuperaron fragmentos relevantes de la base de conocimiento.)"
    return template.format(context=context, user_query=user_query.strip())


def ask_abogado_senior(
    openai_client: Any,
    search_results: List[Dict[str, Any]],
    user_query: str,
    *,
    model: str = "gpt-4o",
) -> str:
    """Llamada a la IA con el prompt ensamblado (role=system)."""
    final_prompt = assemble_final_prompt(search_results, user_query)
    response = openai_client.chat.completions.create(
        model=model,
        messages=[{"role": "system", "content": final_prompt}],
    )
    return (response.choices[0].message.content or "").strip()
