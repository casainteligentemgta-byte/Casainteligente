/**
 * TLS relajado en desarrollo (SUPABASE_DEV_INSECURE_TLS) sin aviso de Node
 * al fijar NODE_TLS_REJECT_UNAUTHORIZED.
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
  const originalEmit = process.emit.bind(process);
  process.emit = function emitFiltered(
    event: string | symbol,
    ...args: unknown[]
  ): boolean {
    if (
      event === 'warning' &&
      args[0] &&
      typeof args[0] === 'object' &&
      'message' in args[0] &&
      String((args[0] as { message?: string }).message).includes(
        'NODE_TLS_REJECT_UNAUTHORIZED',
      )
    ) {
      return true;
    }
    return originalEmit(event, ...args);
  };
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
