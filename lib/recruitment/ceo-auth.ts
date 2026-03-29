import { createHmac, timingSafeEqual } from 'crypto';

const COOKIE_NAME = 'recruitment_ceo_auth';
const HMAC_SALT = 'recruitment-ceo-v1';

export function recruitmentCeoCookieName(): typeof COOKIE_NAME {
  return COOKIE_NAME;
}

export function ceoSecretConfigured(): boolean {
  return Boolean(process.env.RECRUITMENT_CEO_SECRET?.trim());
}

export function getCeoCookieValue(secret: string): string {
  return createHmac('sha256', secret).update(HMAC_SALT).digest('hex');
}

export function verifyRecruitmentCeoCookie(
  cookieValue: string | undefined,
  secret: string,
): boolean {
  if (!cookieValue || !secret) return false;
  const expected = getCeoCookieValue(secret);
  if (cookieValue.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(cookieValue, 'utf8'), Buffer.from(expected, 'utf8'));
  } catch {
    return false;
  }
}

function bearerToken(req: Request): string | null {
  const h = req.headers.get('authorization');
  if (!h?.startsWith('Bearer ')) return null;
  return h.slice(7).trim();
}

/**
 * Valida acceso CEO: mismo valor que RECRUITMENT_CEO_SECRET (Bearer, cookie o ?key=).
 */
export function verifyRecruitmentCeoAccess(
  req: Request,
  cookieValue: string | undefined,
  secret: string,
): boolean {
  const url = new URL(req.url);
  const keyParam = url.searchParams.get('key');
  if (keyParam && keyParam === secret) return true;
  const bearer = bearerToken(req);
  if (bearer && bearer === secret) return true;
  if (verifyRecruitmentCeoCookie(cookieValue, secret)) return true;
  return false;
}

export function recruitmentAllowSupabaseUser(): boolean {
  return process.env.RECRUITMENT_ALLOW_SUPABASE_USER === 'true';
}

/**
 * Acceso al dashboard / API de resultados: público si no hay puerta;
 * si hay `RECRUITMENT_CEO_SECRET` y/o `RECRUITMENT_ALLOW_SUPABASE_USER`, aplica reglas.
 */
export function verifyRecruitmentCeoAuthorized(opts: {
  req?: Request;
  cookieVal: string | undefined;
  /** `key` en query (p. ej. vista CEO sin objeto Request completo) */
  searchKey?: string | null;
  hasSupabaseUser: boolean;
}): boolean {
  const secret = process.env.RECRUITMENT_CEO_SECRET?.trim();
  const allowSupabase = recruitmentAllowSupabaseUser();
  const hasSecret = Boolean(secret);

  if (!hasSecret && !allowSupabase) return true;

  if (allowSupabase && opts.hasSupabaseUser) return true;

  if (hasSecret && secret) {
    if (opts.req && verifyRecruitmentCeoAccess(opts.req, opts.cookieVal, secret)) return true;
    if (opts.searchKey && opts.searchKey === secret) return true;
    if (!opts.req && verifyRecruitmentCeoCookie(opts.cookieVal, secret)) return true;
  }

  return false;
}
