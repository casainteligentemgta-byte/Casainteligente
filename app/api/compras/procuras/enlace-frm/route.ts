import { NextResponse } from 'next/server';
import { requireAlgunPermisoWeb } from '@/lib/auth/requirePermisoRoute';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';
import {
  ordenarSugerencias,
  type RecepcionParaSugerencia,
  type SugerenciaRecepcion,
} from '@/lib/frm/sugerenciaRecepcionProcura';

export const dynamic = 'force-dynamic';

function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

type ContextoCompra = {
  contabilidadCompraId: string;
  ubicacionId: string;
  proveedorRif: string | null;
  proveedorNombre: string | null;
  materiales: string[];
};

/**
 * GET ?purchase_invoice_id=... → recepciones de campo sugeridas para la compra de Procura.
 * La sugerencia solo propone; el enlace lo confirma una persona con POST.
 */
export async function GET(req: Request) {
  const acceso = await requireAlgunPermisoWeb(['compra.registrar']);
  if (!acceso.ok) return acceso.response;

  const url = new URL(req.url);
  const piId = (url.searchParams.get('purchase_invoice_id') ?? '').trim();
  if (!isUuid(piId)) {
    return NextResponse.json({ error: 'purchase_invoice_id inválido.' }, { status: 400 });
  }

  const admin = supabaseAdminForRoute();
  if (!admin.ok) return admin.response;
  const db = admin.client;

  const { data: cc } = await db
    .from('contabilidad_compras')
    .select('id, supplier_rif, supplier_name')
    .eq('purchase_invoice_id', piId)
    .maybeSingle();
  if (!cc?.id) {
    return NextResponse.json({ error: 'La compra contable no existe para esta factura de Procura.' }, { status: 404 });
  }

  const { data: cf } = await db
    .from('compras_facturas')
    .select('id, estado, ubicacion_destino_id')
    .eq('purchase_invoice_id', piId)
    .maybeSingle();
  if (!cf?.ubicacion_destino_id) {
    return NextResponse.json({ error: 'La compra no tiene ubicación de destino.' }, { status: 409 });
  }
  if (cf.estado === 'registrada') {
    return NextResponse.json({ error: 'La compra ya tiene stock registrado; no se puede enlazar.' }, { status: 409 });
  }

  const { data: lineasCompra } = await db
    .from('compras_factura_lineas')
    .select('descripcion')
    .eq('factura_id', cf.id);
  const materialesCompra = (lineasCompra ?? [])
    .map((l) => String((l as { descripcion?: string }).descripcion ?? '').trim())
    .filter(Boolean);

  const ctx: ContextoCompra = {
    contabilidadCompraId: String(cc.id),
    ubicacionId: String(cf.ubicacion_destino_id),
    proveedorRif: (cc.supplier_rif as string | null) ?? null,
    proveedorNombre: (cc.supplier_name as string | null) ?? null,
    materiales: materialesCompra,
  };

  const { data: recepciones } = await db
    .from('ci_recepciones_campo')
    .select('id, proveedor_id, proveedor_nombre, ubicacion_id, contabilidad_compra_id')
    .eq('estado', 'registrado')
    .in('tipo', ['nota_entrega', 'emergencia'])
    .is('factura_canal_pendiente_id', null)
    .eq('ubicacion_id', ctx.ubicacionId)
    .neq('contabilidad_compra_id', ctx.contabilidadCompraId)
    .limit(200);

  const ids = (recepciones ?? []).map((r) => String(r.id));
  const proveedorIds = [...new Set((recepciones ?? []).map((r) => r.proveedor_id).filter(Boolean))] as string[];

  const [{ data: lineas }, { data: empresas }] = await Promise.all([
    ids.length
      ? db.from('ci_recepciones_campo_lineas').select('recepcion_id, descripcion').in('recepcion_id', ids)
      : Promise.resolve({ data: [] as { recepcion_id: string; descripcion: string | null }[] }),
    proveedorIds.length
      ? db.from('empresas').select('id, rif').in('id', proveedorIds)
      : Promise.resolve({ data: [] as { id: string; rif: string | null }[] }),
  ]);

  const rifPorEmpresa = new Map((empresas ?? []).map((e) => [String(e.id), (e.rif as string | null) ?? null]));
  const materialesPorRecepcion = new Map<string, string[]>();
  for (const l of lineas ?? []) {
    const k = String(l.recepcion_id);
    const d = String(l.descripcion ?? '').trim();
    if (!d) continue;
    materialesPorRecepcion.set(k, [...(materialesPorRecepcion.get(k) ?? []), d]);
  }

  const candidatas: RecepcionParaSugerencia[] = (recepciones ?? []).map((r) => ({
    id: String(r.id),
    ubicacionId: String(r.ubicacion_id),
    proveedorRif: r.proveedor_id ? rifPorEmpresa.get(String(r.proveedor_id)) ?? null : null,
    proveedorNombre: (r.proveedor_nombre as string | null) ?? null,
    materiales: materialesPorRecepcion.get(String(r.id)) ?? [],
  }));

  const sugerencias: SugerenciaRecepcion[] = ordenarSugerencias(
    {
      ubicacionId: ctx.ubicacionId,
      proveedorRif: ctx.proveedorRif,
      proveedorNombre: ctx.proveedorNombre,
      materiales: ctx.materiales,
    },
    candidatas,
  );

  return NextResponse.json({ contabilidad_compra_id: ctx.contabilidadCompraId, sugerencias });
}

/**
 * POST { recepcion_id, contabilidad_compra_id } → enlace confirmado por la persona.
 * Toda la validación vive en ci_enlazar_frm_con_compra_procura (379a).
 */
export async function POST(req: Request) {
  const acceso = await requireAlgunPermisoWeb(['compra.registrar']);
  if (!acceso.ok) return acceso.response;

  let body: { recepcion_id?: string; contabilidad_compra_id?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ success: false, error: 'JSON inválido' }, { status: 400 });
  }

  const recepcionId = String(body.recepcion_id ?? '').trim();
  const compraId = String(body.contabilidad_compra_id ?? '').trim();
  if (!isUuid(recepcionId) || !isUuid(compraId)) {
    return NextResponse.json({ success: false, error: 'recepcion_id y contabilidad_compra_id son obligatorios.' }, { status: 400 });
  }

  const admin = supabaseAdminForRoute();
  if (!admin.ok) return admin.response;

  const { data, error } = await admin.client.rpc('ci_enlazar_frm_con_compra_procura', {
    p_recepcion_id: recepcionId,
    p_contabilidad_compra_id: compraId,
  });
  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }

  const row = (data ?? {}) as { success?: boolean; error?: string };
  if (!row.success) {
    return NextResponse.json({ success: false, error: row.error ?? 'No se pudo enlazar.' }, { status: 400 });
  }
  return NextResponse.json({ success: true, ...row });
}
