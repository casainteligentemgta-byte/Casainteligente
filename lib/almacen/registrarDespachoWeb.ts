import type { SupabaseClient } from '@supabase/supabase-js';
import { completarTransferenciaInventario } from '@/lib/almacen/completarTransferenciaInventario';
import {
  crearTransferenciaInventario,
  type LineaTransferenciaDespachoInput,
} from '@/lib/almacen/crearTransferenciaInventario';
import type { DespachoFotoRef } from '@/lib/almacen/uploadDespachoFoto';
import type { ImputacionPartidaInput } from '@/types/inventario-obra';

export type LineaDespachoWebInput = {
  material_id: string;
  material_nombre: string;
  unidad: string;
  cantidad: number;
  origen_ubicacion_id: string;
  destino_ubicacion_id: string;
  destino_fisico: 'obra_actual' | 'otro_almacen' | 'otra_obra';
  imputacion_tipo: 'partida_lulo' | 'actividad';
  imputaciones: ImputacionPartidaInput[];
  ci_presupuesto_partida_id?: string | null;
  partida_id?: string | null;
  partida_label?: string | null;
  cronograma_tarea_id?: string | null;
  tarea_label?: string | null;
};

export type RegistrarDespachoWebInput = {
  proyectoId: string;
  observaciones?: string | null;
  obreroEmpleadoId?: string | null;
  obreroNombre: string;
  obreroOficio?: string | null;
  fotos?: DespachoFotoRef[];
  lineas: LineaDespachoWebInput[];
};

export type ResultadoDespachoWeb =
  | {
      ok: true;
      egresoId: string | null;
      transferenciaIds: string[];
      codigos: string[];
    }
  | { ok: false; error: string };

function esSalidaObra(linea: LineaDespachoWebInput): boolean {
  return linea.destino_fisico === 'obra_actual';
}

export async function registrarDespachoWeb(
  supabase: SupabaseClient,
  input: RegistrarDespachoWebInput,
): Promise<ResultadoDespachoWeb> {
  const obreroNombre = input.obreroNombre.trim();
  if (!obreroNombre) {
    return { ok: false, error: 'Indique el obrero que recibe el material.' };
  }

  if (!input.lineas.length) {
    return { ok: false, error: 'Agregue al menos un material.' };
  }

  for (const l of input.lineas) {
    if (l.origen_ubicacion_id === l.destino_ubicacion_id) {
      return { ok: false, error: 'Origen y destino no pueden ser el mismo almacén.' };
    }
    if (l.destino_fisico !== 'otro_almacen' && !l.imputaciones.length) {
      return { ok: false, error: `Falta imputación presupuestaria para ${l.material_nombre}.` };
    }
  }

  const obsBase = input.observaciones?.trim() || '';
  const obsObrero =
    `Recibe: ${obreroNombre}` + (input.obreroOficio?.trim() ? ` (${input.obreroOficio.trim()})` : '');
  const observaciones = [obsObrero, obsBase].filter(Boolean).join(' · ').slice(0, 500);

  const porRuta = new Map<string, LineaDespachoWebInput[]>();
  for (const l of input.lineas) {
    const key = `${l.origen_ubicacion_id}:${l.destino_ubicacion_id}:${l.destino_fisico}`;
    const g = porRuta.get(key) ?? [];
    g.push(l);
    porRuta.set(key, g);
  }

  const transferenciaIds: string[] = [];
  const codigos: string[] = [];
  const lineaIdPorMaterialTrf = new Map<string, string>();

  try {
    for (const [, grupo] of Array.from(porRuta.entries())) {
      const origen = grupo[0]!.origen_ubicacion_id;
      const destino = grupo[0]!.destino_ubicacion_id;
      const salidaObra = grupo.every(esSalidaObra);

      const lineasTrf: LineaTransferenciaDespachoInput[] = grupo.map((l) => ({
        material_id: l.material_id,
        cantidad: l.cantidad,
        imputaciones: l.imputaciones,
      }));

      const trf = await crearTransferenciaInventario(supabase, {
        origen_ubicacion_id: origen,
        destino_ubicacion_id: destino,
        ci_proyecto_id: input.proyectoId,
        tipo_movimiento: salidaObra ? 'salida_obra' : 'transferencia',
        observaciones,
        lineas: lineasTrf,
      });

      await completarTransferenciaInventario(supabase, trf.transferenciaId);
      transferenciaIds.push(trf.transferenciaId);
      codigos.push(trf.codigo);

      const { data: trfLineas } = await supabase
        .from('transferencias_inventario_lineas')
        .select('id, material_id')
        .eq('transferencia_id', trf.transferenciaId);

      for (const tl of trfLineas ?? []) {
        lineaIdPorMaterialTrf.set(`${trf.transferenciaId}:${tl.material_id}`, String(tl.id));
      }
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error al registrar transferencias' };
  }

  const fotos = input.fotos ?? [];
  const primeraFoto = fotos[0];

  const now = new Date();
  const caracasOffset = -4 * 60;
  const caracas = new Date(now.getTime() + (caracasOffset - now.getTimezoneOffset()) * 60000);
  const fechaEgreso = caracas.toISOString().slice(0, 10);
  const horaEgreso = caracas.toISOString().slice(11, 19);

  const primeraLinea = input.lineas[0]!;
  const egresoPayload: Record<string, unknown> = {
    proyecto_id: input.proyectoId,
    origen_ubicacion_id: primeraLinea.origen_ubicacion_id,
    destino_ubicacion_id: primeraLinea.destino_ubicacion_id,
    transferencia_id: transferenciaIds[0] ?? null,
    obrero_empleado_id: input.obreroEmpleadoId?.trim() || null,
    obrero_nombre: obreroNombre,
    obrero_oficio: input.obreroOficio?.trim() || null,
    observaciones: obsBase,
    foto_storage_path: primeraFoto?.storage_path ?? null,
    foto_url: primeraFoto?.url ?? null,
    fotos,
    fecha_egreso: fechaEgreso,
    hora_egreso: horaEgreso,
    stock_aplicado: true,
  };

  const { data: egreso, error: egErr } = await supabase
    .from('inv_egresos_campo')
    .insert(egresoPayload)
    .select('id')
    .single();

  if (egErr) {
    if (egErr.code === '42P01') {
      return {
        ok: true,
        egresoId: null,
        transferenciaIds,
        codigos,
      };
    }
    if (egErr.message.includes('fotos') || egErr.code === '42703') {
      delete egresoPayload.fotos;
      const { data: egreso2, error: egErr2 } = await supabase
        .from('inv_egresos_campo')
        .insert(egresoPayload)
        .select('id')
        .single();
      if (egErr2) {
        return {
          ok: true,
          egresoId: null,
          transferenciaIds,
          codigos,
        };
      }
      const egresoId = String((egreso2 as { id: string }).id);
      await insertarLineasEgreso(supabase, egresoId, input.lineas, transferenciaIds, lineaIdPorMaterialTrf);
      return { ok: true, egresoId, transferenciaIds, codigos };
    }
    return { ok: false, error: egErr.message };
  }

  const egresoId = String((egreso as { id: string }).id);
  await insertarLineasEgreso(supabase, egresoId, input.lineas, transferenciaIds, lineaIdPorMaterialTrf);

  return { ok: true, egresoId, transferenciaIds, codigos };
}

async function insertarLineasEgreso(
  supabase: SupabaseClient,
  egresoId: string,
  lineas: LineaDespachoWebInput[],
  transferenciaIds: string[],
  lineaIdPorMaterialTrf: Map<string, string>,
): Promise<void> {
  const trfId = transferenciaIds[0] ?? '';
  const payload = lineas.map((l) => ({
    egreso_id: egresoId,
    material_id: l.material_id,
    cantidad: l.cantidad,
    unidad: (l.unidad ?? 'UND').trim() || 'UND',
    ci_presupuesto_partida_id: l.ci_presupuesto_partida_id?.trim() || null,
    partida_id: l.partida_id?.trim() || null,
    cronograma_tarea_id: l.cronograma_tarea_id?.trim() || null,
    partida_label: l.partida_label?.trim() || null,
    tarea_label: l.tarea_label?.trim() || null,
    material_nombre: l.material_nombre?.trim() || null,
    transferencia_linea_id: lineaIdPorMaterialTrf.get(`${trfId}:${l.material_id}`) ?? null,
  }));

  await supabase.from('inv_egresos_campo_lineas').insert(payload);
}
