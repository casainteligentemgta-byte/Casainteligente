import { NextResponse } from 'next/server';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';
import { listarPlantillasDocumento, obtenerCuerpoPlantillaContratoObrero } from '@/lib/talento/plantillaContratoObreroRepo';

export const runtime = 'nodejs';

/** Lista plantillas de la biblioteca (requiere service role en servidor). */
export async function GET() {
  const admin = supabaseAdminForRoute();
  if (!admin.ok) return admin.response;
  try {
    await obtenerCuerpoPlantillaContratoObrero(admin.client);
    const rows = await listarPlantillasDocumento(admin.client);
    return NextResponse.json({ plantillas: rows });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error';
    return NextResponse.json({ plantillas: [], error: msg }, { status: 500 });
  }
}
