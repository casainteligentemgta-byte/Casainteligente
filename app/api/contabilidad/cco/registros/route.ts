import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { IMPUTACION_OBRA } from '@/lib/contabilidad/imputacionCompra';
import { proveedorYRifParaCompraCco } from '@/lib/contabilidad/rifVenezolano';
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

    const { supplier_name: proveedorResuelto, supplier_rif } = proveedorYRifParaCompraCco(proveedor);
    const up = await upsertCompraContableDedup(admin.client, {
      proyecto_id: proyectoId,
      imputacion: IMPUTACION_OBRA,
      invoice_number: invoice,
      supplier_rif,
      supplier_name: proveedorResuelto,
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

type PatchCambio = {
  id?: string;
  fecha?: string;
  proveedor?: string;
  descripcion?: string;
  moneda?: string;
  tasa?: number;
  monto_orig?: number;
  admin_pct?: number | null;
  tipo?: string;
  capitulo?: string;
  subcapitulo?: string;
  estado?: string;
  forma_pago?: string | null;
};

type PatchBody = {
  proyecto_id?: string;
  clase?: 'GASTO' | 'INGRESO';
  cambios?: PatchCambio[];
  eliminar_ids?: string[];
};

/**
 * PATCH egresos/ingresos: guarda cambios de filas editables del cuadro V4.
 * clase=INGRESO → ci_inyecciones_capital; default GASTO → contabilidad_compras.
 */
export async function PATCH(req: Request) {
  try {
    const admin = supabaseAdminForRoute();
    if (!admin.ok) return admin.response;

    const body = (await req.json()) as PatchBody;
    const proyectoId = String(body.proyecto_id ?? '').trim();
    const clase = String(body.clase ?? 'GASTO').toUpperCase() === 'INGRESO' ? 'INGRESO' : 'GASTO';
    const cambios = Array.isArray(body.cambios) ? body.cambios : [];
    const eliminarIds = Array.isArray(body.eliminar_ids)
      ? body.eliminar_ids.map((x) => String(x).trim()).filter(Boolean)
      : [];
    if (!proyectoId || (cambios.length === 0 && eliminarIds.length === 0)) {
      return NextResponse.json(
        { ok: false, error: 'proyecto_id y cambios[] o eliminar_ids[] son requeridos.' },
        { status: 400 },
      );
    }
    if (cambios.length > 500 || eliminarIds.length > 200) {
      return NextResponse.json(
        { ok: false, error: 'Límite de filas excedido (500 cambios / 200 bajas).' },
        { status: 400 },
      );
    }

    const db = admin.client as SupabaseClient;
    let updated = 0;
    let deleted = 0;
    const errores: string[] = [];

    if (clase === 'INGRESO') {
      const { buildOrigenIngreso, parseOrigenIngreso } = await import(
        '@/lib/contabilidad/cco/ingresosVista'
      );

      for (const id of eliminarIds) {
        const { error: delErr } = await db
          .from('ci_inyecciones_capital')
          .delete()
          .eq('id', id)
          .eq('proyecto_id', proyectoId);
        if (delErr) errores.push(`${id}: ${delErr.message}`);
        else deleted += 1;
      }

      for (const c of cambios) {
        const id = String(c.id ?? '').trim();
        if (!id) {
          errores.push('Fila sin id');
          continue;
        }
        const { data: prev, error: prevErr } = await db
          .from('ci_inyecciones_capital')
          .select(
            'id,origen_fondo,moneda_recibida,monto_usd,monto_ves,monto_recibido,tasa_aplicada,tasa_bcv,metodo_pago,fecha_ingreso',
          )
          .eq('id', id)
          .eq('proyecto_id', proyectoId)
          .maybeSingle();
        if (prevErr || !prev) {
          errores.push(`${id}: no encontrado`);
          continue;
        }
        const prevR = prev as unknown as Record<string, unknown>;
        const parsed = parseOrigenIngreso(String(prevR.origen_fondo ?? ''));
        const proveedor = c.proveedor != null ? String(c.proveedor).trim() : parsed.proveedor;
        const descripcion =
          c.descripcion != null ? String(c.descripcion).trim() : parsed.descripcion;
        const moneda = String(c.moneda ?? prevR.moneda_recibida ?? 'USD')
          .toUpperCase()
          .startsWith('VE')
          ? 'VES'
          : 'USD';
        const tasa = Number(c.tasa);
        const tasaOk =
          Number.isFinite(tasa) && tasa > 0
            ? tasa
            : Number(prevR.tasa_aplicada) || Number(prevR.tasa_bcv) || 1;
        const montoOrig = Number(c.monto_orig);
        const montoOrigOk =
          Number.isFinite(montoOrig) && montoOrig > 0
            ? montoOrig
            : Number(prevR.monto_recibido) || Number(prevR.monto_usd) || 0;
        const montoUsd =
          moneda === 'VES' ? (tasaOk > 0 ? montoOrigOk / tasaOk : Number(prevR.monto_usd)) : montoOrigOk;
        const montoVes = moneda === 'VES' ? montoOrigOk : montoOrigOk * (tasaOk > 1 ? tasaOk : 0);
        const forma = String(c.forma_pago ?? prevR.metodo_pago ?? 'TRANSFERENCIA').toUpperCase();
        const metodo = /EFECTIVO/.test(forma) ? 'EFECTIVO' : 'TRANSFERENCIA';

        const patch: Record<string, unknown> = {
          origen_fondo: buildOrigenIngreso({
            origen_v4_id: parsed.origen_v4_id,
            proveedor,
            descripcion,
          }),
          moneda_recibida: moneda,
          monto_recibido: Math.round(montoOrigOk * 100) / 100,
          monto_usd: Math.round(montoUsd * 100) / 100,
          monto_ves: Math.round(montoVes * 100) / 100,
          tasa_aplicada: tasaOk,
          tasa_bcv: moneda === 'VES' ? tasaOk : null,
          metodo_pago: metodo,
        };
        if (c.fecha != null) patch.fecha_ingreso = String(c.fecha).slice(0, 10);

        const { error: upErr } = await db
          .from('ci_inyecciones_capital')
          .update(patch)
          .eq('id', id);
        if (upErr) {
          errores.push(`${id}: ${upErr.message}`);
          continue;
        }
        updated += 1;
      }

      if (updated > 0 || deleted > 0) {
        await db.from('cco_auditoria_eventos').insert({
          proyecto_id: proyectoId,
          accion: 'GUARDAR INGRESOS',
          detalle: `${updated} actualizada(s) · ${deleted} eliminada(s)`,
          metadata: { updated, deleted, errores: errores.slice(0, 20) },
        });
      }

      return NextResponse.json({
        ok: errores.length === 0,
        updated,
        deleted,
        errores,
        error: errores.length ? errores[0] : undefined,
      });
    }

    const { data: cfg } = await admin.client
      .from('cco_proyecto_config')
      .select('honorarios_admin_pct')
      .eq('proyecto_id', proyectoId)
      .maybeSingle();
    const pctGlobal =
      Number((cfg as { honorarios_admin_pct?: number } | null)?.honorarios_admin_pct) || 15;

    for (const c of cambios) {
      const id = String(c.id ?? '').trim();
      if (!id) {
        errores.push('Fila sin id');
        continue;
      }

      const { data: prev, error: prevErr } = await db
        .from('contabilidad_compras')
        .select(
          'id,proyecto_id,moneda_original,monto_usd,monto_ves,tasa_bcv_ves_por_usd,admin_pct_override,notas,supplier_name,fecha',
        )
        .eq('id', id)
        .eq('proyecto_id', proyectoId)
        .maybeSingle();
      if (prevErr || !prev) {
        errores.push(`${id}: no encontrado`);
        continue;
      }

      const prevR = prev as Record<string, unknown>;
      const moneda = String(c.moneda ?? prevR.moneda_original ?? 'USD')
        .toUpperCase()
        .startsWith('VE')
        ? 'VES'
        : 'USD';
      const tasa = Number(c.tasa);
      const tasaOk = Number.isFinite(tasa) && tasa > 0 ? tasa : Number(prevR.tasa_bcv_ves_por_usd) || 0;
      const montoOrig = Number(c.monto_orig);
      const montoOrigOk = Number.isFinite(montoOrig) && montoOrig >= 0 ? montoOrig : null;

      let montoUsd = Number(prevR.monto_usd) || 0;
      let montoVes = Number(prevR.monto_ves) || 0;
      if (montoOrigOk != null) {
        if (moneda === 'VES') {
          montoVes = montoOrigOk;
          montoUsd = tasaOk > 0 ? montoOrigOk / tasaOk : montoUsd;
        } else {
          montoUsd = montoOrigOk;
          montoVes = tasaOk > 0 ? montoOrigOk * tasaOk : montoVes;
        }
      } else if (c.tasa != null && Number.isFinite(tasa) && tasa > 0 && moneda === 'VES' && montoVes > 0) {
        montoUsd = montoVes / tasa;
      }

      const adminPct =
        c.admin_pct === null
          ? null
          : c.admin_pct !== undefined
            ? Number(c.admin_pct)
            : prevR.admin_pct_override != null
              ? Number(prevR.admin_pct_override)
              : null;
      const calc = aplicarHonorariosABase(
        montoUsd,
        adminPct != null && Number.isFinite(adminPct) ? adminPct : null,
        pctGlobal,
      );

      const patch: Record<string, unknown> = {
        monto_usd: Math.round(montoUsd * 10000) / 10000,
        monto_ves: Math.round(montoVes * 100) / 100,
        moneda_original: moneda,
        tasa_bcv_ves_por_usd: tasaOk > 0 ? tasaOk : 0,
        honorarios_usd: calc.honorariosUsd,
        admin_pct_override:
          adminPct != null && Number.isFinite(adminPct) && adminPct > 0 ? adminPct : null,
      };
      if (c.fecha != null) patch.fecha = String(c.fecha).slice(0, 10);
      if (c.proveedor != null) patch.supplier_name = String(c.proveedor).trim() || 'Sin proveedor';
      if (c.descripcion != null) patch.notas = String(c.descripcion).trim().slice(0, 800);
      if (c.tipo != null) patch.tipo_gasto_cco = String(c.tipo).trim() || null;
      if (c.capitulo != null) patch.capitulo_cco = String(c.capitulo).trim() || null;
      if (c.subcapitulo != null) patch.subcapitulo_cco = String(c.subcapitulo).trim() || null;
      if (c.estado != null) patch.cco_estado = String(c.estado).trim() || 'PAGADO';
      if (c.forma_pago !== undefined) {
        patch.forma_pago_cco = c.forma_pago ? String(c.forma_pago).trim() : null;
      }

      const { error: upErr } = await db.from('contabilidad_compras').update(patch).eq('id', id);
      if (upErr) {
        errores.push(`${id}: ${upErr.message}`);
        continue;
      }
      updated += 1;
    }

    if (updated > 0) {
      await db.from('cco_auditoria_eventos').insert({
        proyecto_id: proyectoId,
        accion: 'GUARDAR EGRESOS',
        detalle: `${updated} fila(s) actualizada(s)`,
        metadata: { updated, errores: errores.slice(0, 20) },
      });
    }

    return NextResponse.json({
      ok: errores.length === 0,
      updated,
      deleted: 0,
      errores,
      error: errores.length ? errores[0] : undefined,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al guardar registros CCO.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
