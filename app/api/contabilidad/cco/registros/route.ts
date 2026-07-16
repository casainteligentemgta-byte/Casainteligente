import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { IMPUTACION_OBRA } from '@/lib/contabilidad/imputacionCompra';
import { upsertCompraContableDedup } from '@/lib/contabilidad/upsertCompraContableDedup';
import { aplicarHonorariosABase } from '@/lib/contabilidad/cco/honorarios';
import { normalizarTipoGastoCco } from '@/lib/contabilidad/cco/normalizarTipoGasto';
import { clasificarTipoGasto } from '@/lib/contabilidad/ccoClasificarGasto';
import { upsertContratoObra } from '@/lib/contabilidad/cco/contratosJerarquia';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const dynamic = 'force-dynamic';

type Body = {
  clase?: 'GASTO' | 'INGRESO' | 'CONTRATO';
  proyecto_id?: string;
  fecha?: string;
  proveedor?: string;
  descripcion?: string;
  monto_usd?: number;
  tipo_gasto_cco?: string;
  capitulo_cco?: string;
  subcapitulo_cco?: string;
  admin_pct?: number | null;
  contrato_obra_id?: string | null;
  forma_pago?: string;
  moneda?: 'USD' | 'VES';
  tasa?: number;
};

/**
 * POST registro CCO: GASTO → compra obra; INGRESO → inyección; CONTRATO → cco_contratos_obra.
 * Sin stock.
 */
export async function POST(req: Request) {
  try {
    const admin = supabaseAdminForRoute();
    if (!admin.ok) return admin.response;

    const body = (await req.json()) as Body;
    const clase = String(body.clase ?? '').toUpperCase() as Body['clase'];
    const proyectoId = String(body.proyecto_id ?? '').trim();
    if (!proyectoId || !clase) {
      return NextResponse.json(
        { ok: false, error: 'proyecto_id y clase (GASTO|INGRESO|CONTRATO) son requeridos.' },
        { status: 400 },
      );
    }

    const fecha = (body.fecha ?? new Date().toISOString().slice(0, 10)).slice(0, 10);
    const montoUsd = Number(body.monto_usd);
    if (!Number.isFinite(montoUsd) || montoUsd < 0) {
      return NextResponse.json({ ok: false, error: 'monto_usd inválido.' }, { status: 400 });
    }

    const { data: cfg } = await admin.client
      .from('cco_proyecto_config')
      .select('honorarios_admin_pct')
      .eq('proyecto_id', proyectoId)
      .maybeSingle();
    const pctGlobal =
      Number((cfg as { honorarios_admin_pct?: number } | null)?.honorarios_admin_pct) || 15;

    if (clase === 'CONTRATO') {
      const proveedor = String(body.proveedor ?? '').trim();
      const descripcion = String(body.descripcion ?? '').trim();
      if (!proveedor || !descripcion) {
        return NextResponse.json(
          { ok: false, error: 'proveedor y descripcion requeridos para CONTRATO.' },
          { status: 400 },
        );
      }
      const contrato = await upsertContratoObra(admin.client, {
        proyecto_id: proyectoId,
        proveedor,
        descripcion,
        fecha,
        monto_base_usd: montoUsd,
        admin_pct: body.admin_pct,
        pct_global: pctGlobal,
      });
      return NextResponse.json({ ok: true, clase, id: contrato.id, contrato });
    }

    if (clase === 'INGRESO') {
      const descripcion = String(body.descripcion ?? 'Ingreso CCO').trim() || 'Ingreso CCO';
      const moneda = body.moneda === 'VES' ? 'VES' : 'USD';
      const tasa = Number(body.tasa) > 0 ? Number(body.tasa) : 1;
      const montoOrig = moneda === 'VES' ? montoUsd * tasa : montoUsd;
      const montoVes = moneda === 'VES' ? montoOrig : 0;
      const metodo = /EFECTIVO/i.test(String(body.forma_pago ?? '')) ? 'EFECTIVO' : 'TRANSFERENCIA';
      const origenFondo = `CCO · ${descripcion}`.slice(0, 200);

      const db = admin.client as SupabaseClient;
      const { data, error } = await db
        .from('ci_inyecciones_capital')
        .insert({
          proyecto_id: proyectoId,
          origen_fondo: origenFondo,
          monto_recibido: moneda === 'VES' ? montoOrig : montoUsd,
          moneda_recibida: moneda,
          monto_usd: montoUsd,
          monto_ves: montoVes,
          tasa_bcv: moneda === 'VES' ? tasa : null,
          tasa_aplicada: tasa,
          tipo_tasa: 'BCV',
          metodo_pago: metodo,
          banco_origen: metodo === 'TRANSFERENCIA' ? 'CCO' : 'EFECTIVO',
          cuenta_bancaria_destino: metodo === 'TRANSFERENCIA' ? 'CCO' : null,
          referencia_bancaria: metodo === 'TRANSFERENCIA' ? `CCO-${Date.now()}` : null,
          fecha_ingreso: fecha,
          creado_por: 'cco_editor',
        })
        .select('id')
        .single();
      if (error) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      }
      return NextResponse.json({
        ok: true,
        clase,
        id: String((data as { id: string }).id),
      });
    }

    // GASTO
    const proveedor = String(body.proveedor ?? '').trim() || 'Sin proveedor';
    const descripcion = String(body.descripcion ?? 'Gasto').trim() || 'Gasto';
    const tipo =
      normalizarTipoGastoCco(body.tipo_gasto_cco) ??
      clasificarTipoGasto(proveedor);
    const calc = aplicarHonorariosABase(montoUsd, body.admin_pct, pctGlobal);
    const invoice = `CCO-${fecha.replace(/-/g, '')}-${Date.now().toString(36).toUpperCase()}`;

    const up = await upsertCompraContableDedup(admin.client, {
      proyecto_id: proyectoId,
      imputacion: IMPUTACION_OBRA,
      invoice_number: invoice,
      supplier_rif: 'J-CCO',
      supplier_name: proveedor,
      fecha,
      monto_ves: 0,
      monto_usd: montoUsd,
      tasa_bcv_ves_por_usd: 0,
      moneda_original: 'USD',
      origen: 'cco_editor',
      notas: descripcion.slice(0, 800),
      upsert: true,
      lineas: [
        {
          descripcion: descripcion.slice(0, 400),
          cantidad: 1,
          precio_unitario: montoUsd,
          subtotal: montoUsd,
          unidad: 'UND',
        },
      ],
      cco: {
        tipo_gasto_cco: tipo,
        contrato_obra_id: body.contrato_obra_id ?? null,
        admin_pct_override: body.admin_pct ?? null,
        honorarios_usd: calc.honorariosUsd,
        capitulo_cco: body.capitulo_cco?.trim() || null,
        subcapitulo_cco: body.subcapitulo_cco?.trim() || null,
        forma_pago_cco: body.forma_pago?.trim() || null,
        cco_estado: 'PAGADO',
      },
    });

    if (!up.ok) {
      return NextResponse.json(
        { ok: false, error: up.error, hint: up.hint },
        { status: up.status },
      );
    }

    const db = admin.client as SupabaseClient;
    await db.from('cco_auditoria_eventos').insert({
      proyecto_id: proyectoId,
      accion: `REGISTRO ${clase}`,
      detalle: `${proveedor} · ${descripcion} · $${montoUsd}`,
      metadata: { compra_id: up.id, clase },
    });

    return NextResponse.json({ ok: true, clase, id: up.id, action: up.action });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al registrar en CCO.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
