import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { cargarPresupuestosCco } from '@/lib/contabilidad/cco/cargarPresupuestos';
import {
  construirDetalleCambios,
  registrarEventoAuditoriaCco,
  type ResumenCambioFila,
} from '@/lib/contabilidad/cco/registrarAuditoria';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';
import { requireCcoAcceso } from '@/lib/auth/requireCcoRoute';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const accesoCco = await requireCcoAcceso('ver');
    if (!accesoCco.ok) return accesoCco.response;

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
      ? 'Ejecuta las migraciones 269_cco_obra_fusion_v4.sql y 278_cco_presupuestos_capitulo_area_m2.sql.'
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
    area_m2?: number;
  }>;
};

function isMissingAreaColumn(msg: string): boolean {
  return /area_m2|schema cache|42703|PGRST204/i.test(msg);
}

/** PATCH: actualiza estimado/área; crea fila si viene de `exec-*`. */
export async function PATCH(req: Request) {
  try {
    const accesoCco = await requireCcoAcceso('editar');
    if (!accesoCco.ok) return accesoCco.response;

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
      if (!id) {
        errores.push('?: fila sin id');
        continue;
      }

      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (c.capitulo != null) patch.capitulo = String(c.capitulo).trim();
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
      let areaVal: number | undefined;
      if (c.area_m2 !== undefined) {
        const n = Number(c.area_m2);
        if (!Number.isFinite(n) || n < 0) {
          errores.push(`${id}: área inválida`);
          continue;
        }
        areaVal = Math.round(n * 100) / 100;
        patch.area_m2 = areaVal;
      }

      if (id.startsWith('exec-')) {
        const capitulo =
          (c.capitulo != null ? String(c.capitulo).trim() : '') ||
          id.replace(/^exec-/i, '').trim();
        if (!capitulo) {
          errores.push(`${id}: capítulo requerido para crear presupuesto`);
          continue;
        }
        const insertRow: Record<string, unknown> = {
          proyecto_id: proyectoId,
          capitulo,
          subcapitulo: patch.subcapitulo ?? null,
          descripcion: patch.descripcion ?? null,
          estimado_usd: patch.estimado_usd ?? 0,
        };
        if (areaVal !== undefined) insertRow.area_m2 = areaVal;

        let { error } = await db.from('cco_presupuestos_capitulo').insert(insertRow);
        if (error && isMissingAreaColumn(error.message ?? '') && 'area_m2' in insertRow) {
          delete insertRow.area_m2;
          const retry = await db.from('cco_presupuestos_capitulo').insert(insertRow);
          error = retry.error;
          if (!error) {
            errores.push(
              `${id}: guardado sin área (aplica migración 278_cco_presupuestos_capitulo_area_m2.sql)`,
            );
          }
        }
        if (error) {
          errores.push(`${id}: ${error.message}`);
          continue;
        }
        updated += 1;
        continue;
      }

      const keys = Object.keys(patch).filter((k) => k !== 'updated_at');
      if (keys.length === 0) continue;

      let { error } = await db
        .from('cco_presupuestos_capitulo')
        .update(patch)
        .eq('id', id)
        .eq('proyecto_id', proyectoId);

      if (error && isMissingAreaColumn(error.message ?? '') && 'area_m2' in patch) {
        delete patch.area_m2;
        const retryKeys = Object.keys(patch).filter((k) => k !== 'updated_at');
        if (retryKeys.length === 0) {
          errores.push(
            `${id}: no se pudo guardar área (aplica migración 278_cco_presupuestos_capitulo_area_m2.sql)`,
          );
          continue;
        }
        const retry = await db
          .from('cco_presupuestos_capitulo')
          .update(patch)
          .eq('id', id)
          .eq('proyecto_id', proyectoId);
        error = retry.error;
        if (!error) {
          errores.push(
            `${id}: estimado guardado; área omitida (migración 278 pendiente)`,
          );
        }
      }

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
