import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';
import { resolverTasaBcvVesPorUsd } from '@/lib/finanzas/bcvTasaPorFecha';
import {
  contarSemanasTrabajadasPrevias,
  guardarPeriodoNomina,
  previewItemsNomina,
  type ItemEntradaNomina,
} from '@/lib/nomina/persistirSemanaObra';
import {
  esClasePagoObra,
  type ClasePagoObra,
  FECHA_ANCLAJE_CESTA_ISO,
} from '@/lib/nomina/reglasPagoObra';
import { domingoDeSemanaIso, esMigracionNomina332Pendiente, lunesDeSemanaIso } from '@/lib/nomina/semanaIsoNomina';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function exigirSesion() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

function parseItems(raw: unknown): ItemEntradaNomina[] {
  if (!Array.isArray(raw)) return [];
  const out: ItemEntradaNomina[] = [];
  for (const r of raw) {
    const o = r as Record<string, unknown>;
    const empleado_id = String(o.empleado_id ?? '').trim();
    const claseRaw = String(o.clase ?? '').trim();
    if (!empleado_id || !esClasePagoObra(claseRaw)) continue;
    out.push({
      empleado_id,
      clase: claseRaw as ClasePagoObra,
      dias_laborados: Number(o.dias_laborados ?? 0),
      cargo_codigo: o.cargo_codigo != null ? String(o.cargo_codigo) : null,
      cargo_nombre: o.cargo_nombre != null ? String(o.cargo_nombre) : null,
      incluir_adelanto: o.incluir_adelanto !== false,
    });
  }
  return out;
}

export async function GET(req: Request) {
  const user = await exigirSesion();
  if (!user) return NextResponse.json({ error: 'Inicia sesión.' }, { status: 401 });

  const url = new URL(req.url);
  const proyectoId = url.searchParams.get('proyecto_id')?.trim() ?? '';
  const semana = lunesDeSemanaIso(url.searchParams.get('semana')?.trim() || new Date().toISOString().slice(0, 10));
  if (!proyectoId) return NextResponse.json({ error: 'Falta proyecto_id.' }, { status: 400 });

  const admin = supabaseAdminForRoute();
  const db = admin.ok ? admin.client : await createClient();

  const { data, error } = await db
    .from('ci_nomina_periodos')
    .select('id, semana_inicio, semana_fin, tasa_bcv_pago, tasa_ancla_cesta_bcv, estado, ci_nomina_items(*)')
    .eq('proyecto_id', proyectoId)
    .eq('semana_inicio', semana)
    .maybeSingle();
  if (error && esMigracionNomina332Pendiente(error.message)) {
    return NextResponse.json(
      { error: 'Migración 332 pendiente en Supabase (nómina semanal de obra).', code: 'MIGRATION_332' },
      { status: 503 },
    );
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({
    semana_inicio: semana,
    semana_fin: domingoDeSemanaIso(semana),
    periodo: data ?? null,
  });
}

export async function POST(req: Request) {
  const user = await exigirSesion();
  if (!user) return NextResponse.json({ error: 'Inicia sesión.' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const proyectoId = String(body.proyecto_id ?? '').trim();
  const semana = lunesDeSemanaIso(String(body.semana_inicio ?? body.semana ?? '').trim() || new Date().toISOString());
  const items = parseItems(body.items);
  const soloPreview = body.preview === true || body.guardar === false;
  if (!proyectoId) return NextResponse.json({ error: 'Falta proyecto_id.' }, { status: 400 });
  if (!items.length) return NextResponse.json({ error: 'No hay obreros en la semana.' }, { status: 400 });

  let tasaBcv = Number(body.tasa_bcv_pago);
  if (!Number.isFinite(tasaBcv) || tasaBcv <= 0) {
    const r = await resolverTasaBcvVesPorUsd(new Date().toISOString().slice(0, 10));
    tasaBcv = r.tasa_bcv_ves_por_usd;
  }
  let tasaAncla = Number(body.tasa_ancla_cesta_bcv);
  if (!Number.isFinite(tasaAncla) || tasaAncla <= 0) {
    const r = await resolverTasaBcvVesPorUsd(FECHA_ANCLAJE_CESTA_ISO);
    // Si no hay BCV de la homologación, anclar a la tasa del pago (evita inflar la cesta).
    tasaAncla = r.fuente === 'fallback' ? tasaBcv : r.tasa_bcv_ves_por_usd;
    if (!Number.isFinite(tasaAncla) || tasaAncla <= 0) tasaAncla = tasaBcv;
  }

  const admin = supabaseAdminForRoute();
  const db = admin.ok ? admin.client : await createClient();

  try {
    if (soloPreview) {
      const previasPorEmpleado: Record<string, number> = {};
      for (const it of items) {
        try {
          previasPorEmpleado[it.empleado_id] = await contarSemanasTrabajadasPrevias(
            db,
            proyectoId,
            it.empleado_id,
            semana,
          );
        } catch (e) {
          const msg = e instanceof Error ? e.message : '';
          if (msg.includes('Migración 332')) {
            previasPorEmpleado[it.empleado_id] = 0;
          } else throw e;
        }
      }
      const previews = previewItemsNomina({
        items,
        previasPorEmpleado,
        tasaBcvPago: tasaBcv,
        tasaAnclaCestaBcv: tasaAncla,
      });
      return NextResponse.json({
        preview: true,
        semana_inicio: semana,
        semana_fin: domingoDeSemanaIso(semana),
        tasa_bcv_pago: tasaBcv,
        tasa_ancla_cesta_bcv: tasaAncla,
        items: previews,
      });
    }

    const saved = await guardarPeriodoNomina(db, {
      proyectoId,
      semanaInicio: semana,
      tasaBcvPago: tasaBcv,
      tasaAnclaCestaBcv: tasaAncla,
      items,
      marcarPagado: body.marcar_pagado === true,
    });
    return NextResponse.json({
      ok: true,
      semana_inicio: semana,
      semana_fin: domingoDeSemanaIso(semana),
      tasa_bcv_pago: tasaBcv,
      tasa_ancla_cesta_bcv: tasaAncla,
      ...saved,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'No se pudo calcular la semana.';
    const status = msg.includes('Migración 332') ? 503 : 400;
    return NextResponse.json(
      { error: msg, code: status === 503 ? 'MIGRATION_332' : undefined },
      { status },
    );
  }
}
