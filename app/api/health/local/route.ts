import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseFetch } from '@/lib/supabase/supabaseFetch';

export const runtime = 'nodejs';

/**
 * Diagnóstico rápido del entorno local.
 * Abrir: http://127.0.0.1:3000/api/health/local
 */
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url || !key) {
    return NextResponse.json(
      {
        ok: false,
        next: true,
        supabase: false,
        error: 'Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY. Reinicie npm run dev tras editar .env.local.',
      },
      { status: 503 }
    );
  }

  const supabase = createClient(url, key, { global: { fetch: supabaseFetch } });

  let supabaseOk = false;
  let deposits = 0;
  let defaultDeposit: string | null = null;
  let supabaseError: string | null = null;

  try {
    const { data, error } = await supabase
      .from('inventory_deposits')
      .select('id,name,locality,is_default')
      .limit(20);

    if (error) {
      supabaseError = error.message;
    } else {
      supabaseOk = true;
      deposits = data?.length ?? 0;
      const def = (data ?? []).find((d) => d.is_default) ?? data?.[0];
      if (def) {
        defaultDeposit = def.locality
          ? `${def.name} (${def.locality})`
          : String(def.name);
      }
    }
  } catch (e) {
    supabaseError = e instanceof Error ? e.message : String(e);
  }

  const ok = supabaseOk;

  return NextResponse.json({
    ok,
    next: true,
    supabase: supabaseOk,
    deposits,
    defaultDeposit,
    appUrl: 'http://127.0.0.1:3000',
    almacen: 'http://127.0.0.1:3000/almacen',
    procurement: 'http://127.0.0.1:3000/almacen/procurement',
    contabilidadCompras: 'http://127.0.0.1:3000/contabilidad/compras',
    error: supabaseError,
    hint: ok
      ? 'Servidor y Supabase responden. Use 127.0.0.1:3000 en el navegador.'
      : 'Revise .env.local, npm run dev:tls si hay error de certificado, y migraciones 014/134/136.',
  });
}
