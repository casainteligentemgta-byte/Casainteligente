import type { SupabaseClient } from '@supabase/supabase-js';
import { IMPUTACION_OBRA } from '@/lib/contabilidad/imputacionCompra';
import { upsertCompraContableDedup } from '@/lib/contabilidad/upsertCompraContableDedup';
import { clasificarTipoGasto } from '@/lib/contabilidad/ccoClasificarGasto';
import { aplicarHonorariosABase } from '@/lib/contabilidad/cco/honorarios';
import { normalizarTipoGastoCco } from '@/lib/contabilidad/cco/normalizarTipoGasto';
import { resolverContratoVinculado } from '@/lib/contabilidad/cco/vincularContrato';
import { devaluacionPctDesdeOficialYReal } from '@/lib/contabilidad/cco/tasas';

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
  auditoria: number;
  estructura: number;
  vinculados: number;
  errores: string[];
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
    auditoria: 0,
    estructura: 0,
    vinculados: 0,
    errores,
  };

  const txs = payload.transacciones ?? [];
  const contratosTx = txs.filter((t) => String(t.clase).toUpperCase() === 'CONTRATO');
  const gastosTx = txs.filter((t) => String(t.clase).toUpperCase() === 'GASTO');
  const ingresosTx = txs.filter((t) => String(t.clase).toUpperCase() === 'INGRESO');
  const presupTx = txs.filter((t) => String(t.clase).toUpperCase() === 'PRESUPUESTO');
  const auditTx = txs.filter((t) => String(t.clase).toUpperCase() === 'AUDITORIA');

  // Contabilidad Real V4: devaluación = oficial_BCV / real_Binance − 1
  let devaluacionPct = num(payload.devaluacion_pct);
  if (!(devaluacionPct > 0)) {
    let oficialIng = 0;
    let realIng = 0;
    for (const t of ingresosTx) {
      const base = num(t.monto_base_usd);
      if (base <= 0) continue;
      oficialIng += base;
      const moneda = String(t.moneda ?? 'USD').toUpperCase();
      const ves = num(t.monto_orig);
      const bin = num(t.tasa_binance);
      if (moneda === 'VES' && ves > 0 && bin > 0) realIng += ves / bin;
      else realIng += base;
    }
    devaluacionPct = devaluacionPctDesdeOficialYReal(oficialIng, realIng);
  }

  await supabase.from('cco_proyecto_config').upsert(
    {
      proyecto_id: proyectoId,
      honorarios_admin_pct: pctGlobal,
      devaluacion_pct: devaluacionPct,
      obra_alias: payload.obra_alias ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'proyecto_id' },
  );

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
  }

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
          honorarios_usd: num(t.honorarios) || calc.honorariosUsd,
          costo_total_usd: num(t.costo_total) || calc.costoTotalUsd,
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
  }

  for (const t of auditTx) {
    const { data: auditYa } = await supabase
      .from('cco_auditoria_eventos')
      .select('id')
      .eq('proyecto_id', proyectoId)
      .eq('origen_v4_id', t.origen_v4_id)
      .maybeSingle();
    if (auditYa?.id) continue;

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
  }

  for (const t of ingresosTx) {
    const montoUsd = num(t.monto_base_usd);
    if (montoUsd <= 0) continue;
    const moneda = String(t.moneda ?? 'USD').toUpperCase() === 'VES' ? 'VES' : 'USD';
    const tasa = num(t.tasa) || (moneda === 'USD' ? 1 : 0);
    const tasaAplicada = tasa > 0 ? tasa : 1;
    const montoOrig = num(t.monto_orig) || montoUsd;
    const montoVes = moneda === 'VES' ? montoOrig : montoUsd * (tasaAplicada > 1 ? tasaAplicada : 0);
    const forma = String(t.forma_pago ?? '').toUpperCase();
    const metodoPago = /EFECTIVO/.test(forma) ? 'EFECTIVO' : 'TRANSFERENCIA';
    const fecha = fechaIso(t.fecha);
    const origenFondo = `CCO-V4 #${t.origen_v4_id} · ${String(t.descripcion ?? t.proveedor ?? 'Ingreso').slice(0, 180)}`;

    // Evitar reimport duplicado por origen_fondo
    const { data: ya } = await supabase
      .from('ci_inyecciones_capital')
      .select('id')
      .eq('proyecto_id', proyectoId)
      .eq('origen_fondo', origenFondo)
      .maybeSingle();
    if (ya?.id) continue;

    const { error } = await supabase.from('ci_inyecciones_capital').insert({
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
      referencia_bancaria: metodoPago === 'TRANSFERENCIA' ? `V4-${t.origen_v4_id}` : null,
      fecha_ingreso: fecha,
      creado_por: 'cco_v4_import',
    });
    if (error) errores.push(`ingreso ${t.origen_v4_id}: ${error.message}`);
    else result.ingresos += 1;
  }

  for (const t of gastosTx) {
    const montoUsd = num(t.monto_base_usd);
    if (montoUsd <= 0) {
      result.gastos.skipped += 1;
      continue;
    }
    const proveedor = String(t.proveedor ?? 'Sin proveedor').trim() || 'Sin proveedor';
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
      supplier_rif: 'J-CCO-V4',
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
        honorarios_usd: num(t.honorarios) || calc.honorariosUsd,
        capitulo_cco: t.capitulo ? String(t.capitulo) : null,
        subcapitulo_cco: t.subcapitulo ? String(t.subcapitulo) : null,
        tasa_binance: t.tasa_binance != null ? num(t.tasa_binance) : null,
        tasa_usada: t.tasa_usada ? String(t.tasa_usada) : null,
        porcentaje_brecha_real:
          t.porcentaje_brecha_real != null ? num(t.porcentaje_brecha_real) : null,
        forma_pago_cco: t.forma_pago ? String(t.forma_pago) : null,
        origen_v4_id: t.origen_v4_id,
        cco_estado: t.estado ? String(t.estado) : 'PAGADO',
      },
    });

    if (!up.ok) {
      result.gastos.errors += 1;
      errores.push(`gasto ${t.origen_v4_id}: ${up.error}`);
    } else if (up.action === 'created') result.gastos.created += 1;
    else result.gastos.updated += 1;
  }

  void contratoUuidByV4;
  return result;
}
