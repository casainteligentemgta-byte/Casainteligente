/**
 * TLS relajado en desarrollo (SUPABASE_DEV_INSECURE_TLS).
 * Solo servidor y NODE_ENV !== production.
 */

let tlsRelaxed = false;

export function devInsecureTlsEnabled(): boolean {
  if (typeof window !== 'undefined') return false;
  if (process.env.NODE_ENV === 'production') return false;
  const v = (process.env.SUPABASE_DEV_INSECURE_TLS ?? '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

function relaxTlsOnce(): void {
  if (tlsRelaxed || process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0') {
    tlsRelaxed = true;
    return;
  }
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  tlsRelaxed = true;
}

export function fetchWithOptionalDevTls(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  if (devInsecureTlsEnabled()) relaxTlsOnce();
  return fetch(input, init);
}
