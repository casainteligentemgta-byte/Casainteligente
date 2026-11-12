/**
 * Si la invocación actual no da para el siguiente intento de OCR, dispara
 * una petición interna protegida a `/api/cron/facturas-ocr-reintentos?id=…`
 * en segundos (waitUntil / after), no al día siguiente.
 * El cron diario de vercel.json queda como red de seguridad.
 */

export const ESPERA_ENCADENADO_MS = 2_000;
export const RUTA_REINTENTO_OCR = '/api/cron/facturas-ocr-reintentos';

export function originAppParaEncadenado(
  env: Record<string, string | undefined> = process.env,
): string {
  const fromPublic = (env.NEXT_PUBLIC_BASE_URL ?? env.NEXT_PUBLIC_APP_URL ?? '').trim();
  if (fromPublic) return fromPublic.replace(/\/$/, '');
  const vercel = (env.VERCEL_URL ?? '').trim();
  if (vercel) {
    return (vercel.startsWith('http') ? vercel : `https://${vercel}`).replace(/\/$/, '');
  }
  return 'https://casainteligente.company';
}

export function urlReintentoOcrEncadenado(opts: {
  pendingId: string;
  origin?: string;
  env?: Record<string, string | undefined>;
}): string {
  const origin = (opts.origin ?? originAppParaEncadenado(opts.env)).replace(/\/$/, '');
  const id = encodeURIComponent(opts.pendingId.trim());
  return `${origin}${RUTA_REINTENTO_OCR}?id=${id}`;
}

/** waitUntil de Vercel si existe; si no, deja el promise vivo en este proceso. */
export function continuarTrasResponder(trabajo: Promise<unknown>): void {
  try {
    const holder = (globalThis as Record<PropertyKey, unknown>)[
      Symbol.for('@vercel/request-context')
    ] as { get?: () => { waitUntil?: (p: Promise<unknown>) => void } } | undefined;
    const waitUntil = holder?.get?.()?.waitUntil;
    if (typeof waitUntil === 'function') {
      waitUntil(trabajo);
      return;
    }
  } catch {
    /* local / tests */
  }
  void trabajo;
}

export async function dispararReintentoOcrEncadenado(opts: {
  pendingId: string;
  origin?: string;
  secret?: string;
  env?: Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
}): Promise<{ ok: boolean; saltado?: string; status?: number }> {
  const env = opts.env ?? process.env;
  const secret = (opts.secret ?? env.CRON_SECRET ?? '').trim();
  const id = opts.pendingId.trim();
  if (!id) return { ok: false, saltado: 'sin-id' };
  if (!secret && env.NODE_ENV === 'production' && env.VERCEL_ENV === 'production') {
    console.warn('[encadenarReintentoOcrPronto] falta CRON_SECRET');
    return { ok: false, saltado: 'sin-secret' };
  }
  const url = urlReintentoOcrEncadenado({
    pendingId: id,
    origin: opts.origin,
    env,
  });
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (secret) headers.authorization = `Bearer ${secret}`;
  const res = await (opts.fetchImpl ?? fetch)(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ pendingId: id }),
    cache: 'no-store',
  });
  if (!res.ok) {
    console.warn('[encadenarReintentoOcrPronto] HTTP', res.status);
  }
  return { ok: res.ok, status: res.status };
}

/**
 * Encola el reintento restante para esta factura en segundos, con la foto
 * ya guardada. No loguea el secreto.
 */
export function encadenarReintentoOcrPronto(opts: {
  pendingId: string;
  esperaMs?: number;
  origin?: string;
  secret?: string;
  env?: Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
  dormir?: (ms: number) => Promise<void>;
  continuar?: (trabajo: Promise<unknown>) => void;
}): void {
  const espera = opts.esperaMs ?? ESPERA_ENCADENADO_MS;
  const dormir =
    opts.dormir ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const trabajo = (async () => {
    if (espera > 0) await dormir(espera);
    await dispararReintentoOcrEncadenado({
      pendingId: opts.pendingId,
      origin: opts.origin,
      secret: opts.secret,
      env: opts.env,
      fetchImpl: opts.fetchImpl,
    });
  })().catch((e) => {
    console.warn(
      '[encadenarReintentoOcrPronto]',
      e instanceof Error ? e.message : 'falló el encadenado',
    );
  });
  (opts.continuar ?? continuarTrasResponder)(trabajo);
}
