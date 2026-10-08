import type { SupabaseClient } from '@supabase/supabase-js';
import { calcularSemanaObra, type ResultadoSemanaObra } from '@/lib/nomina/calcularSemanaObra';
import {
  type ClasePagoObra,
  esClasePagoObra,
  SOLICITUD_ANTICIPO_SEPTIMA_TEXTO,
  semanaCuentaComoTrabajada,
  tocaAdelantoTrasSemana,
} from '@/lib/nomina/reglasPagoObra';
import { domingoDeSemanaIso, esMigracionNomina333Pendiente, lunesDeSemanaIso } from '@/lib/nomina/semanaIsoNomina';

export type ItemEntradaNomina = {
  empleado_id: string;
  clase: ClasePagoObra;
  dias_laborados: number;
  cargo_codigo?: string | null;
  cargo_nombre?: string | null;
  incluir_adelanto?: boolean;
  /** Cl. SEXTA c): el complemento de alimentación es potestativo; `false` = no se otorga esta semana. */
  otorgar_bono?: boolean;
  /** Arreglo semanal histórico; la Cl. SEXTA ya no usa un sobre semanal. */
  sobre_usd?: number | null;
  /** Reservado. La Cl. SÉPTIMA es monto fijo y se paga al finiquito, no en la semana. */
  mensual_usd?: number | null;
};

export const SEMANA_PAGADA_MSG =
  'Esta semana ya está marcada como pagada. Para corregirla, confirme que desea volver a guardarla.';

export type PreviewItemNomina = {
  empleado_id: string;
  semanas_trabajadas_previas: number;
  toca_adelanto: boolean;
  semanal: ResultadoSemanaObra;
  adelanto: ResultadoSemanaObra | null;
};

function errMigracion(e: { message?: string } | null): Error | null {
  if (!e?.message) return null;
  if (esMigracionNomina333Pendiente(e.message)) {
    return new Error('Migración 333 pendiente en Supabase (nómina semanal de obra).');
  }
  return new Error(e.message);
}

export async function contarSemanasTrabajadasPrevias(
  db: SupabaseClient,
  proyectoId: string,
  empleadoId: string,
  semanaInicio: string,
): Promise<number> {
  const { data, error } = await db
    .from('ci_nomina_obra_items')
    .select('id, dias_laborados, tipo, periodo:ci_nomina_obra_periodos!inner(proyecto_id, semana_inicio)')
    .eq('empleado_id', empleadoId)
    .eq('tipo', 'semanal');
  const mig = errMigracion(error);
  if (mig) throw mig;
  if (error) throw new Error(error.message);
  let n = 0;
  for (const row of data ?? []) {
    const p = (row as { periodo?: { proyecto_id?: string; semana_inicio?: string } }).periodo;
    if (p?.proyecto_id !== proyectoId) continue;
    if ((p.semana_inicio ?? '') >= semanaInicio) continue;
    const dias = Number((row as { dias_laborados?: number }).dias_laborados);
    if (semanaCuentaComoTrabajada(dias)) n += 1;
  }
  return n;
}

export function previewItemsNomina(args: {
  items: ItemEntradaNomina[];
  previasPorEmpleado: Record<string, number>;
  tasaBcvPago: number;
  tasaAnclaCestaBcv: number;
}): PreviewItemNomina[] {
  return args.items.map((it) => {
    if (!esClasePagoObra(it.clase)) {
      throw new Error('Clase de pago inválida (ayudante o clasificado).');
    }
    const prev = args.previasPorEmpleado[it.empleado_id] ?? 0;
    const cuenta = semanaCuentaComoTrabajada(it.dias_laborados);
    const toca = tocaAdelantoTrasSemana(prev, cuenta);
    const semanal = calcularSemanaObra({
      clase: it.clase,
      tipo: 'semanal',
      diasLaborados: it.dias_laborados,
      tasaBcvPago: args.tasaBcvPago,
      tasaAnclaCestaBcv: args.tasaAnclaCestaBcv,
      cargoCodigo: it.cargo_codigo,
      cargoNombre: it.cargo_nombre,
      sobreUsd: it.sobre_usd,
      otorgarBono: it.otorgar_bono,
    });
    /** Cl. SÉPTIMA: el derecho nace cada 4 semanas, pero el pago es al finiquito. */
    const adelanto = null;
    return {
      empleado_id: it.empleado_id,
      semanas_trabajadas_previas: prev,
      toca_adelanto: toca,
      semanal,
      adelanto,
    };
  });
}

function filaItem(
  periodoId: string,
  empleadoId: string,
  calc: ResultadoSemanaObra,
): Record<string, unknown> {
  return {
    periodo_id: periodoId,
    empleado_id: empleadoId,
    tipo: calc.tipo,
    clase: calc.clase,
    oficio_codigo: calc.oficio.codigo,
    oficio_denominacion: calc.oficio.denominacion,
    oficio_nivel: calc.oficio.nivel,
    diario_ves: calc.oficio.diarioVes,
    dias_laborados: calc.diasLaborados,
    dias_pagados: calc.diasPagados,
    sobre_usd: calc.sobreUsdPactado,
    salario_basico_ves: calc.salarioBasicoVes,
    cesta_usd: calc.cestaUsdAnclada,
    cesta_ves: calc.cestaVesDelDia,
    complemento_usd: calc.complementoUsd,
    total_usd: calc.totalUsd,
    total_ves: calc.totalVes,
    snapshot: calc,
  };
}

export async function guardarPeriodoNomina(
  db: SupabaseClient,
  args: {
    proyectoId: string;
    semanaInicio: string;
    tasaBcvPago: number;
    tasaAnclaCestaBcv: number;
    items: ItemEntradaNomina[];
    marcarPagado?: boolean;
    /** Volver a guardar una semana ya marcada como pagada (lo confirma quien la edita). */
    reabrir?: boolean;
  },
): Promise<{ periodo_id: string; previews: PreviewItemNomina[]; item_ids: Record<string, string> }> {
  const lunes = lunesDeSemanaIso(args.semanaInicio);
  const domingo = domingoDeSemanaIso(lunes);

  const previasPorEmpleado: Record<string, number> = {};
  for (const it of args.items) {
    previasPorEmpleado[it.empleado_id] = await contarSemanasTrabajadasPrevias(
      db,
      args.proyectoId,
      it.empleado_id,
      lunes,
    );
  }
  const previews = previewItemsNomina({
    items: args.items,
    previasPorEmpleado,
    tasaBcvPago: args.tasaBcvPago,
    tasaAnclaCestaBcv: args.tasaAnclaCestaBcv,
  });

  const { data: existente, error: eExist } = await db
    .from('ci_nomina_obra_periodos')
    .select('id, estado')
    .eq('proyecto_id', args.proyectoId)
    .eq('semana_inicio', lunes)
    .maybeSingle();
  const migExist = errMigracion(eExist);
  if (migExist) throw migExist;
  if ((existente as { estado?: string } | null)?.estado === 'pagado' && !args.reabrir && !args.marcarPagado) {
    throw new Error(SEMANA_PAGADA_MSG);
  }

  const { data: periodo, error: ePer } = await db
    .from('ci_nomina_obra_periodos')
    .upsert(
      {
        proyecto_id: args.proyectoId,
        semana_inicio: lunes,
        semana_fin: domingo,
        tasa_bcv_pago: args.tasaBcvPago,
        tasa_ancla_cesta_bcv: args.tasaAnclaCestaBcv,
        // Corregir una semana pagada no la reabre: sigue pagada.
        estado: args.marcarPagado || (existente as { estado?: string } | null)?.estado === 'pagado' ? 'pagado' : 'abierto',
      },
      { onConflict: 'proyecto_id,semana_inicio' },
    )
    .select('id')
    .single();
  const mig = errMigracion(ePer);
  if (mig) throw mig;
  if (ePer || !periodo) throw new Error(ePer?.message ?? 'No se pudo guardar el periodo.');
  const periodoId = String((periodo as { id: string }).id);

  // Volver a guardar una semana no debe borrar lo ya firmado: los ítems se
  // actualizan en su sitio (conservan su id y, con él, el adelanto registrado).
  const { data: previos, error: ePrev } = await db
    .from('ci_nomina_obra_items')
    .select('id, tipo')
    .eq('periodo_id', periodoId);
  if (ePrev) throw errMigracion(ePrev) ?? new Error(ePrev.message);

  const filas: Record<string, unknown>[] = [];
  for (const p of previews) {
    filas.push(filaItem(periodoId, p.empleado_id, p.semanal));
    if (p.adelanto) filas.push(filaItem(periodoId, p.empleado_id, p.adelanto));
  }
  const { data: saved, error: eIt } = await db
    .from('ci_nomina_obra_items')
    .upsert(filas, { onConflict: 'periodo_id,empleado_id,tipo' })
    .select('id, empleado_id, tipo');
  if (eIt) throw errMigracion(eIt) ?? new Error(eIt.message);

  // Lo que ya no está en la semana se quita. La semana adicional (Cl. SÉPTIMA) no se paga
  // en la nómina semanal; si quedó un ítem histórico, no se borra.
  const vigentes: Record<string, true> = {};
  for (const row of saved ?? []) vigentes[String((row as { id: string }).id)] = true;
  const tipoPorId: Record<string, string> = {};
  for (const row of previos ?? []) {
    tipoPorId[String((row as { id: string }).id)] = String((row as { tipo?: string }).tipo ?? '');
  }
  const sobrantes = (previos ?? []).map((r) => String((r as { id: string }).id)).filter((id) => !vigentes[id]);
  if (sobrantes.length > 0) {
    const { data: conAdelanto, error: eAdel } = await db
      .from('ci_nomina_obra_adelantos')
      .select('item_id')
      .in('item_id', sobrantes);
    if (eAdel) throw errMigracion(eAdel) ?? new Error(eAdel.message);
    const protegidos: Record<string, true> = {};
    for (const row of conAdelanto ?? []) protegidos[String((row as { item_id: string }).item_id)] = true;
    const borrar = sobrantes.filter(
      (id) => !protegidos[id] && tipoPorId[id] !== 'adelanto_prestaciones',
    );
    if (borrar.length > 0) {
      const { error: eDel } = await db.from('ci_nomina_obra_items').delete().in('id', borrar);
      if (eDel) throw new Error(eDel.message);
    }
  }

  const itemIds: Record<string, string> = {};
  for (const row of saved ?? []) {
    const eid = String((row as { empleado_id: string }).empleado_id);
    const tipo = String((row as { tipo: string }).tipo);
    itemIds[`${eid}:${tipo}`] = String((row as { id: string }).id);
  }

  return { periodo_id: periodoId, previews, item_ids: itemIds };
}

export async function registrarAdelantoPrestaciones(
  db: SupabaseClient,
  args: {
    itemId: string;
    solicitudTexto: string;
    firmanteNombre?: string | null;
    firmar: boolean;
  },
): Promise<{ adelanto_id: string }> {
  const { data: item, error: eItem } = await db
    .from('ci_nomina_obra_items')
    .select('id, empleado_id, tipo, total_usd, total_ves, snapshot, periodo_id')
    .eq('id', args.itemId)
    .maybeSingle();
  const mig = errMigracion(eItem);
  if (mig) throw mig;
  if (eItem || !item) throw new Error(eItem?.message ?? 'Ítem de adelanto no encontrado.');
  if (String((item as { tipo: string }).tipo) !== 'adelanto_prestaciones') {
    throw new Error('Este ítem no es un adelanto de prestaciones.');
  }

  const { data: per, error: ePer } = await db
    .from('ci_nomina_obra_periodos')
    .select('proyecto_id')
    .eq('id', (item as { periodo_id: string }).periodo_id)
    .maybeSingle();
  if (ePer || !per) throw new Error(ePer?.message ?? 'Periodo no encontrado.');

  const snap = (item as { snapshot?: { montoGarantiaPrestacionesVes?: number; anticipoPrestacionesVes?: number } })
    .snapshot;
  const garantia = Number(snap?.montoGarantiaPrestacionesVes ?? 0);
  /** Lo que se anticipa (máx. 75%); recibos viejos sin el dato: la garantía completa. */
  const anticipo = Number(snap?.anticipoPrestacionesVes ?? garantia);
  const empleadoId = String((item as { empleado_id: string }).empleado_id);
  const proyectoId = String((per as { proyecto_id: string }).proyecto_id);

  const { data: previo } = await db
    .from('ci_nomina_obra_adelantos')
    .select('id')
    .eq('item_id', args.itemId)
    .maybeSingle();
  const yaRegistrado = Boolean(previo);

  const { data: adelanto, error: eAd } = await db
    .from('ci_nomina_obra_adelantos')
    .upsert(
      {
        item_id: args.itemId,
        empleado_id: empleadoId,
        proyecto_id: proyectoId,
        solicitud_texto: args.solicitudTexto.trim() || SOLICITUD_ANTICIPO_SEPTIMA_TEXTO,
        firmante_nombre: args.firmanteNombre?.trim() || null,
        firmado_at: args.firmar ? new Date().toISOString() : null,
        monto_usd: (item as { total_usd: number }).total_usd,
        monto_ves: (item as { total_ves: number }).total_ves,
        garantia_ves: garantia,
      },
      { onConflict: 'item_id' },
    )
    .select('id')
    .single();
  if (eAd || !adelanto) throw errMigracion(eAd) ?? new Error(eAd?.message ?? 'No se pudo registrar el adelanto.');

  if (!yaRegistrado) {
    const { data: saldo } = await db
      .from('ci_prestaciones_saldo')
      .select('acumulado_ves, adelantado_ves')
      .eq('empleado_id', empleadoId)
      .eq('proyecto_id', proyectoId)
      .maybeSingle();
    const acum = Number((saldo as { acumulado_ves?: number } | null)?.acumulado_ves ?? 0) + garantia;
    const adel = Number((saldo as { adelantado_ves?: number } | null)?.adelantado_ves ?? 0) + anticipo;
    await db.from('ci_prestaciones_saldo').upsert(
      {
        empleado_id: empleadoId,
        proyecto_id: proyectoId,
        acumulado_ves: acum,
        adelantado_ves: adel,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'empleado_id,proyecto_id' },
    );
  }

  return { adelanto_id: String((adelanto as { id: string }).id) };
}
