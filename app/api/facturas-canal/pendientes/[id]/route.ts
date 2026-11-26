import { NextResponse } from 'next/server';
import { deleteCompraRegistro } from '@/lib/contabilidad/deleteCompraRegistro';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

import { requireAlgunPermisoWeb } from '@/lib/auth/requirePermisoRoute';
import { MENSAJE_FACTURA_DUPLICADA, esErrorFacturaDuplicada } from '@/lib/canal/facturaDuplicada';
import { ConflictoEdicionError, reclamarVersionPendiente } from '@/lib/canal/edicionConcurrente';
import {
  cambiosEntreFacturas,
  registrarCambiosFactura,
  type CambioFactura,
} from '@/lib/contabilidad/historialCambiosFactura';
export const dynamic = 'force-dynamic';

function idFromParams(params: { id?: string }): string | null {
  const id = params.id?.trim();
  return id && id !== 'undefined' ? id : null;
}

type RouteCtx = { params: { id: string } | Promise<{ id: string }> };

async function resolveParams(
  params: { id: string } | Promise<{ id: string }>,
): Promise<{ id?: string }> {
  return params instanceof Promise ? params : Promise.resolve(params);
}

export async function GET(_req: Request, ctx: RouteCtx) {
  const acceso = await requireAlgunPermisoWeb(['compra.registrar', 'compra.confirmar', 'cco.ver']);
  if (!acceso.ok) return acceso.response;

  try {
    const id = idFromParams(await resolveParams(ctx.params));
    if (!id) {
      return NextResponse.json({ error: 'ID de factura inválido' }, { status: 400 });
    }
    const admin = supabaseAdminForRoute();
    if (!admin.ok) return admin.response;
    const supabase = admin.client;
    const { data, error } = await supabase
      .from('ci_facturas_canal_pendientes')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'No encontrado';
    return NextResponse.json({ error: message }, { status: 404 });
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const acceso = await requireAlgunPermisoWeb(['compra.registrar', 'compra.confirmar']);
  if (!acceso.ok) return acceso.response;

  try {
    const id = idFromParams(params);
    if (!id) {
      return NextResponse.json({ error: 'ID de factura inválido' }, { status: 400 });
    }
    const body = (await req.json()) as {
      estado?: string;
      proyecto_id?: string;
      ubicacion_destino_id?: string;
      purchase_invoice_id?: string;
      extracted?: Record<string, unknown>;
      mensaje_error?: string | null;
      /** Override autorizado: permite confirmar aunque queden alertas. */
      marcar_revisado?: boolean;
      /** Versión (updated_at) que tenía quien edita; si cambió, el guardado se rechaza. */
      expected_updated_at?: string | null;
    };
    const admin = supabaseAdminForRoute();
    if (!admin.ok) return admin.response;
    const supabase = admin.client;
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.estado) update.estado = body.estado;
    if (body.proyecto_id !== undefined) update.proyecto_id = body.proyecto_id;
    if (body.ubicacion_destino_id !== undefined) {
      update.ubicacion_destino_id = body.ubicacion_destino_id;
    }
    if (body.purchase_invoice_id !== undefined) update.purchase_invoice_id = body.purchase_invoice_id;
    if (body.expected_updated_at) {
      await reclamarVersionPendiente(supabase, id, body.expected_updated_at);
    }

    // Historial: qué campos cambian respecto a la versión guardada.
    let cambiosExtracted: CambioFactura[] = [];
    let extractedPrevio: Record<string, unknown> = {};
    if (body.extracted !== undefined || body.marcar_revisado === true) {
      const { data: actualRaw } = await supabase
        .from('ci_facturas_canal_pendientes')
        .select('extracted')
        .eq('id', id)
        .maybeSingle();
      // El cliente de Supabase sin tipos generados infiere `never`; se tipa a mano.
      const actual = actualRaw as { extracted?: unknown } | null;
      extractedPrevio = (actual?.extracted ?? {}) as Record<string, unknown>;
      let extractedNext = {
        ...extractedPrevio,
        ...(body.extracted ?? {}),
      } as import('@/lib/contabilidad/extractedCanal').ExtractedCanalHeader;

      if (body.marcar_revisado === true) {
        const { aplicarRevisionManual } = await import('@/lib/compras/validarLecturaFactura');
        extractedNext = aplicarRevisionManual(extractedNext, {
          userId: acceso.userId,
          email: acceso.actor.email ?? null,
          nombre: acceso.actor.nombre ?? null,
        });
        cambiosExtracted.push({
          campo: 'revision_manual',
          anterior: extractedPrevio.revision_manual
            ? String((extractedPrevio.revision_manual as { at?: string }).at ?? '')
            : null,
          nuevo: extractedNext.revision_manual?.at ?? null,
        });
        const { notificarEventoSistemaLogAsync } = await import('@/lib/telegram/logBotAuditoria');
        notificarEventoSistemaLogAsync({
          chatId: null,
          chatLabel: acceso.actor.email ?? acceso.userId,
          modulo: 'Compras · OCR',
          evento: 'Factura marcada como revisada',
          detalle: `Pendiente ${id} · ${acceso.actor.email ?? acceso.userId}`,
        });
      }

      if (body.extracted !== undefined) {
        cambiosExtracted = [
          ...cambiosExtracted,
          ...cambiosEntreFacturas(extractedPrevio, extractedNext as Record<string, unknown>),
        ];
      }

      const { detectarAnomaliasFactura } = await import('@/lib/compras/proveedorMemoria');
      const { cargarPerfilProveedor } = await import('@/lib/compras/proveedorMemoriaDb');
      const { aplicarAlertasAExtracted } = await import('@/lib/compras/validarLecturaFactura');
      const perfil = await cargarPerfilProveedor(supabase, extractedNext.supplier_rif);
      const anomalias = detectarAnomaliasFactura({ extracted: extractedNext, perfil });
      const conAlertas = aplicarAlertasAExtracted(extractedNext, anomalias);
      update.extracted = conAlertas.extracted;
      update.requiere_revision = conAlertas.requiere_revision;
    }
    if (body.mensaje_error !== undefined) update.mensaje_error = body.mensaje_error;

    const selectCols =
      'id, canal, chat_id, chat_label, estado, proyecto_id, ubicacion_destino_id, purchase_invoice_id, document_file_name, document_storage_path, extracted, mensaje_error, requiere_revision, created_at';
    let { data, error } = await supabase
      .from('ci_facturas_canal_pendientes')
      // Tabla sin tipos generados en Supabase client
      .update(update as never)
      .eq('id', id)
      .select(selectCols)
      .single();
    if (error && /requiere_revision|PGRST204|schema cache/i.test(error.message)) {
      delete update.requiere_revision;
      const retry = await supabase
        .from('ci_facturas_canal_pendientes')
        .update(update as never)
        .eq('id', id)
        .select(
          'id, canal, chat_id, chat_label, estado, proyecto_id, ubicacion_destino_id, purchase_invoice_id, document_file_name, document_storage_path, extracted, mensaje_error, created_at',
        )
        .single();
      data = retry.data;
      error = retry.error;
    }
    if (esErrorFacturaDuplicada(error)) {
      return NextResponse.json(
        { error: MENSAJE_FACTURA_DUPLICADA, codigo: 'factura_duplicada' },
        { status: 409 },
      );
    }
    if (error) throw error;
    await registrarCambiosFactura(supabase, {
      tabla: 'ci_facturas_canal_pendientes',
      registroId: id,
      cambios: cambiosExtracted,
      origen: 'web',
      actor: acceso.userId,
    });
    if (body.extracted !== undefined && cambiosExtracted.length) {
      const { registrarCorreccionesTrasEdicion } = await import('@/lib/compras/proveedorMemoriaDb');
      const prevEx = extractedPrevio;
      const original =
        (body.extracted.ocr_original as Record<string, unknown> | undefined) ??
        (prevEx.ocr_original as Record<string, unknown> | undefined) ??
        prevEx;
      void registrarCorreccionesTrasEdicion(supabase, {
        rif: String(body.extracted.supplier_rif ?? original.supplier_rif ?? ''),
        original,
        corregido: body.extracted,
        origen: 'web',
      }).catch((e) => console.warn('[facturas-canal PATCH] correcciones:', e));
    }
    return NextResponse.json({ success: true, pendiente: data });
  } catch (err: unknown) {
    if (err instanceof ConflictoEdicionError) {
      return NextResponse.json({ error: err.message, codigo: 'conflicto_edicion' }, { status: 409 });
    }
    const message = err instanceof Error ? err.message : 'Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request, ctx: RouteCtx) {
  const acceso = await requireAlgunPermisoWeb(['compra.registrar', 'compra.confirmar']);
  if (!acceso.ok) return acceso.response;

  try {
    const id = idFromParams(await resolveParams(ctx.params));
    if (!id) {
      return NextResponse.json({ error: 'ID de factura inválido' }, { status: 400 });
    }
    const admin = supabaseAdminForRoute();
    if (!admin.ok) return admin.response;
    const supabase = admin.client;
    const completo = new URL(req.url).searchParams.get('completo') === '1';

    let deletedCompraIds: string[] = [];
    let materialPermaneceEnStock = false;

    if (completo) {
      const { data: canal, error: canalErr } = await supabase
        .from('ci_facturas_canal_pendientes')
        .select('id, purchase_invoice_id')
        .eq('id', id)
        .maybeSingle();
      if (canalErr) throw canalErr;

      const canalRow = canal as { id: string; purchase_invoice_id: string | null } | null;
      if (canalRow?.purchase_invoice_id) {
        const { data: compras, error: comprasErr } = await supabase
          .from('contabilidad_compras')
          .select('id')
          .eq('purchase_invoice_id', canalRow.purchase_invoice_id);
        if (comprasErr) throw comprasErr;

        for (const row of (compras ?? []) as { id: string }[]) {
          const r = await deleteCompraRegistro(supabase, row.id);
          deletedCompraIds.push(...r.deletedIds);
          if (r.materialPermaneceEnStock) materialPermaneceEnStock = true;
        }
      }
    }

    const { error } = await supabase
      .from('ci_facturas_canal_pendientes')
      .delete()
      .eq('id', id);
    if (error) throw error;

    return NextResponse.json({
      success: true,
      deletedCompraIds,
      materialPermaneceEnStock: materialPermaneceEnStock || undefined,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
