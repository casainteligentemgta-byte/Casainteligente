import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { backfillVinculosContratos } from '@/lib/contabilidad/cco/backfillVinculos';
import {
  cargarJerarquiaContratos,
  patchPctAvanceContrato,
  repartirSacoHuerfano,
  upsertContratoObra,
  vincularPagosAContrato,
} from '@/lib/contabilidad/cco/contratosJerarquia';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const dynamic = 'force-dynamic';

function schemaHint(message: string): string | undefined {
  if (/pct_avance|279/i.test(message)) {
    return 'Ejecuta la migración 279_cco_contratos_pct_avance.sql en Supabase y recarga el schema.';
  }
  if (/cco_contratos_obra|schema cache|42703/i.test(message)) {
    return 'Ejecuta la migración 269_cco_obra_fusion_v4.sql en Supabase y recarga el schema.';
  }
  return undefined;
}

/** GET jerarquía Subcontratista → contratos → pagos + huérfanos. */
export async function GET(req: Request) {
  try {
    const admin = supabaseAdminForRoute();
    if (!admin.ok) return admin.response;

    const proyectoId = new URL(req.url).searchParams.get('proyecto')?.trim();
    if (!proyectoId) {
      return NextResponse.json({ ok: false, error: 'Falta ?proyecto=' }, { status: 400 });
    }

    const data = await cargarJerarquiaContratos(admin.client, proyectoId);
    return NextResponse.json({ ok: true, ...data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al cargar contratos CCO.';
    return NextResponse.json(
      { ok: false, error: message, hint: schemaHint(message) },
      { status: 500 },
    );
  }
}

/** POST crear/actualizar contrato, vincular, repartir saco, patch avance o backfill. */
export async function POST(req: Request) {
  try {
    const admin = supabaseAdminForRoute();
    if (!admin.ok) return admin.response;

    const body = (await req.json()) as {
      action?: 'upsert' | 'vincular' | 'backfill' | 'repartir' | 'patch_avance';
      id?: string;
      proyecto_id?: string;
      proveedor?: string;
      descripcion?: string;
      fecha?: string | null;
      monto_base_usd?: number;
      admin_pct?: number | null;
      estado?: string;
      pct_avance?: number | null;
      contrato_id?: string;
      compra_id?: string;
      compra_ids?: string[];
      asignaciones?: { contrato_id?: string; monto_usd?: number }[];
      umbral?: number;
      dry_run?: boolean;
    };

    if (body.action === 'backfill') {
      const proyectoId = String(body.proyecto_id ?? '').trim();
      if (!proyectoId) {
        return NextResponse.json({ ok: false, error: 'proyecto_id requerido.' }, { status: 400 });
      }
      const result = await backfillVinculosContratos(admin.client, proyectoId, {
        umbral: body.umbral != null ? Number(body.umbral) : 40,
        dryRun: Boolean(body.dry_run),
      });
      return NextResponse.json({ ok: true, ...result });
    }

    if (body.action === 'patch_avance') {
      const contratoId = String(body.contrato_id ?? body.id ?? '').trim();
      const pct = Number(body.pct_avance);
      if (!contratoId || !Number.isFinite(pct)) {
        return NextResponse.json(
          { ok: false, error: 'contrato_id y pct_avance son requeridos.' },
          { status: 400 },
        );
      }
      const contrato = await patchPctAvanceContrato(admin.client, contratoId, pct);
      return NextResponse.json({ ok: true, contrato });
    }

    if (body.action === 'repartir') {
      const compraId = String(body.compra_id ?? '').trim();
      const asignaciones = Array.isArray(body.asignaciones) ? body.asignaciones : [];
      if (!compraId || !asignaciones.length) {
        return NextResponse.json(
          { ok: false, error: 'compra_id y asignaciones[] son requeridos.' },
          { status: 400 },
        );
      }
      const result = await repartirSacoHuerfano(admin.client, {
        compra_id: compraId,
        asignaciones: asignaciones.map((a) => ({
          contrato_id: String(a.contrato_id ?? ''),
          monto_usd: Number(a.monto_usd),
        })),
      });
      const db = admin.client as SupabaseClient;
      if (result.proyecto_id) {
        await db.from('cco_auditoria_eventos').insert({
          proyecto_id: result.proyecto_id,
          accion: 'REPARTIO SACO CONTRATISTA',
          detalle: `Huérfano ${compraId} → ${result.vinculados} vínculo(s), resto $${result.resto_usd}`,
          metadata: { ...result, compra_origen: compraId },
        });
      }
      return NextResponse.json({ ok: true, ...result });
    }

    if (body.action === 'vincular') {
      const contratoId = String(body.contrato_id ?? '').trim();
      const compraIds = Array.isArray(body.compra_ids) ? body.compra_ids.map(String) : [];
      if (!contratoId || !compraIds.length) {
        return NextResponse.json(
          { ok: false, error: 'contrato_id y compra_ids[] son requeridos.' },
          { status: 400 },
        );
      }
      const n = await vincularPagosAContrato(admin.client, contratoId, compraIds);
      return NextResponse.json({ ok: true, vinculados: n });
    }

    const proyectoId = String(body.proyecto_id ?? '').trim();
    const proveedor = String(body.proveedor ?? '').trim();
    const descripcion = String(body.descripcion ?? '').trim();
    const monto = Number(body.monto_base_usd);
    if (!proyectoId || !proveedor || !descripcion || !Number.isFinite(monto) || monto < 0) {
      return NextResponse.json(
        { ok: false, error: 'proyecto_id, proveedor, descripcion y monto_base_usd son requeridos.' },
        { status: 400 },
      );
    }

    const { data: cfg } = await admin.client
      .from('cco_proyecto_config')
      .select('honorarios_admin_pct')
      .eq('proyecto_id', proyectoId)
      .maybeSingle();
    const pctGlobal =
      Number((cfg as { honorarios_admin_pct?: number } | null)?.honorarios_admin_pct) || 15;

    const contrato = await upsertContratoObra(admin.client, {
      id: body.id,
      proyecto_id: proyectoId,
      proveedor,
      descripcion,
      fecha: body.fecha ?? null,
      monto_base_usd: monto,
      admin_pct: body.admin_pct,
      pct_global: pctGlobal,
      estado: body.estado,
      pct_avance: body.pct_avance != null ? Number(body.pct_avance) : undefined,
    });

    const db = admin.client as SupabaseClient;
    await db.from('cco_auditoria_eventos').insert({
      proyecto_id: proyectoId,
      accion: body.id ? 'ACTUALIZO CONTRATO' : 'REGISTRO CONTRATO',
      detalle: `${proveedor} · ${descripcion} · $${monto}`,
      metadata: { contrato_id: contrato.id },
    });

    return NextResponse.json({ ok: true, contrato });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al guardar contrato CCO.';
    return NextResponse.json(
      { ok: false, error: message, hint: schemaHint(message) },
      { status: 500 },
    );
  }
}
