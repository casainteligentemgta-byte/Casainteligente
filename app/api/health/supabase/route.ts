import { NextResponse } from 'next/server';
import { supabaseFetch } from '@/lib/supabase/supabaseFetch';

export const runtime = 'nodejs';

/**
 * Diagnóstico: si en local ves `TypeError: fetch failed`, abre GET /api/health/supabase
 * y revisa `error` / `cause` (TLS, DNS, etc.). No expone claves.
 */
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url || !key) {
    return NextResponse.json(
      {
        ok: false,
        step: 'env',
        error: 'Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY en el entorno del servidor (reinicia `npm run dev` tras editar .env.local).',
      },
      { status: 503 },
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return NextResponse.json(
      { ok: false, step: 'url_parse', error: 'NEXT_PUBLIC_SUPABASE_URL no es una URL válida.' },
      { status: 400 },
    );
  }

  const rest = new URL('/rest/v1/', parsed);
  try {
    const res = await supabaseFetch(rest.toString(), {
      method: 'GET',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
    });
    return NextResponse.json({
      ok: true,
      step: 'rest_v1',
      status: res.status,
      host: parsed.host,
      hint: 'El servidor de Next puede hablar con Supabase. Si el navegador sigue fallando, revisa extensiones o que uses http://localhost:3000 (mismo origen que las rutas /api).',
    });
  } catch (e: unknown) {
    const err = e instanceof Error ? e : new Error(String(e));
    let cause: string | null = null;
    const c = err.cause;
    if (c instanceof Error) cause = c.message;
    else if (c != null && typeof c === 'object' && 'code' in c) cause = String((c as { code?: unknown }).code);
    else if (c != null) cause = String(c);

    return NextResponse.json(
      {
        ok: false,
        step: 'fetch',
        host: parsed.host,
        error: err.message,
        cause,
        hint:
          'Causas frecuentes en Windows: proxy/antivirus (TLS), VPN, URL mal copiada, o .env.local en otra carpeta. Ver docs/ERROR-FETCH-FAILED-SUPABASE.md',
      },
      { status: 502 },
    );
  }
}
