import type { SupabaseClient } from '@supabase/supabase-js';
import { completarTransferenciaInventario } from '@/lib/almacen/completarTransferenciaInventario';
import {
  crearTransferenciaInventario,
  type LineaTransferenciaDespachoInput,
} from '@/lib/almacen/crearTransferenciaInventario';
import { asegurarUbicacionObra } from '@/lib/almacen/ubicacionesInventario';

export type LineaEgresoCampoInput = {
  material_id: string;
  material_nombre?: string | null;
  cantidad: number;
  unidad?: string;
  ci_presupuesto_partida_id: string;
  partida_label?: string | null;
  cronograma_tarea_id?: string | null;
  tarea_label?: string | null;
};

export type RegistrarEgresoCampoInput = {
  proyectoId: string;
  nombreObra: string;
  origenUbicacionId: string;
  obreroEmpleadoId?: string | null;
  obreroNombre: string;
  obreroOficio?: string | null;
  observaciones?: string | null;
  fotoStoragePath?: string | null;
  fotoUrl?: string | null;
  chatId?: string | null;
  telegramUserId?: string | null;
  telegramUsername?: string | null;
  lineas: LineaEgresoCampoInput[];
};

export type ResultadoEgresoCampo =
  | {
      ok: true;
      egresoId: string;
      transferenciaId: string;
      codigoTransferencia: string;
      nLineas: number;
    }
  | { ok: false; error: string };

async function validarStockOrigen(
  supabase: SupabaseClient,
  origenUbicacionId: string,
  lineas: Array<{ material_id: string; cantidad: number; material_nombre?: string | null }>,
): Promise<{ ok: true } | { ok: false; mensaje: string }> {
  const agregado = new Map<string, { cantidad: number; nombre: string }>();
  for (const ln of lineas) {
    const prev = agregado.get(ln.material_id);
    agregado.set(ln.material_id, {
      cantidad: (prev?.cantidad ?? 0) + ln.cantidad,
      nombre: ln.material_nombre?.trim() || prev?.nombre || 'Material',
    });
  }

  for (const [materialId, { cantidad, nombre }] of Array.from(agregado.entries())) {
    const { data } = await supabase
      .from('inventario_stock')
      .select('cantidad_disponible')
      .eq('ubicacion_id', origenUbicacionId)
      .eq('material_id', materialId)
      .maybeSingle();

    const disp = Number(data?.cantidad_disponible ?? 0);
    if (disp + 0.0001 < cantidad) {
      return {
        ok: false,
        mensaje: `Stock insuficiente de «${nombre}»: hay ${disp}, se requieren ${cantidad}.`,
      };
    }
  }
  return { ok: true };
}

/** Registra egreso con trazabilidad, transferencia salida_obra e imputación por partida. */
export async function registrarEgresoCampo(
  supabase: SupabaseClient,
  input: RegistrarEgresoCampoInput,
): Promise<ResultadoEgresoCampo> {
  const lineasValidas = input.lineas.filter(
    (l) => l.material_id?.trim() && l.ci_presupuesto_partida_id?.trim() && Number(l.cantidad) > 0,
  );
  if (!lineasValidas.length) {
    return { ok: false, error: 'Agregue al menos una línea con material, cantidad y partida.' };
  }

  const obreroNombre = input.obreroNombre.trim();
  if (!obreroNombre) {
    return { ok: false, error: 'Indique el nombre del obrero.' };
  }

  const destinoUbicacionId = await asegurarUbicacionObra(
    supabase,
    input.proyectoId,
    input.nombreObra,
  );

  if (input.origenUbicacionId === destinoUbicacionId) {
    return { ok: false, error: 'El almacén origen no puede ser la misma ubicación de la obra.' };
  }

  const stockVal = await validarStockOrigen(
    supabase,
    input.origenUbicacionId,
    lineasValidas.map((l) => ({
      material_id: l.material_id,
      cantidad: l.cantidad,
      material_nombre: l.material_nombre,
    })),
  );
  if (!stockVal.ok) {
    return { ok: false, error: stockVal.mensaje };
  }

  const obsBase = input.observaciones?.trim() || '';
  const obsTransferencia =
    `[Egreso campo] Obrero: ${obreroNombre}` +
    (input.obreroOficio?.trim() ? ` (${input.obreroOficio.trim()})` : '') +
    (obsBase ? ` · ${obsBase}` : '');

  const lineasTransferencia: LineaTransferenciaDespachoInput[] = lineasValidas.map((l) => ({
    material_id: l.material_id,
    cantidad: l.cantidad,
    imputaciones: [
      {
        ci_presupuesto_partida_id: l.ci_presupuesto_partida_id,
        cantidad_imputada: l.cantidad,
        justificacion_exceso: 'Egreso depositario vía Telegram (/salida)',
      },
    ],
  }));

  let transferenciaId: string;
  let codigo: string;

  try {
    const trf = await crearTransferenciaInventario(supabase, {
      origen_ubicacion_id: input.origenUbicacionId,
      destino_ubicacion_id: destinoUbicacionId,
      ci_proyecto_id: input.proyectoId,
      tipo_movimiento: 'salida_obra',
      observaciones: obsTransferencia.slice(0, 500),
      lineas: lineasTransferencia,
    });
    transferenciaId = trf.transferenciaId;
    codigo = trf.codigo;
    await completarTransferenciaInventario(supabase, transferenciaId);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error al crear transferencia' };
  }

  const { data: trfLineas } = await supabase
    .from('transferencias_inventario_lineas')
    .select('id, material_id')
    .eq('transferencia_id', transferenciaId);

  const lineaIdPorMaterial = new Map<string, string>();
  for (const tl of trfLineas ?? []) {
    lineaIdPorMaterial.set(String(tl.material_id), String(tl.id));
  }

  const now = new Date();
  const caracasOffset = -4 * 60;
  const caracas = new Date(now.getTime() + (caracasOffset - now.getTimezoneOffset()) * 60000);
  const fechaEgreso = caracas.toISOString().slice(0, 10);
  const horaEgreso = caracas.toISOString().slice(11, 19);

  let ciObraMovimientoId: string | null = null;
  if (input.fotoStoragePath?.trim()) {
    const movRow: Record<string, unknown> = {
      proyecto_id: input.proyectoId,
      tipo: 'salida',
      foto_storage_path: input.fotoStoragePath.trim(),
      foto_url: input.fotoUrl ?? null,
      observacion: obsBase || obsTransferencia,
      chat_id: input.chatId ?? null,
      telegram_user_id: input.telegramUserId ?? null,
      telegram_username: input.telegramUsername ?? null,
      transferencia_id: transferenciaId,
      stock_aplicado: true,
      lineas_extraidas: lineasValidas.map((l) => ({
        material_id: l.material_id,
        material_nombre: l.material_nombre,
        quantity: l.cantidad,
        description: l.material_nombre ?? '',
        match_ok: true,
      })),
    };
    const { data: mov, error: movErr } = await supabase
      .from('ci_obra_movimientos_material')
      .insert(movRow)
      .select('id')
      .single();
    if (!movErr && mov?.id) {
      ciObraMovimientoId = String(mov.id);
    }
  }

  const { data: egreso, error: egErr } = await supabase
    .from('inv_egresos_campo')
    .insert({
      proyecto_id: input.proyectoId,
      origen_ubicacion_id: input.origenUbicacionId,
      destino_ubicacion_id: destinoUbicacionId,
      transferencia_id: transferenciaId,
      obrero_empleado_id: input.obreroEmpleadoId?.trim() || null,
      obrero_nombre: obreroNombre,
      obrero_oficio: input.obreroOficio?.trim() || null,
      observaciones: obsBase,
      foto_storage_path: input.fotoStoragePath?.trim() || null,
      foto_url: input.fotoUrl ?? null,
      fecha_egreso: fechaEgreso,
      hora_egreso: horaEgreso,
      chat_id: input.chatId ?? null,
      telegram_user_id: input.telegramUserId ?? null,
      telegram_username: input.telegramUsername ?? null,
      ci_obra_movimiento_id: ciObraMovimientoId,
      stock_aplicado: true,
    })
    .select('id')
    .single();

  if (egErr) {
    if (egErr.code === '42P01') {
      return {
        ok: false,
        error: 'Tabla inv_egresos_campo no instalada. Aplique migración 206 en Supabase.',
      };
    }
    return { ok: false, error: egErr.message };
  }

  const egresoId = String((egreso as { id: string }).id);

  const lineasPayload = lineasValidas.map((l) => ({
    egreso_id: egresoId,
    material_id: l.material_id,
    cantidad: l.cantidad,
    unidad: (l.unidad ?? 'UND').trim() || 'UND',
    ci_presupuesto_partida_id: l.ci_presupuesto_partida_id,
    cronograma_tarea_id: l.cronograma_tarea_id?.trim() || null,
    partida_label: l.partida_label?.trim() || null,
    tarea_label: l.tarea_label?.trim() || null,
    material_nombre: l.material_nombre?.trim() || null,
    transferencia_linea_id: lineaIdPorMaterial.get(l.material_id) ?? null,
  }));

  const { error: lnErr } = await supabase.from('inv_egresos_campo_lineas').insert(lineasPayload);
  if (lnErr) {
    return { ok: false, error: `Egreso creado pero falló el detalle: ${lnErr.message}` };
  }

  return {
    ok: true,
    egresoId,
    transferenciaId,
    codigoTransferencia: codigo,
    nLineas: lineasValidas.length,
  };
}

/** Stock disponible en una ubicación para picker Telegram. */
export async function listarStockUbicacionEgreso(
  supabase: SupabaseClient,
  ubicacionId: string,
): Promise<
  Array<{ material_id: string; nombre: string; unidad: string; cantidad_disponible: number }>
> {
  const { data: rows, error } = await supabase
    .from('inventario_stock')
    .select('material_id, cantidad_disponible')
    .eq('ubicacion_id', ubicacionId)
    .gt('cantidad_disponible', 0)
    .order('cantidad_disponible', { ascending: false })
    .limit(200);

  if (error?.code === '42P01') return [];
  if (error) throw new Error(error.message);
  if (!rows?.length) return [];

  const materialIds = Array.from(new Set(rows.map((r) => String(r.material_id))));
  const { data: materiales } = await supabase
    .from('global_inventory')
    .select('id, name, unit')
    .in('id', materialIds.slice(0, 200));

  const porId = new Map(
    (materiales ?? []).map((m) => [
      String(m.id),
      { name: String(m.name ?? 'Material'), unit: String(m.unit ?? 'UND') },
    ]),
  );

  return rows.map((row) => {
    const gi = porId.get(String(row.material_id));
    return {
      material_id: String(row.material_id),
      nombre: gi?.name.trim() || 'Material',
      unidad: gi?.unit.trim() || 'UND',
      cantidad_disponible: Number(row.cantidad_disponible) || 0,
    };
  });
}
