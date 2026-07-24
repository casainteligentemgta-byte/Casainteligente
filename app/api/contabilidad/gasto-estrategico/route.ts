import { NextResponse } from 'next/server';
import {
  registrarGastoEstrategico,
  type DatosGastoEstrategico,
} from '@/lib/contabilidad/registrarGastoEstrategico';
import { supabaseAdminMovimientos } from '@/lib/almacen/supabaseAdminMovimientos';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as DatosGastoEstrategico;
    const admin = supabaseAdminMovimientos();
    if (!admin.ok) return admin.response;

    const result = await registrarGastoEstrategico(admin.client, body);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error al registrar gasto estratégico';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
