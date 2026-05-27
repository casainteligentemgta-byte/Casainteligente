/**
 * `fetch` usado por Supabase: si falla la red/TLS, Node suele lanzar solo `TypeError: fetch failed`.
 * Aquí se re-lanza con texto que incluye `error.cause` cuando exista (p. ej. ENOTFOUND, certificado).
 *
 * Desarrollo local (Windows + antivirus/proxy): `SUPABASE_DEV_INSECURE_TLS=1` en `.env.local`
 * o `npm run dev:tls` — ver docs/ERROR-FETCH-FAILED-SUPABASE.md §2b.
 */
import {
  devInsecureTlsEnabled,
  fetchWithOptionalDevTls,
} from '@/lib/network/devTlsFetch';

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

function formatFetchError(err: unknown): Error {
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

  let hint =
    ' Comprueba NEXT_PUBLIC_SUPABASE_URL, .env.local en la raíz del proyecto y reinicia `npm run dev`. Red/VPN/firewall: ver docs/ERROR-FETCH-FAILED-SUPABASE.md';

  if (isTlsCertificateError(causeStr, base) && typeof window === 'undefined') {
    if (devInsecureTlsEnabled()) {
      hint +=
        ' Ya tienes SUPABASE_DEV_INSECURE_TLS=1; reinicia el servidor. Si persiste, desactiva inspección HTTPS del antivirus o usa NODE_EXTRA_CA_CERTS (§2b del doc).';
    } else {
      hint +=
        ' Certificado TLS (Windows/antivirus): añade SUPABASE_DEV_INSECURE_TLS=1 en .env.local y reinicia, o ejecuta `npm run dev:tls`. Ver docs/ERROR-FETCH-FAILED-SUPABASE.md §2b.';
    }
  }

  const msg = causeStr ? `${base} (${causeStr}).${hint}` : `${base}.${hint}`;
  return new Error(msg, { cause: err });
}

export function supabaseFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return fetchWithOptionalDevTls(input, init).catch((err: unknown) => {
    throw formatFetchError(err);
  });
}
