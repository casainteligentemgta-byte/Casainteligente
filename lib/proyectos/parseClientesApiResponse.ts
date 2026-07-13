/** Fila mínima que esperan los selects de proyectos (label = nombre legible). */
export type ClienteApiItem = { id: string; label: string; rif?: string };

/**
 * Lee el cuerpo de `/api/proyectos/clientes` una sola vez (texto) y evita fallos si el servidor
 * devuelve HTML (p. ej. 500 genérico de Next) en lugar de JSON.
 */
export function parseClientesApiResponse(
  apiRes: Response,
  rawText: string,
): { items: ClienteApiItem[]; hint: string | null } {
  let parsed: unknown;
  try {
    parsed = rawText.length ? JSON.parse(rawText) : null;
  } catch {
    const snippet = rawText.trimStart().startsWith('<')
      ? `El servidor respondió HTML (${apiRes.status}), no JSON. Reinicia \`npm run dev\` o revisa el terminal del servidor.`
      : `Respuesta no JSON (${apiRes.status}): ${rawText.slice(0, 160)}`;
    return { items: [], hint: snippet };
  }

  if (!apiRes.ok) {
    const o = parsed as { error?: string; hint?: string } | null;
    const hint = o?.hint ?? o?.error ?? `HTTP ${apiRes.status}`;
    return { items: [], hint };
  }

  const o = parsed as { items?: ClienteApiItem[]; hint?: string } | null;
  const items = Array.isArray(o?.items) ? o!.items! : [];
  const hint = typeof o?.hint === 'string' ? o.hint : null;
  return { items, hint };
}
