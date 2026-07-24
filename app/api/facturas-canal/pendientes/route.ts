import { NextResponse } from 'next/server';
import {
  ampliarPendientesCanalConContabilidad,
  cargarIndiceContabilidadIngreso,
  filtrarCanalPendientesParaIngreso,
  type PendienteCanalRecepcion,
} from '@/lib/almacen/listarFacturasPendientesIngreso';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';
import { formatErrorMessage } from '@/lib/utils/formatErrorMessage';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const estado = searchParams.get('estado');
    const admin = supabaseAdminForRoute();
    if (!admin.ok) return admin.response;
    const supabase = admin.client;

    let q = supabase
      .from('ci_facturas_canal_pendientes')
      .select(
        'id, canal, chat_id, chat_label, entidad_id, proyecto_id, ubicacion_destino_id, estado, purchase_invoice_id, document_file_name, document_storage_path, document_mime_type, extracted, mensaje_error, created_at, updated_at',
      )
      .order('created_at', { ascending: false })
      .limit(50);

    if (estado) {
      q = q.eq('estado', estado);
    } else {
      const para = searchParams.get('para');
      const estados =
        para === 'lista_compras'
          ? ['extraido', 'pendiente', 'procesando', 'error', 'confirmado']
          : para === 'transito_ingreso'
            ? ['extraido', 'aprobado_sistema', 'confirmado']
            : para === 'panel_canal'
              ? [
                  'extraido',
                  'pendiente',
                  'procesando',
                  'error',
                  'confirmado',
                  'rechazado',
                ]
              : ['extraido', 'pendiente', 'procesando', 'error'];
      q = q.in('estado', estados);
    }

    const { data, error } = await q;
    if (error) throw new Error(formatErrorMessage(error));

    let pendientes = (data ?? []) as PendienteCanalRecepcion[];
    if (searchParams.get('para') === 'transito_ingreso') {
      const indice = await cargarIndiceContabilidadIngreso(supabase);
      pendientes = filtrarCanalPendientesParaIngreso(pendientes, indice);
      pendientes = await ampliarPendientesCanalConContabilidad(supabase, pendientes);
    }

    return NextResponse.json(
      { pendientes },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } },
    );
  } catch (err: unknown) {
    const message = formatErrorMessage(err) || 'Error al listar';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
