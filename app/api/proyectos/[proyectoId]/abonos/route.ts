import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isValidProyectoUuid } from '@/lib/proyectos/validarProyectoUuid';
import { obtenerTasaBcvVesPorUsd } from '@/lib/finanzas/bcvTasaPorFecha';

type RouteCtx = { params: { proyectoId: string } };

type AbonoBody = {
  monto_recibido?: number;
  moneda?: 'USD' | 'VES';
  banco_origen?: string;
  referencia_transferencia?: string;
  fecha_abono?: string;
  observaciones?: string;
  tasa_bcv?: number;
};

export async function POST(req: Request, { params }: RouteCtx) {
  const proyectoId = params.proyectoId?.trim() ?? '';
  if (!isValidProyectoUuid(proyectoId)) {
    return NextResponse.json({ error: 'ID de proyecto inválido' }, { status: 400 });
  }

  let body: AbonoBody;
  try {
    body = (await req.json()) as AbonoBody;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const monto = Number(body.monto_recibido);
  const moneda = body.moneda;
  const banco = body.banco_origen?.trim() ?? '';
  const referencia = body.referencia_transferencia?.trim() ?? '';
  const fecha = body.fecha_abono?.trim() ?? '';
  const observaciones = body.observaciones?.trim() ?? '';

  if (!Number.isFinite(monto) || monto <= 0) {
    return NextResponse.json({ error: 'Monto recibido inválido.' }, { status: 400 });
  }
  if (moneda !== 'USD' && moneda !== 'VES') {
    return NextResponse.json({ error: 'Seleccione moneda USD o VES.' }, { status: 400 });
  }
  if (!banco) {
    return NextResponse.json({ error: 'Indique banco origen.' }, { status: 400 });
  }
  if (!referencia) {
    return NextResponse.json({ error: 'Indique cuenta o referencia de transferencia.' }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return NextResponse.json({ error: 'Fecha de abono inválida.' }, { status: 400 });
  }

  let tasa = body.tasa_bcv != null ? Number(body.tasa_bcv) : null;
  let montoUsd: number;

  if (moneda === 'USD') {
    montoUsd = monto;
  } else {
    if (!tasa || tasa <= 0) {
      const bcv = await obtenerTasaBcvVesPorUsd(fecha);
      tasa = bcv.tasa_bcv_ves_por_usd;
    }
    montoUsd = monto / tasa;
  }

  const supabase = await createClient();

  const { data, error } = await supabase.rpc('ci_registrar_abono_cliente', {
    p_proyecto_id: proyectoId,
    p_monto_recibido: monto,
    p_moneda: moneda,
    p_monto_usd: Math.round(montoUsd * 100) / 100,
    p_tasa_bcv: moneda === 'VES' ? tasa : null,
    p_banco_origen: banco,
    p_referencia: referencia,
    p_fecha_abono: fecha,
    p_observaciones: observaciones || null,
  });

  if (error) {
    if (error.code === '42883' || /ci_registrar_abono_cliente/i.test(error.message ?? '')) {
      return NextResponse.json(
        {
          error:
            'Función ci_registrar_abono_cliente no disponible. Aplique migración 188 en Supabase.',
        },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const { data: fondos } = await supabase
    .from('ci_proyecto_fondos')
    .select('saldo_usd, saldo_ves, total_abonado_usd, total_abonado_ves')
    .eq('proyecto_id', proyectoId)
    .maybeSingle();

  return NextResponse.json({
    ok: true,
    abono_id: data,
    fondos: fondos ?? null,
  });
}
