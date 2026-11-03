/**
 * Token firmado para que el cliente abra el documento sin sesión.
 * No guarda secretos en la URL: HMAC del id del presupuesto.
 */
import { createHmac, timingSafeEqual } from 'crypto';
import { resolveSupabaseServiceRoleKey } from '@/lib/supabase/resolveServiceRoleKey';

const PREFIJO = 'presupuesto-documento:v1:';

export function secretoDocumentoPresupuesto(): string {
  const env = process.env.PRESUPUESTOS_DOCUMENTO_SECRET?.trim();
  if (env) return env;
  const sr = resolveSupabaseServiceRoleKey();
  if (sr) return sr;
  return 'dev-presupuesto-documento';
}

function hmacHex(id: string, secreto: string): string {
  return createHmac('sha256', secreto).update(`${PREFIJO}${id}`).digest('hex');
}

function igual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/** `uuid.firma`. La firma cubre el id; adivinar el UUID no basta para abrir el documento. */
export function firmarDocumentoPresupuesto(
  budgetId: string,
  secreto: string = secretoDocumentoPresupuesto(),
): string {
  const id = String(budgetId ?? '').trim();
  if (!id) return '';
  return `${id}.${hmacHex(id, secreto).slice(0, 32)}`;
}

export function leerDocumentoPresupuesto(
  token: string | null | undefined,
  secreto: string = secretoDocumentoPresupuesto(),
): string | null {
  const raw = String(token ?? '').trim();
  const punto = raw.lastIndexOf('.');
  if (punto <= 0) return null;
  const id = raw.slice(0, punto).trim();
  const firma = raw.slice(punto + 1).trim().toLowerCase();
  if (!id || !/^[0-9a-f-]{36}$/i.test(id) || firma.length < 16) return null;
  const esperada = hmacHex(id, secreto).slice(0, firma.length);
  if (!igual(firma, esperada.toLowerCase())) return null;
  return id;
}

export function urlDocumentoPresupuesto(baseUrl: string, token: string): string {
  const b = baseUrl.replace(/\/$/, '');
  return `${b}/presupuestos/documento?t=${encodeURIComponent(token)}`;
}

export function urlPdfDocumentoPresupuesto(baseUrl: string, token: string): string {
  const b = baseUrl.replace(/\/$/, '');
  return `${b}/api/budgets/documento?t=${encodeURIComponent(token)}`;
}

export function origenPublicoPresupuesto(req?: Request): string {
  if (req) {
    const origin = (req.headers.get('origin') ?? '').trim().replace(/\/$/, '');
    if (origin && /^https?:\/\//i.test(origin)) return origin;
  }
  const env = (
    process.env.NEXT_PUBLIC_BASE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    ''
  )
    .trim()
    .replace(/\/$/, '');
  if (env && /^https?:\/\//i.test(env)) return env;
  if (req) {
    try {
      return new URL(req.url).origin.replace(/\/$/, '');
    } catch {
      /* seguir */
    }
  }
  return 'https://casainteligente.company';
}
