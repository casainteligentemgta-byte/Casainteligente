import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { limpiarBorradorRecepcionPorToken, obtenerBorradorRecepcionPorToken } from '@/lib/almacen/recepcionBorradorTelegram';
import type { PayloadRecepcionManualApi } from '@/lib/almacen/recepcionCampoTypes';
import { esFormaIngresoRecepcion } from '@/lib/almacen/formaIngresoRecepcion';
import { registrarCompraDesdeIngresoManualFactura } from '@/lib/contabilidad/registrarCompraDesdeIngresoManualFactura';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const dynamic = 'force-dynamic';

const TIPOS_VALIDOS = new Set(['nota_entrega', 'emergencia', 'factura_canal']);

function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

export async function POST(req: Request) {
  let body: PayloadRecepcionManualApi;
  try {
    body = (await req.json()) as PayloadRecepcionManualApi;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const proyectoId = body.proyecto_id?.trim() ?? '';
  const ubicacionId = body.ubicacion_id?.trim() ?? '';
  const tipo = body.tipo?.trim() ?? '';

  if (!isUuid(proyectoId) || !isUuid(ubicacionId)) {
    return NextResponse.json({ error: 'Proyecto y ubicación de ingreso son obligatorios.' }, { status: 400 });
  }
  if (!TIPOS_VALIDOS.has(tipo)) {
    return NextResponse.json({ error: 'Tipo de recepción inválido.' }, { status: 400 });
  }

  const lineasRaw = Array.isArray(body.lineas) ? body.lineas : [];
  const lineas = lineasRaw
    .map((l) => {
      const formaRaw = String(l.forma_ingreso ?? 'sin_nota').trim();
      const forma = esFormaIngresoRecepcion(formaRaw) ? formaRaw : 'sin_nota';
      return {
        material_id: String(l.material_id ?? '').trim(),
        cantidad: Number(l.cantidad),
        unidad: String(l.unidad ?? 'UND').trim() || 'UND',
        descripcion: String(l.descripcion ?? '').trim(),
        observaciones: String(l.observaciones ?? '').trim() || null,
        forma_ingreso: forma,
        soporte_storage_path: String(l.soporte_storage_path ?? '').trim() || null,
        soporte_file_name: String(l.soporte_file_name ?? '').trim() || null,
        soporte_mime_type: String(l.soporte_mime_type ?? '').trim() || null,
      };
    })
    .filter((l) => isUuid(l.material_id) && Number.isFinite(l.cantidad) && l.cantidad > 0);

  if (!lineas.length) {
    return NextResponse.json(
      { error: 'Agregue al menos un material con cantidad mayor a cero.' },
      { status: 400 },
    );
  }

  const proveedorId = body.proveedor_id?.trim();
  if (proveedorId && !isUuid(proveedorId)) {
    return NextResponse.json({ error: 'proveedor_id inválido.' }, { status: 400 });
  }

  const auth = await createClient();
  const {
    data: { user },
  } = await auth.auth.getUser();

  const admin = supabaseAdminForRoute();
  if (!admin.ok) return admin.response;
  const supabase = admin.client;

  const borradorToken = body.borrador_token?.trim();
  if (borradorToken) {
    try {
      const borrador = await obtenerBorradorRecepcionPorToken(supabase, borradorToken);
      if (borrador?.recepcion_registrada_id) {
        return NextResponse.json(
          {
            error: 'Esta recepción ya fue registrada desde Telegram o la app. No repita el ingreso.',
            recepcion_id: borrador.recepcion_registrada_id,
            ya_existia: true,
          },
          { status: 409 },
        );
      }
    } catch {
      /* continuar si no se puede leer borrador */
    }
  }

  const { data: recepcionId, error: rpcErr } = await supabase.rpc('ci_registrar_ingreso_manual_campo', {
    p_proyecto_id: proyectoId,
    p_ubicacion_id: ubicacionId,
    p_proveedor_id: proveedorId || null,
    p_tipo: tipo,
    p_num_doc: String(body.num_doc ?? '').trim() || 'S/N',
    p_lineas: lineas,
    p_usuario_id: user?.id ?? null,
  } as never);

  if (rpcErr) {
    const msg = rpcErr.message ?? 'Error al registrar ingreso';
    if (/does not exist|ci_registrar_ingreso_manual_campo/i.test(msg)) {
      return NextResponse.json(
        { error: 'RPC no disponible. Aplique migración 199_ci_recepciones_provisionales_campo.sql.' },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const id = String(recepcionId ?? '');
  if (!id) {
    return NextResponse.json({ error: 'No se obtuvo ID de recepción.' }, { status: 500 });
  }

  const patch: Record<string, unknown> = {};
  const proveedorNombre = String(body.proveedor_nombre ?? '').trim();
  if (proveedorNombre) patch.proveedor_nombre = proveedorNombre;
  if (body.soporte_storage_path?.trim()) {
    patch.soporte_storage_path = body.soporte_storage_path.trim();
    patch.soporte_file_name = body.soporte_file_name?.trim() || null;
    patch.soporte_mime_type = body.soporte_mime_type?.trim() || null;
  }
  if (body.observaciones?.trim()) patch.observaciones = body.observaciones.trim();

  if (Object.keys(patch).length > 0) {
    await supabase.from('ci_recepciones_campo').update(patch as never).eq('id', id);
  }

  if (borradorToken) {
    try {
      await limpiarBorradorRecepcionPorToken(supabase, borradorToken, id);
    } catch {
      /* no bloquear registro si falla limpieza del estado Telegram */
    }
  }

  let contabilidad: { ok: boolean; compra_id?: string; error?: string } | undefined;
  if (tipo === 'factura_canal') {
    const conta = await registrarCompraDesdeIngresoManualFactura(supabase, {
      recepcionCampoId: id,
      proyectoId,
      ubicacionId,
      proveedorNombre: proveedorNombre || 'Proveedor',
      numDoc: String(body.num_doc ?? '').trim() || 'S/N',
      lineas: lineas.map((l) => ({
        material_id: l.material_id,
        material_nombre: l.descripcion || 'Material',
        unidad: l.unidad,
        cantidad: l.cantidad,
      })),
      soporteStoragePath: body.soporte_storage_path?.trim() || null,
    });
    contabilidad = conta.ok
      ? { ok: true, compra_id: conta.compraId }
      : { ok: false, error: conta.error };
  }

  return NextResponse.json({
    ok: true,
    success: true,
    recepcion_id: id,
    estado: 'registrado',
    lineas_registradas: lineas.length,
    ...(contabilidad ? { contabilidad } : {}),
  });
}
