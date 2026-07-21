import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { IMPUTACION_OBRA } from '@/lib/contabilidad/imputacionCompra';
import { proveedorYRifParaCompraCco } from '@/lib/contabilidad/rifVenezolano';
import { upsertCompraContableDedup } from '@/lib/contabilidad/upsertCompraContableDedup';
import { aplicarHonorariosABase } from '@/lib/contabilidad/cco/honorarios';
import { normalizarTipoGastoCco } from '@/lib/contabilidad/cco/normalizarTipoGasto';
import { clasificarTipoGasto } from '@/lib/contabilidad/ccoClasificarGasto';
import {
  materializarSplits,
  validarSplits,
  type CcoSplitParte,
} from '@/lib/contabilidad/cco/splitGasto';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const dynamic = 'force-dynamic';

type Body = {
  proyecto_id?: string;
  fecha?: string;
  proveedor?: string;
  descripcion?: string;
  monto_usd?: number;
  tipo_gasto_cco?: string;
  admin_pct?: number | null;
  forma_pago?: string;
  contrato_obra_id?: string | null;
  splits?: CcoSplitParte[];
};

/**
 * POST distribución masiva: 1 gasto → N compras obra con % por capítulo (sin stock).
 */
export async function POST(req: Request) {
  try {
    const admin = supabaseAdminForRoute();
    if (!admin.ok) return admin.response;

    const body = (await req.json()) as Body;
    const proyectoId = String(body.proyecto_id ?? '').trim();
    const proveedor = String(body.proveedor ?? '').trim();
    const descripcion = String(body.descripcion ?? '').trim();
    const montoUsd = Number(body.monto_usd);
    const fecha = (body.fecha ?? new Date().toISOString().slice(0, 10)).slice(0, 10);
    const splits = Array.isArray(body.splits) ? body.splits : [];

    if (!proyectoId || !proveedor || !descripcion) {
      return NextResponse.json(
        { ok: false, error: 'proyecto_id, proveedor y descripcion son requeridos.' },
        { status: 400 },
      );
    }
    if (!Number.isFinite(montoUsd) || montoUsd <= 0) {
      return NextResponse.json({ ok: false, error: 'monto_usd debe ser > 0.' }, { status: 400 });
    }

    const valid = validarSplits(splits);
    if (!valid.ok) {
      return NextResponse.json({ ok: false, error: valid.error }, { status: 400 });
    }

    const { data: cfg } = await admin.client
      .from('cco_proyecto_config')
      .select('honorarios_admin_pct')
      .eq('proyecto_id', proyectoId)
      .maybeSingle();
    const pctGlobal =
      Number((cfg as { honorarios_admin_pct?: number } | null)?.honorarios_admin_pct) || 15;

    const tipo =
      normalizarTipoGastoCco(body.tipo_gasto_cco) ?? clasificarTipoGasto(proveedor);
    const partes = materializarSplits(montoUsd, descripcion, splits);
    const creados: string[] = [];
    const errores: string[] = [];
    const batch = Date.now().toString(36).toUpperCase();

    for (let i = 0; i < partes.length; i++) {
      const p = partes[i];
      const calc = aplicarHonorariosABase(p.monto_usd, body.admin_pct, pctGlobal);
      const invoice = `CCO-SPLIT-${batch}-${i + 1}`;
      const { supplier_name: proveedorResuelto, supplier_rif } =
        proveedorYRifParaCompraCco(proveedor);
      const up = await upsertCompraContableDedup(admin.client, {
        proyecto_id: proyectoId,
        imputacion: IMPUTACION_OBRA,
        invoice_number: invoice,
        supplier_rif,
        supplier_name: proveedorResuelto,
        fecha,
        monto_ves: 0,
        monto_usd: p.monto_usd,
        tasa_bcv_ves_por_usd: 0,
        moneda_original: 'USD',
        origen: 'cco_distribucion',
        notas: p.descripcion.slice(0, 800),
        upsert: true,
        lineas: [
          {
            descripcion: p.descripcion.slice(0, 400),
            cantidad: 1,
            precio_unitario: p.monto_usd,
            subtotal: p.monto_usd,
            unidad: 'UND',
          },
        ],
        cco: {
          tipo_gasto_cco: tipo,
          contrato_obra_id: body.contrato_obra_id ?? null,
          admin_pct_override: body.admin_pct ?? null,
          honorarios_usd: calc.honorariosUsd,
          capitulo_cco: p.capitulo,
          subcapitulo_cco: p.subcapitulo,
          forma_pago_cco: body.forma_pago?.trim() || null,
          cco_estado: 'PAGADO',
        },
      });
      if (!up.ok) errores.push(`${p.capitulo}: ${up.error}`);
      else creados.push(up.id);
    }

    const db = admin.client as SupabaseClient;
    await db.from('cco_auditoria_eventos').insert({
      proyecto_id: proyectoId,
      accion: 'DISTRIBUCION MASIVA',
      detalle: `${proveedor} · $${montoUsd} → ${creados.length} partes · ${descripcion}`,
      metadata: { creados, errores, batch },
    });

    if (errores.length && !creados.length) {
      return NextResponse.json({ ok: false, error: errores.join('; ') }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      creados: creados.length,
      ids: creados,
      partes,
      errores,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error en distribución masiva.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

/** GET ?proyecto= — capítulos sugeridos (estructura + usados). */
export async function GET(req: Request) {
  try {
    const admin = supabaseAdminForRoute();
    if (!admin.ok) return admin.response;

    const proyectoId = new URL(req.url).searchParams.get('proyecto')?.trim();
    if (!proyectoId) {
      return NextResponse.json({ ok: false, error: 'Falta ?proyecto=' }, { status: 400 });
    }

    const { data: estr } = await admin.client
      .from('cco_estructura_costos')
      .select('nombre,tipo_nivel,padre_id')
      .eq('proyecto_id', proyectoId)
      .order('nombre');

    const { data: usados } = await admin.client
      .from('contabilidad_compras')
      .select('capitulo_cco,subcapitulo_cco')
      .eq('proyecto_id', proyectoId)
      .not('capitulo_cco', 'is', null)
      .limit(2000);

    const capitulos = new Set<string>();
    const subPorCap = new Map<string, Set<string>>();

    for (const e of estr ?? []) {
      const r = e as { nombre?: string; tipo_nivel?: string };
      const n = String(r.nombre ?? '').trim();
      if (!n) continue;
      if (r.tipo_nivel === 'CAPITULO') capitulos.add(n);
    }
    for (const u of usados ?? []) {
      const cap = String((u as { capitulo_cco?: string }).capitulo_cco ?? '').trim();
      const sub = String((u as { subcapitulo_cco?: string }).subcapitulo_cco ?? '').trim();
      if (!cap) continue;
      capitulos.add(cap);
      if (sub) {
        if (!subPorCap.has(cap)) subPorCap.set(cap, new Set());
        subPorCap.get(cap)!.add(sub);
      }
    }

    return NextResponse.json({
      ok: true,
      capitulos: Array.from(capitulos).sort((a, b) => a.localeCompare(b, 'es')),
      subcapitulos: Object.fromEntries(
        Array.from(subPorCap.entries()).map(([k, v]) => [
          k,
          Array.from(v).sort((a, b) => a.localeCompare(b, 'es')),
        ]),
      ),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al cargar capítulos.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
