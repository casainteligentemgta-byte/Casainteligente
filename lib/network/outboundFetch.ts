/**
 * fetch saliente en servidor (Gemini, etc.) con mensajes claros si falla red/TLS.
 * Misma política TLS dev que supabaseFetch (SUPABASE_DEV_INSECURE_TLS / dev:tls).
 */

function isTlsCertificateError(causeStr: string, base: string): boolean {
  const s = `${base} ${causeStr}`.toLowerCase();
  return (
    s.includes('unable to verify') ||
    s.includes('unable to get local issuer') ||
    s.includes('self signed') ||
    s.includes('certificate') ||
    s.includes('cert_')
  );
}

function devInsecureTlsEnabled(): boolean {
  if (typeof window !== 'undefined') return false;
  if (process.env.NODE_ENV !== 'development') return false;
  const v = (process.env.SUPABASE_DEV_INSECURE_TLS ?? '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

if (devInsecureTlsEnabled() && process.env.NODE_TLS_REJECT_UNAUTHORIZED !== '0') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  console.warn(
    '[outboundFetch] SUPABASE_DEV_INSECURE_TLS activo → NODE_TLS_REJECT_UNAUTHORIZED=0 (solo desarrollo).'
  );
}

export function formatOutboundFetchError(err: unknown, context: string): Error {
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

  let hint = ` (${context}). Compruebe internet, VPN/firewall y reinicie npm run dev.`;

  if (isTlsCertificateError(causeStr, base) && typeof window === 'undefined') {
    if (devInsecureTlsEnabled()) {
      hint += ' TLS dev activo; reinicie el servidor.';
    } else {
      hint +=
        ' Error de certificado: añada SUPABASE_DEV_INSECURE_TLS=1 en .env.local o use npm run dev:tls.';
    }
  }

  const msg = causeStr ? `${base} (${causeStr})${hint}` : `${base}${hint}`;
  return new Error(msg, { cause: err });
}

export function outboundFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
  context = 'conexión externa'
): Promise<Response> {
  return fetch(input, init).catch((err: unknown) => {
    throw formatOutboundFetchError(err, context);
  });
}
