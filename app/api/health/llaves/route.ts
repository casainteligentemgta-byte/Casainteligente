import { NextResponse } from 'next/server';
import { resolveSupabaseServiceRoleKey, tipoLlaveSupabase } from '@/lib/supabase/resolveServiceRoleKey';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Diagnóstico del cambio de llaves de Supabase: dice qué CLASE de llave usa este
 * despliegue («nueva» = sb_secret_/sb_publishable_, «antigua» = las basadas en JWT), sin
 * mostrar nada de su valor. Sirve para confirmar, antes de desactivar las llaves antiguas,
 * que el sitio ya no depende de ellas. Ver docs/CAMBIAR-LLAVE-MAESTRA.md.
 */
export async function GET() {
  const servidor = tipoLlaveSupabase(resolveSupabaseServiceRoleKey());
  const publica = tipoLlaveSupabase(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  return NextResponse.json(
    {
      ok: true,
      servidor,
      publica,
      listoParaDesactivarAntiguas: servidor === 'nueva' && publica === 'nueva',
    },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } },
  );
}
