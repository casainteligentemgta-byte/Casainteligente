import { NextResponse } from 'next/server';
import { liquidarMaquinariaIntercompany } from '@/lib/maquinaria/liquidarMaquinariaIntercompany';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';
import { formatErrorMessage } from '@/lib/utils/formatErrorMessage';

export const dynamic = 'force-dynamic';

type Body = {
  proyectoId?: string;
  periodoDesde?: string;
  periodoHasta?: string;
  tasaBcv?: number;
};

/** Cierra horas intercompany pendientes, agrupa por entidad propietaria y debita fondo del proyecto. */
export async function POST(request: Request) {
  const admin = supabaseAdminForRoute();
  if (!admin.ok) return admin.response;

  try {
    const body = (await request.json()) as Body;
    const proyectoId = body.proyectoId?.trim() ?? '';
    const periodoDesde = body.periodoDesde?.trim() ?? '';
    const periodoHasta = body.periodoHasta?.trim() ?? '';
    const tasaBcv = Number(body.tasaBcv);

    if (!proyectoId || !periodoDesde || !periodoHasta || !(tasaBcv > 0)) {
      return NextResponse.json({ error: 'Faltan parámetros obligatorios' }, { status: 400 });
    }

    const resultado = await liquidarMaquinariaIntercompany(admin.client, {
      proyectoId,
      periodoDesde,
      periodoHasta,
      tasaBcv,
    });

    if (!resultado.success) {
      return NextResponse.json(
        {
          success: false,
          message: resultado.message,
          lineasProcesadas: 0,
        },
        { status: 200 },
      );
    }

    const liquidacionPrincipal = resultado.liquidaciones[0];

    return NextResponse.json({
      success: true,
      liquidacionId: liquidacionPrincipal?.id ?? null,
      liquidaciones: resultado.liquidaciones,
      montoLiquidadoUsd: resultado.montoLiquidadoUsd,
      lineasProcesadas: resultado.lineasProcesadas,
    });
  } catch (error: unknown) {
    console.error('[CRITICAL INTERCOMPANY MAQUINARIA ERROR]:', error);
    return NextResponse.json(
      { error: formatErrorMessage(error) || 'Error interno en el motor de liquidación' },
      { status: 500 },
    );
  }
}
