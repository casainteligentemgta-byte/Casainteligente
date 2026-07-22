import type { SupabaseClient } from '@supabase/supabase-js';
import { esDescripcionAuditoriaCco } from '@/lib/contabilidad/compraEsAuditoriaCco';
import { IMPUTACION_OBRA } from '@/lib/contabilidad/imputacionCompra';
import { proveedorYRifParaCompraCco } from '@/lib/contabilidad/rifVenezolano';
import { upsertCompraContableDedup } from '@/lib/contabilidad/upsertCompraContableDedup';
import { clasificarTipoGasto } from '@/lib/contabilidad/ccoClasificarGasto';
import { aplicarHonorariosABase } from '@/lib/contabilidad/cco/honorarios';
import { normalizarTipoGastoCco } from '@/lib/contabilidad/cco/normalizarTipoGasto';
import { resolverContratoVinculado } from '@/lib/contabilidad/cco/vincularContrato';
import { normalizarDevaluacionConfig } from '@/lib/contabilidad/cco/tasas';
import { filtrarIngresosGemelosCsv, idsIngresosGemelosAEliminar } from '@/lib/contabilidad/cco/dedupeIngresosGemelos';

export type CcoV4EstructuraRow = {
  origen_v4_id: number;
  nombre: string;
  tipo_nivel: 'CAPITULO' | 'SUBCAPITULO';
  padre_origen_v4_id?: number | null;
};

export type CcoV4TransaccionRow = {
  origen_v4_id: number;
  clase: string;
  fecha?: string | null;
  proveedor?: string | null;
  tipo?: string | null;
  capitulo?: string | null;
  subcapitulo?: string | null;
  descripcion?: string | null;
  moneda?: string | null;
  tasa?: number | null;
  monto_orig?: number | null;
  monto_base_usd?: number | null;
  monto_pagado?: number | null;
  forma_pago?: string | null;
  estado?: string | null;
  honorarios?: number | null;
  costo_total?: number | null;
  porcentaje_admin?: number | null;
  tasa_binance?: number | null;
  tasa_usada?: string | null;
  porcentaje_brecha_real?: number | null;
  contrato_vinculado?: string | null;
};

export type CcoV4ImportPayload = {
  proyecto_id: string;
  honorarios_admin_pct?: number;
  devaluacion_pct?: number;
  obra_alias?: string | null;
  estructura?: CcoV4EstructuraRow[];
  transacciones: CcoV4TransaccionRow[];
  /** Si true, intenta vincular pagos CONTRATISTA a contratos por descripción. */
  auto_vincular?: boolean;
};

export type CcoV4ImportResult = {
  ok: true;
  gastos: { created: number; updated: number; skipped: number; errors: number };
  contratos: number;
  presupuestos: number;
  ingresos: number;
  ingresosGemelosOmitidos: number;
  ingresosGemelosEliminados: number;
  auditoria: number;
  estructura: number;
  vinculados: number;
  errores: string[];
};

export type CcoV4ImportProgress = {
  /** 0–100 */
  pct: number;
  etapa: string;
  actual: number;
  total: number;
};

export type CcoV4ImportOptions = {
  onProgress?: (p: CcoV4ImportProgress) => void | Promise<void>;
};

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function fechaIso(raw: string | null | undefined): string {
  const s = String(raw ?? '').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return new Date().toISOString().slice(0, 10);
}

export async function importarMaestroV4(
  supabase: SupabaseClient,
  payload: CcoV4ImportPayload,
  opts?: CcoV4ImportOptions,
): Promise<CcoV4ImportResult> {
  const proyectoId = payload.proyecto_id;
  const pctGlobal = num(payload.honorarios_admin_pct) || 15;
  const errores: string[] = [];
  const result: CcoV4ImportResult = {
    ok: true,
    gastos: { created: 0, updated: 0, skipped: 0, errors: 0 },
    contratos: 0,
    presupuestos: 0,
    ingresos: 0,
    ingresosGemelosOmitidos: 0,
    ingresosGemelosEliminados: 0,
    auditoria: 0,
    estructura: 0,
    vinculados: 0,
    errores,
  };

  const estructuraLen = (payload.estructura ?? []).length;
  const txsLen = (payload.transacciones ?? []).length;
  const totalWork = Math.max(1, estructuraLen + txsLen + 1);
  let doneWork = 0;
  let lastPctSent = -1;
  let lastDoneSent = 0;

  const report = async (etapa: string, force = false) => {
    // Reserva 0–4% para snapshot en la ruta; aquí 5–98.
    const pct = Math.min(98, Math.max(5, Math.round(5 + (doneWork / totalWork) * 93)));
    const minStep = Math.max(1, Math.floor(totalWork / 100));
    if (!force && pct === lastPctSent && doneWork - lastDoneSent < minStep) return;
    lastPctSent = pct;
    lastDoneSent = doneWork;
    await opts?.onProgress?.({ pct, etapa, actual: doneWork, total: totalWork });
  };

  await report('Configurando obra…', true);

  // No pisar devaluación/honorarios buenos con 0 del payload (CSV sin brechas).
  const { data: cfgExist } = await supabase
    .from('cco_proyecto_config')
    .select('honorarios_admin_pct,devaluacion_pct')
    .eq('proyecto_id', proyectoId)
    .maybeSingle();

  const devalPayload = num(payload.devaluacion_pct);
  const devalFinal =
    devalPayload !== 0
      ? normalizarDevaluacionConfig(devalPayload)
      : normalizarDevaluacionConfig(
          num((cfgExist as { devaluacion_pct?: number } | null)?.devaluacion_pct),
        );

  await supabase.from('cco_proyecto_config').upsert(
    {
      proyecto_id: proyectoId,
      honorarios_admin_pct: pctGlobal,
      devaluacion_pct: devalFinal,
      obra_alias: payload.obra_alias ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'proyecto_id' },
  );
  doneWork += 1;
  await report('Configurando obra…');

  // Estructura: primero capítulos, luego subcapítulos
  const estructuraIdByV4 = new Map<number, string>();
  const estructura = [...(payload.estructura ?? [])].sort((a, b) => {
    if (a.tipo_nivel === b.tipo_nivel) return a.origen_v4_id - b.origen_v4_id;
    return a.tipo_nivel === 'CAPITULO' ? -1 : 1;
  });

  for (const e of estructura) {
    const padreUuid =
      e.padre_origen_v4_id != null ? estructuraIdByV4.get(e.padre_origen_v4_id) ?? null : null;
    const { data, error } = await supabase
      .from('cco_estructura_costos')
      .upsert(
        {
          proyecto_id: proyectoId,
          nombre: e.nombre,
          tipo_nivel: e.tipo_nivel,
          padre_id: padreUuid,
          origen_v4_id: e.origen_v4_id,
        },
        { onConflict: 'proyecto_id,origen_v4_id' },
      )
      .select('id,origen_v4_id')
      .maybeSingle();
    if (error) {
      errores.push(`estructura ${e.origen_v4_id}: ${error.message}`);
      continue;
    }
    if (data?.id) {
      estructuraIdByV4.set(e.origen_v4_id, String(data.id));
      result.estructura += 1;
    }
    doneWork += 1;
    await report(`Estructura ${doneWork}/${totalWork}`);
  }

  const txs = payload.transacciones ?? [];
  const { kept: txsDedup, discarded: ingresosGemelosDescartados } = filtrarIngresosGemelosCsv(txs);
  result.ingresosGemelosOmitidos = ingresosGemelosDescartados.length;

  const contratosTx = txsDedup.filter((t) => String(t.clase).toUpperCase() === 'CONTRATO');
  const gastosTx = txsDedup.filter((t) => String(t.clase).toUpperCase() === 'GASTO');
  const ingresosTx = txsDedup.filter((t) => String(t.clase).toUpperCase() === 'INGRESO');
  const presupTx = txsDedup.filter((t) => String(t.clase).toUpperCase() === 'PRESUPUESTO');
  const auditTx = txsDedup.filter((t) => String(t.clase).toUpperCase() === 'AUDITORIA');

  const contratoUuidByV4 = new Map<number, string>();
  const contratoCandidatos: { id: string; proveedor: string; descripcion: string }[] = [];

  for (const t of contratosTx) {
    const base = num(t.monto_base_usd);
    const calc = aplicarHonorariosABase(base, num(t.porcentaje_admin) || null, pctGlobal);
    const { data, error } = await supabase
      .from('cco_contratos_obra')
      .upsert(
        {
          proyecto_id: proyectoId,
          proveedor: String(t.proveedor ?? 'Sin proveedor').trim() || 'Sin proveedor',
          descripcion: String(t.descripcion ?? 'Contrato').trim() || 'Contrato',
          fecha: fechaIso(t.fecha),
          moneda: String(t.moneda ?? 'USD').toUpperCase() || 'USD',
          monto_base_usd: base,
          admin_pct: calc.adminPct,
          honorarios_usd: t.honorarios != null ? num(t.honorarios) : calc.honorariosUsd,
          costo_total_usd: t.costo_total != null ? num(t.costo_total) : calc.costoTotalUsd,
          estado: String(t.estado ?? 'PENDIENTE'),
          tipo_gasto_cco: 'CONTRATO',
          origen_v4_id: t.origen_v4_id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'proyecto_id,origen_v4_id' },
      )
      .select('id,proveedor,descripcion,origen_v4_id')
      .maybeSingle();
    if (error) {
      errores.push(`contrato ${t.origen_v4_id}: ${error.message}`);
      continue;
    }
    if (data?.id) {
      contratoUuidByV4.set(t.origen_v4_id, String(data.id));
      contratoCandidatos.push({
        id: String(data.id),
        proveedor: String(data.proveedor),
        descripcion: String(data.descripcion),
      });
      result.contratos += 1;
    }
    doneWork += 1;
    await report(`Contratos ${result.contratos}/${contratosTx.length || 1}`);
  }

  for (const t of presupTx) {
    const { error } = await supabase.from('cco_presupuestos_capitulo').upsert(
      {
        proyecto_id: proyectoId,
        capitulo: String(t.capitulo ?? t.descripcion ?? 'SIN CAPÍTULO').trim() || 'SIN CAPÍTULO',
        subcapitulo: t.subcapitulo ? String(t.subcapitulo) : null,
        descripcion: t.descripcion ? String(t.descripcion) : null,
        estimado_usd: num(t.costo_total) || num(t.monto_base_usd),
        origen_v4_id: t.origen_v4_id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'proyecto_id,origen_v4_id' },
    );
    if (error) errores.push(`presupuesto ${t.origen_v4_id}: ${error.message}`);
    else result.presupuestos += 1;
    doneWork += 1;
    await report(`Presupuestos ${result.presupuestos}/${presupTx.length || 1}`);
  }

  for (const t of auditTx) {
    const { data: auditYa } = await supabase
      .from('cco_auditoria_eventos')
      .select('id')
      .eq('proyecto_id', proyectoId)
      .eq('origen_v4_id', t.origen_v4_id)
      .maybeSingle();
    if (auditYa?.id) {
      doneWork += 1;
      await report(`Auditoría ${result.auditoria}/${auditTx.length || 1}`);
      continue;
    }

    const { error } = await supabase.from('cco_auditoria_eventos').insert({
      proyecto_id: proyectoId,
      fecha: fechaIso(t.fecha),
      accion: String(t.tipo ?? t.descripcion ?? 'AUDITORIA').slice(0, 200),
      detalle: String(t.descripcion ?? ''),
      origen_v4_id: t.origen_v4_id,
      metadata: { proveedor: t.proveedor ?? null },
    });
    if (error) {
      if (!/duplicate|unique/i.test(error.message)) {
        errores.push(`auditoria ${t.origen_v4_id}: ${error.message}`);
      }
    } else result.auditoria += 1;
    doneWork += 1;
    await report(`Auditoría ${result.auditoria}/${auditTx.length || 1}`);
  }

  for (const t of ingresosTx) {
    const montoUsd = num(t.monto_base_usd);
    if (montoUsd <= 0) {
      doneWork += 1;
      await report(`Ingresos ${result.ingresos}/${ingresosTx.length || 1}`);
      continue;
    }
    const moneda = String(t.moneda ?? 'USD').toUpperCase() === 'VES' ? 'VES' : 'USD';
    const tasa = num(t.tasa) || (moneda === 'USD' ? 1 : 0);
    const tasaAplicada = tasa > 0 ? tasa : 1;
    const montoOrig = num(t.monto_orig) || montoUsd;
    const montoVes = moneda === 'VES' ? montoOrig : montoUsd * (tasaAplicada > 1 ? tasaAplicada : 0);
    const forma = String(t.forma_pago ?? '').toUpperCase();
    const metodoPago = /EFECTIVO/.test(forma) ? 'EFECTIVO' : 'TRANSFERENCIA';
    const fecha = fechaIso(t.fecha);
    const refV4 = `V4-${t.origen_v4_id}`;
    const prov = String(t.proveedor ?? '').trim() || 'CLIENTE';
    const desc = String(t.descripcion ?? 'Ingreso').trim() || 'Ingreso';
    // Formato parseOrigenIngreso: CCO-V4 #id · proveedor · descripción
    const origenFondo = `CCO-V4 #${t.origen_v4_id} · ${prov} · ${desc}`.slice(0, 200);
    const brecha =
      t.porcentaje_brecha_real != null && Number.isFinite(num(t.porcentaje_brecha_real))
        ? num(t.porcentaje_brecha_real)
        : null;
    const tasaBin =
      t.tasa_binance != null && Number.isFinite(num(t.tasa_binance)) ? num(t.tasa_binance) : null;

    const rowIngreso: Record<string, unknown> = {
      proyecto_id: proyectoId,
      origen_fondo: origenFondo,
      monto_recibido: montoOrig,
      moneda_recibida: moneda,
      monto_usd: montoUsd,
      monto_ves: montoVes,
      tasa_bcv: moneda === 'VES' ? tasaAplicada : null,
      tasa_aplicada: tasaAplicada,
      tipo_tasa: String(t.tasa_usada ?? '').toUpperCase() === 'BINANCE' ? 'PERSONALIZADA' : 'BCV',
      metodo_pago: metodoPago,
      banco_origen: metodoPago === 'TRANSFERENCIA' ? 'CCO-V4' : 'EFECTIVO',
      cuenta_bancaria_destino: metodoPago === 'TRANSFERENCIA' ? 'IMPORT-V4' : null,
      // Siempre V4-{id}: identidad estable para reimport (migración 276).
      referencia_bancaria: refV4,
      fecha_ingreso: fecha,
      creado_por: 'cco_v4_import',
    };
    if (brecha != null) rowIngreso.porcentaje_brecha_real = brecha;
    if (tasaBin != null && tasaBin > 0) rowIngreso.tasa_binance = tasaBin;

    // 1) Por referencia V4-{id} (estable aunque cambie la descripción)
    let existenteId: string | null = null;
    const { data: byRef } = await supabase
      .from('ci_inyecciones_capital')
      .select('id')
      .eq('proyecto_id', proyectoId)
      .eq('referencia_bancaria', refV4)
      .maybeSingle();
    if (byRef?.id) existenteId = String(byRef.id);

    // 2) Compat: imports viejos solo tenían origen_fondo / ref solo en TRANSFERENCIA
    if (!existenteId) {
      const { data: byFondo } = await supabase
        .from('ci_inyecciones_capital')
        .select('id')
        .eq('proyecto_id', proyectoId)
        .eq('origen_fondo', origenFondo)
        .maybeSingle();
      if (byFondo?.id) existenteId = String(byFondo.id);
    }
    if (!existenteId) {
      const { data: legacyRows } = await supabase
        .from('ci_inyecciones_capital')
        .select('id')
        .eq('proyecto_id', proyectoId)
        .like('origen_fondo', `CCO-V4 #${t.origen_v4_id} ·%`)
        .limit(1);
      if (legacyRows?.[0]?.id) existenteId = String(legacyRows[0].id);
    }

    const upsertIngreso = async (payload: Record<string, unknown>, idExistente: string | null) => {
      if (idExistente) {
        return supabase.from('ci_inyecciones_capital').update(payload).eq('id', idExistente);
      }
      return supabase.from('ci_inyecciones_capital').insert(payload);
    };

    let { error } = await upsertIngreso(rowIngreso, existenteId);
    if (
      error &&
      /porcentaje_brecha_real|tasa_binance|42703|PGRST204|schema cache/i.test(error.message ?? '')
    ) {
      const fallback = { ...rowIngreso };
      delete fallback.porcentaje_brecha_real;
      delete fallback.tasa_binance;
      ({ error } = await upsertIngreso(fallback, existenteId));
    }
    if (error) {
      if (/uq_ci_inyecciones_ref_v4|duplicate|unique/i.test(error.message)) {
        const { data: race } = await supabase
          .from('ci_inyecciones_capital')
          .select('id')
          .eq('proyecto_id', proyectoId)
          .eq('referencia_bancaria', refV4)
          .maybeSingle();
        if (race?.id) {
          let { error: upErr } = await upsertIngreso(rowIngreso, String(race.id));
          if (
            upErr &&
            /porcentaje_brecha_real|tasa_binance|42703|PGRST204|schema cache/i.test(
              upErr.message ?? '',
            )
          ) {
            const fallback = { ...rowIngreso };
            delete fallback.porcentaje_brecha_real;
            delete fallback.tasa_binance;
            ({ error: upErr } = await upsertIngreso(fallback, String(race.id)));
          }
          if (upErr) errores.push(`ingreso ${t.origen_v4_id}: ${upErr.message}`);
          else result.ingresos += 1;
        } else {
          errores.push(`ingreso ${t.origen_v4_id}: ${error.message}`);
        }
      } else {
        errores.push(`ingreso ${t.origen_v4_id}: ${error.message}`);
      }
    } else {
      result.ingresos += 1;
    }
    doneWork += 1;
    await report(`Ingresos ${result.ingresos}/${ingresosTx.length || 1}`);
  }

  // Higiene: quita gemelos operador (LUIS · …) que hayan quedado de imports previos.
  try {
    await report('Limpiando ingresos gemelos…', true);
    const pageSize = 1000;
    const inyecciones: Array<{
      id: string;
      fecha_ingreso?: string | null;
      monto_usd?: number | null;
      origen_fondo?: string | null;
      creado_al?: string | null;
    }> = [];
    let from = 0;
    for (let guard = 0; guard < 40; guard += 1) {
      const { data, error } = await supabase
        .from('ci_inyecciones_capital')
        .select('id,fecha_ingreso,monto_usd,origen_fondo,creado_al')
        .eq('proyecto_id', proyectoId)
        .eq('creado_por', 'cco_v4_import')
        .order('fecha_ingreso', { ascending: true })
        .range(from, from + pageSize - 1);
      if (error) throw error;
      const batch = data ?? [];
      inyecciones.push(...batch);
      if (batch.length < pageSize) break;
      from += pageSize;
    }
    const idsKill = idsIngresosGemelosAEliminar(inyecciones);
    for (const id of idsKill) {
      const { error } = await supabase.from('ci_inyecciones_capital').delete().eq('id', id);
      if (error) errores.push(`gemelo ingreso ${id.slice(0, 8)}: ${error.message}`);
      else result.ingresosGemelosEliminados += 1;
    }
  } catch (e) {
    errores.push(
      `higiene ingresos gemelos: ${e instanceof Error ? e.message : 'error'}`,
    );
  }

  let gastosDone = 0;
  for (const t of gastosTx) {
    const montoUsd = num(t.monto_base_usd);
    if (
      montoUsd <= 0 ||
      esDescripcionAuditoriaCco(t.descripcion) ||
      esDescripcionAuditoriaCco(t.tipo)
    ) {
      result.gastos.skipped += 1;
      doneWork += 1;
      gastosDone += 1;
      await report(`Gastos ${gastosDone}/${gastosTx.length || 1}`);
      continue;
    }
    const { supplier_name: proveedor, supplier_rif } = proveedorYRifParaCompraCco(t.proveedor);
    const tipo =
      normalizarTipoGastoCco(t.tipo) ?? clasificarTipoGasto(proveedor);
    const calc = aplicarHonorariosABase(montoUsd, num(t.porcentaje_admin) || null, pctGlobal);
    const moneda = String(t.moneda ?? 'USD').toUpperCase() || 'USD';
    const tasa = num(t.tasa) || 1;
    const montoOrig = num(t.monto_orig) || montoUsd;
    const montoVes = moneda === 'VES' ? montoOrig : montoUsd * (tasa > 1 ? tasa : 0);

    let contratoId: string | null = null;
    if (payload.auto_vincular !== false && (tipo === 'CONTRATISTA' || String(t.tipo).toUpperCase() === 'CONTRATO')) {
      const hit = resolverContratoVinculado({
        proveedor,
        descripcion: String(t.descripcion ?? ''),
        contratoVinculadoTexto: t.contrato_vinculado,
        contratos: contratoCandidatos,
        umbral: 60,
      });
      if (hit) {
        contratoId = hit.id;
        result.vinculados += 1;
      }
    } else if (t.contrato_vinculado) {
      const hit = resolverContratoVinculado({
        proveedor,
        descripcion: String(t.descripcion ?? ''),
        contratoVinculadoTexto: t.contrato_vinculado,
        contratos: contratoCandidatos,
        umbral: 40,
      });
      if (hit) {
        contratoId = hit.id;
        result.vinculados += 1;
      }
    }

    const invoice = `CCO-V4-${t.origen_v4_id}`;
    const up = await upsertCompraContableDedup(supabase, {
      proyecto_id: proyectoId,
      imputacion: IMPUTACION_OBRA,
      invoice_number: invoice,
      supplier_rif,
      supplier_name: proveedor,
      fecha: fechaIso(t.fecha),
      monto_ves: montoVes,
      monto_usd: montoUsd,
      tasa_bcv_ves_por_usd: moneda === 'VES' ? tasa : 0,
      moneda_original: moneda === 'VES' ? 'VES' : 'USD',
      origen: 'cco_v4_import',
      notas: String(t.descripcion ?? '').slice(0, 800) || null,
      upsert: true,
      lineas: [
        {
          descripcion: String(t.descripcion ?? 'Gasto').slice(0, 400),
          cantidad: 1,
          precio_unitario: montoUsd,
          subtotal: montoUsd,
          unidad: 'UND',
        },
      ],
      cco: {
        tipo_gasto_cco: tipo,
        contrato_obra_id: contratoId,
        admin_pct_override: num(t.porcentaje_admin) || null,
        honorarios_usd: t.honorarios != null ? num(t.honorarios) : calc.honorariosUsd,
        capitulo_cco: t.capitulo ? String(t.capitulo) : null,
        subcapitulo_cco: t.subcapitulo ? String(t.subcapitulo) : null,
        tasa_binance: t.tasa_binance != null ? num(t.tasa_binance) : null,
        tasa_usada: t.tasa_usada ? String(t.tasa_usada) : null,
        porcentaje_brecha_real:
          t.porcentaje_brecha_real != null ? num(t.porcentaje_brecha_real) : null,
        forma_pago_cco: t.forma_pago ? String(t.forma_pago) : null,
        origen_v4_id: t.origen_v4_id,
        cco_estado: t.estado ? String(t.estado) : 'PAGADO',
        monto_pagado_usd: t.monto_pagado != null ? num(t.monto_pagado) : null,
      },
    });

    if (!up.ok) {
      result.gastos.errors += 1;
      errores.push(`gasto ${t.origen_v4_id}: ${up.error}`);
    } else if (up.action === 'created') result.gastos.created += 1;
    else result.gastos.updated += 1;

    doneWork += 1;
    gastosDone += 1;
    // En lotes grandes, reportar cada fila pero el throttle interno evita spam de %.
    await report(`Gastos ${gastosDone}/${gastosTx.length || 1}`, gastosDone === gastosTx.length);
  }

  void contratoUuidByV4;
  await report('Finalizando…', true);
  return result;
}
