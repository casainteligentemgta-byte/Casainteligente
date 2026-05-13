/**
 * `fetch` usado por Supabase: si falla la red/TLS, Node suele lanzar solo `TypeError: fetch failed`.
 * Aquí se re-lanza con texto que incluye `error.cause` cuando exista (p. ej. ENOTFOUND, certificado).
 */
export function supabaseFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return fetch(input, init).catch((err: unknown) => {
    const base = err instanceof Error ? err.message : String(err);
    let causeStr = '';
    const c = err instanceof Error ? err.cause : undefined;
    if (c instanceof Error) {
      causeStr = c.message;
    } else if (c != null && typeof c === 'object' && 'code' in c) {
      causeStr = String((c as { code?: unknown }).code ?? c);
    } else if (c != null) {
      causeStr = String(c);
    }
    const hint =
      ' Comprueba NEXT_PUBLIC_SUPABASE_URL, .env.local en la raíz del proyecto y reinicia `npm run dev`. Red/VPN/firewall: ver docs/ERROR-FETCH-FAILED-SUPABASE.md';
    const msg = causeStr ? `${base} (${causeStr}).${hint}` : `${base}.${hint}`;
    throw new Error(msg, { cause: err });
  });
}
