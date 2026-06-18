import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { obtenerTasaBcvVesPorUsd } from '@/lib/finanzas/bcvTasaPorFecha';
import { isValidProyectoUuid } from '@/lib/proyectos/validarProyectoUuid';
import { PROCUREMENT_DOCUMENTS_BUCKET } from '@/lib/almacen/procurementDocumentStorage';

import type { InyeccionCapitalRow } from '@/lib/contabilidad/inyeccionesCapitalTypes';

export type { InyeccionCapitalRow };

type InyeccionBody = {
  proyecto_id?: string;
  origen_fondo?: string;
  monto?: number;
  moneda?: 'USD' | 'VES';
  tipo_tasa?: 'BCV' | 'PERSONALIZADA';
  tasa_aplicada?: number;
  tasa_bcv?: number;
  metodo_pago?: 'TRANSFERENCIA' | 'EFECTIVO';
  banco_origen?: string;
  cuenta_bancaria_destino?: string;
  referencia_bancaria?: string;
  soporte_storage_path?: string;
  seriales_billetes?: string[];
  creado_por?: string;
  fecha_ingreso?: string;
};

async function firmarSoporte(
  supabase: Awaited<ReturnType<typeof createClient>>,
  path: string | null,
): Promise<string | null> {
  if (!path?.trim()) return null;
  const { data, error } = await supabase.storage
    .from(PROCUREMENT_DOCUMENTS_BUCKET)
    .createSignedUrl(path, 3600);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

function mapRow(
  raw: Record<string, unknown>,
  soporteUrl: string | null,
): InyeccionCapitalRow {
  const proyecto = raw.ci_proyectos as { nombre?: string } | null;
  const seriales = raw.seriales_billetes;
  return {
    id: String(raw.id),
    proyecto_id: String(raw.proyecto_id),
    origen_fondo: String(raw.origen_fondo ?? ''),
    monto_recibido: Number(raw.monto_recibido ?? 0),
    moneda_recibida: raw.moneda_recibida === 'VES' ? 'VES' : 'USD',
    monto_usd: Number(raw.monto_usd ?? 0),
    monto_ves: Number(raw.monto_ves ?? 0),
    tasa_bcv: raw.tasa_bcv != null ? Number(raw.tasa_bcv) : null,
    tasa_aplicada: Number(raw.tasa_aplicada ?? 0),
    tipo_tasa: raw.tipo_tasa === 'PERSONALIZADA' ? 'PERSONALIZADA' : 'BCV',
    metodo_pago: raw.metodo_pago === 'EFECTIVO' ? 'EFECTIVO' : 'TRANSFERENCIA',
    banco_origen: raw.banco_origen != null ? String(raw.banco_origen) : null,
    cuenta_bancaria_destino:
      raw.cuenta_bancaria_destino != null ? String(raw.cuenta_bancaria_destino) : null,
    referencia_bancaria:
      raw.referencia_bancaria != null ? String(raw.referencia_bancaria) : null,
    soporte_storage_path:
      raw.soporte_storage_path != null ? String(raw.soporte_storage_path) : null,
    soporte_url: soporteUrl,
    seriales_billetes: Array.isArray(seriales)
      ? seriales.map((s) => String(s))
      : [],
    creado_por: raw.creado_por != null ? String(raw.creado_por) : null,
    creado_al: String(raw.creado_al ?? ''),
    fecha_ingreso: raw.fecha_ingreso != null ? String(raw.fecha_ingreso).slice(0, 10) : null,
    proyecto_nombre: proyecto?.nombre?.trim() || null,
  };
}

export async function GET() {
  const supabase = await createClient();

  const [{ data: obras, error: errObras }, { data: rows, error: errRows }] = await Promise.all([
    supabase.from('ci_proyectos').select('id, nombre').order('nombre'),
    supabase
      .from('ci_inyecciones_capital')
      .select('*, ci_proyectos(nombre)')
      .order('creado_al', { ascending: false })
      .limit(200),
  ]);

  if (errRows?.code === '42P01' || /ci_inyecciones_capital/i.test(errRows?.message ?? '')) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Tabla ci_inyecciones_capital no disponible.',
        hint: 'Aplique la migración 251 en Supabase y ejecute notify pgrst, reload schema;',
        obras: obras ?? [],
        inyecciones: [],
      },
      { status: 503 },
    );
  }

  if (errObras) {
    return NextResponse.json({ error: errObras.message }, { status: 400 });
  }
  if (errRows) {
    return NextResponse.json({ error: errRows.message }, { status: 400 });
  }

  const inyecciones: InyeccionCapitalRow[] = [];
  for (const row of rows ?? []) {
    const soporteUrl = await firmarSoporte(
      supabase,
      row.soporte_storage_path as string | null,
    );
    inyecciones.push(mapRow(row as Record<string, unknown>, soporteUrl));
  }

  return NextResponse.json({
    ok: true,
    obras: obras ?? [],
    inyecciones,
  });
}

export async function POST(req: Request) {
  let body: InyeccionBody;
  try {
    body = (await req.json()) as InyeccionBody;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const proyectoId = body.proyecto_id?.trim() ?? '';
  if (!isValidProyectoUuid(proyectoId)) {
    return NextResponse.json({ error: 'Seleccione una obra válida.' }, { status: 400 });
  }

  const origen = body.origen_fondo?.trim() ?? '';
  if (!origen) {
    return NextResponse.json({ error: 'Indique origen del fondo.' }, { status: 400 });
  }

  const monto = Number(body.monto);
  if (!Number.isFinite(monto) || monto <= 0) {
    return NextResponse.json({ error: 'Monto inválido.' }, { status: 400 });
  }

  const moneda = body.moneda;
  if (moneda !== 'USD' && moneda !== 'VES') {
    return NextResponse.json({ error: 'Seleccione moneda USD o VES.' }, { status: 400 });
  }

  const tipoTasa = body.tipo_tasa === 'PERSONALIZADA' ? 'PERSONALIZADA' : 'BCV';
  const metodoPago = body.metodo_pago === 'EFECTIVO' ? 'EFECTIVO' : 'TRANSFERENCIA';

  const fechaIngreso = body.fecha_ingreso?.trim() ?? '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaIngreso)) {
    return NextResponse.json({ error: 'Fecha de ingreso al banco inválida.' }, { status: 400 });
  }

  const bcv = await obtenerTasaBcvVesPorUsd(fechaIngreso);
  const tasaBcv = body.tasa_bcv != null && body.tasa_bcv > 0 ? body.tasa_bcv : bcv.tasa_bcv_ves_por_usd;

  let tasaAplicada = Number(body.tasa_aplicada);
  if (tipoTasa === 'BCV') {
    tasaAplicada = tasaBcv;
  }
  if (!Number.isFinite(tasaAplicada) || tasaAplicada <= 0) {
    return NextResponse.json({ error: 'Tasa aplicada inválida.' }, { status: 400 });
  }

  const banco =
    metodoPago === 'TRANSFERENCIA'
      ? body.banco_origen?.trim() ?? ''
      : 'EFECTIVO';
  const cuenta = body.cuenta_bancaria_destino?.trim() ?? '';
  const referencia = body.referencia_bancaria?.trim() ?? '';

  if (metodoPago === 'TRANSFERENCIA') {
    if (!banco || banco === 'EFECTIVO') {
      return NextResponse.json({ error: 'Indique banco de origen.' }, { status: 400 });
    }
    if (!cuenta) {
      return NextResponse.json({ error: 'Indique cuenta destino.' }, { status: 400 });
    }
    if (!referencia) {
      return NextResponse.json({ error: 'Indique referencia bancaria.' }, { status: 400 });
    }
  }

  const seriales = Array.isArray(body.seriales_billetes)
    ? body.seriales_billetes.map((s) => String(s).trim()).filter(Boolean)
    : [];

  const supabase = await createClient();
  const { data: id, error } = await supabase.rpc('ci_registrar_inyeccion_capital', {
    p_proyecto_id: proyectoId,
    p_origen_fondo: origen,
    p_monto_recibido: monto,
    p_moneda: moneda,
    p_tasa_bcv: tasaBcv,
    p_tasa_aplicada: tasaAplicada,
    p_tipo_tasa: tipoTasa,
    p_metodo_pago: metodoPago,
    p_banco_origen: banco,
    p_cuenta_destino: cuenta || null,
    p_referencia: referencia || null,
    p_soporte_path: body.soporte_storage_path?.trim() || null,
    p_seriales: seriales,
    p_creado_por: body.creado_por?.trim() || 'Administrador',
    p_fecha_ingreso: fechaIngreso,
  });

  if (error) {
    if (error.code === '42883' || /ci_registrar_inyeccion_capital/i.test(error.message ?? '')) {
      return NextResponse.json(
        {
          error:
            'Función ci_registrar_inyeccion_capital no disponible. Aplique migración 251 en Supabase.',
        },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const { data: row } = await supabase
    .from('ci_inyecciones_capital')
    .select('*, ci_proyectos(nombre)')
    .eq('id', id)
    .maybeSingle();

  const soporteUrl = await firmarSoporte(
    supabase,
    (row?.soporte_storage_path as string | null) ?? null,
  );

  return NextResponse.json({
    ok: true,
    id,
    inyeccion: row ? mapRow(row as Record<string, unknown>, soporteUrl) : null,
  });
}
