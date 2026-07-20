import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { cargarPresupuestosCco } from '@/lib/contabilidad/cco/cargarPresupuestos';
import {
  construirDetalleCambios,
  registrarEventoAuditoriaCco,
  type ResumenCambioFila,
} from '@/lib/contabilidad/cco/registrarAuditoria';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const admin = supabaseAdminForRoute();
    if (!admin.ok) return admin.response;

    const proyectoId = new URL(req.url).searchParams.get('proyecto')?.trim();
    if (!proyectoId) {
      return NextResponse.json({ ok: false, error: 'Falta ?proyecto=' }, { status: 400 });
    }

    const data = await cargarPresupuestosCco(admin.client, proyectoId);
    return NextResponse.json({ ok: true, ...data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al cargar presupuestos CCO.';
    const hint = /cco_presupuestos|schema cache/i.test(message)
      ? 'Ejecuta la migración 269_cco_obra_fusion_v4.sql.'
      : undefined;
    return NextResponse.json({ ok: false, error: message, hint }, { status: 500 });
  }
}

type PatchBody = {
  proyecto_id?: string;
  cambios?: Array<{
    id?: string;
    capitulo?: string;
    subcapitulo?: string | null;
    descripcion?: string | null;
    estimado_usd?: number;
  }>;
};

/** PATCH: actualiza estimado/descripcion de filas reales (no `exec-*`). */
export async function PATCH(req: Request) {
  try {
    const admin = supabaseAdminForRoute();
    if (!admin.ok) return admin.response;

    const body = (await req.json()) as PatchBody;
    const proyectoId = String(body.proyecto_id ?? '').trim();
    const cambios = Array.isArray(body.cambios) ? body.cambios : [];
    if (!proyectoId || cambios.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'proyecto_id y cambios[] son requeridos.' },
        { status: 400 },
      );
    }

    const db = admin.client as SupabaseClient;
    let updated = 0;
    const errores: string[] = [];
    const resúmenes: ResumenCambioFila[] = [];

    for (const c of cambios) {
      const id = String(c.id ?? '').trim();
      if (!id || id.startsWith('exec-')) {
        errores.push(`${id || '?'}: fila no editable`);
        continue;
      }

      const { data: prev } = await db
        .from('cco_presupuestos_capitulo')
        .select('id,capitulo,subcapitulo,descripcion,estimado_usd')
        .eq('id', id)
        .eq('proyecto_id', proyectoId)
        .maybeSingle();
      if (!prev) {
        errores.push(`${id}: no encontrado`);
        continue;
      }
      const prevR = prev as Record<string, unknown>;

      const patch: Record<string, unknown> = {};
      const cambiosFila: string[] = [];
      if (c.capitulo != null) {
        patch.capitulo = String(c.capitulo).trim();
        if (String(prevR.capitulo ?? '') !== String(patch.capitulo)) {
          cambiosFila.push(`capítulo: «${prevR.capitulo}» → «${patch.capitulo}»`);
        }
      }
      if (c.subcapitulo !== undefined) {
        patch.subcapitulo = c.subcapitulo ? String(c.subcapitulo).trim() : null;
        if (String(prevR.subcapitulo ?? '') !== String(patch.subcapitulo ?? '')) {
          cambiosFila.push(`subcapítulo: «${prevR.subcapitulo ?? ''}» → «${patch.subcapitulo ?? ''}»`);
        }
      }
      if (c.descripcion !== undefined) {
        patch.descripcion = c.descripcion ? String(c.descripcion).trim() : null;
        if (String(prevR.descripcion ?? '') !== String(patch.descripcion ?? '')) {
          cambiosFila.push(
            `descripción: «${String(prevR.descripcion ?? '').slice(0, 40)}» → «${String(patch.descripcion ?? '').slice(0, 40)}»`,
          );
        }
      }
      if (c.estimado_usd !== undefined) {
        const n = Number(c.estimado_usd);
        if (!Number.isFinite(n) || n < 0) {
          errores.push(`${id}: estimado inválido`);
          continue;
        }
        patch.estimado_usd = Math.round(n * 100) / 100;
        if (Number(prevR.estimado_usd) !== Number(patch.estimado_usd)) {
          cambiosFila.push(`estimado: $${prevR.estimado_usd} → $${patch.estimado_usd}`);
        }
      }
      if (Object.keys(patch).length === 0) continue;

      const { error } = await db
        .from('cco_presupuestos_capitulo')
        .update(patch)
        .eq('id', id)
        .eq('proyecto_id', proyectoId);
      if (error) {
        errores.push(`${id}: ${error.message}`);
        continue;
      }
      updated += 1;
      resúmenes.push({
        id,
        etiqueta: String(patch.capitulo ?? prevR.capitulo ?? id).slice(0, 40),
        cambios: cambiosFila.length ? cambiosFila : ['campos guardados'],
      });
    }

    if (updated > 0) {
      await registrarEventoAuditoriaCco(db, {
        proyecto_id: proyectoId,
        accion: 'GUARDAR PRESUPUESTOS',
        detalle: construirDetalleCambios({
          verbo: 'Editó presupuestos',
          filas: resúmenes,
        }),
        metadata: {
          updated,
          cambios_resumen: resúmenes.flatMap((r) =>
            r.cambios.map((ch) => `${r.etiqueta}: ${ch}`),
          ).slice(0, 30),
          errores: errores.slice(0, 20),
        },
      });
    }

    return NextResponse.json({
      ok: errores.length === 0,
      updated,
      errores,
      error: errores.length ? errores[0] : undefined,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al guardar presupuestos.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
