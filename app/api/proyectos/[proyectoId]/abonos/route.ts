import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { requirePermisoWeb } from '@/lib/auth/requirePermisoRoute';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';
import { isValidProyectoUuid } from '@/lib/proyectos/validarProyectoUuid';
import { esFuenteTasaBcvConfiable, obtenerTasaBcvVesPorUsd } from '@/lib/finanzas/bcvTasaPorFecha';

type RouteCtx = { params: { proyectoId: string } };

type AbonoBody = {
  monto_recibido?: number;
  moneda?: 'USD' | 'VES';
  banco_origen?: string;
  referencia_transferencia?: string;
  fecha_abono?: string;
  observaciones?: string;
  tasa_bcv?: number;
  /** Fuente de la tasa en el navegador; se acepta solo si es confiable (no el valor fijo de respaldo). */
  tasa_fuente?: string | null;
};

export async function POST(req: Request, { params }: RouteCtx) {
  const proyectoId = params.proyectoId?.trim() ?? '';
  if (!isValidProyectoUuid(proyectoId)) {
    return NextResponse.json({ error: 'ID de proyecto inválido' }, { status: 400 });
  }

  const auth = await requirePermisoWeb('cco.editar', { proyectoId });
  if (!auth.ok) return auth.response;

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

  // Todo ingreso de dinero a la obra es una inyección de capital (migración 359): el abono
  // del cliente se registra ahí con origen «Cliente», así cuenta en el CCO y en los fondos.
  // La tasa hace falta también en USD (equivalente en Bs).
  let tasa =
    body.tasa_bcv != null && esFuenteTasaBcvConfiable(body.tasa_fuente) ? Number(body.tasa_bcv) : 0;
  if (!Number.isFinite(tasa) || tasa <= 0) {
    const bcv = await obtenerTasaBcvVesPorUsd(fecha);
    if (!esFuenteTasaBcvConfiable(bcv.fuente)) {
      return NextResponse.json(
        { error: 'No se pudo obtener la tasa BCV de esa fecha. Intente de nuevo en unos minutos.' },
        { status: 503 },
      );
    }
    tasa = bcv.tasa_bcv_ves_por_usd;
  }

  const origen = (observaciones ? `Cliente · ${observaciones}` : 'Cliente').slice(0, 250);

  const supabase = await createClient();

  // La función solo la puede ejecutar el servidor (migración 357); el permiso ya se verificó arriba.
  const admin = supabaseAdminForRoute();
  if (!admin.ok) return admin.response;
  // Mismo tipo que usan las funciones de lib/: acepta cualquier nombre de RPC.
  const servidor: SupabaseClient = admin.client;

  const { data, error } = await servidor.rpc('ci_registrar_inyeccion_capital', {
    p_proyecto_id: proyectoId,
    p_origen_fondo: origen,
    p_monto_recibido: monto,
    p_moneda: moneda,
    p_tasa_bcv: tasa,
    p_tasa_aplicada: tasa,
    p_tipo_tasa: 'BCV',
    p_metodo_pago: 'TRANSFERENCIA',
    p_banco_origen: banco,
    p_cuenta_destino: null,
    p_referencia: referencia,
    p_soporte_path: null,
    p_seriales: [],
    p_creado_por: auth.actor.email?.trim() || 'Finanzas del proyecto',
    p_fecha_ingreso: fecha,
  });

  if (error) {
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
    inyeccion_id: data,
    fondos: fondos ?? null,
  });
}
