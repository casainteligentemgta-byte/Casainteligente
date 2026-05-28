import type { SupabaseClient } from '@supabase/supabase-js';
import type { ImputacionPartidaInput, TransferenciaTipoMovimiento } from '@/types/inventario-obra';

export type LineaTransferenciaDespachoInput = {
  material_id: string;
  cantidad: number;
  imputaciones: ImputacionPartidaInput[];
};

export type CrearTransferenciaInput = {
  origen_ubicacion_id: string;
  destino_ubicacion_id: string;
  ci_proyecto_id: string;
  tipo_movimiento?: TransferenciaTipoMovimiento;
  observaciones?: string | null;
  usuario_despacha_id?: string | null;
  usuario_transporta_id?: string | null;
  usuario_recibe_id?: string | null;
  lineas: LineaTransferenciaDespachoInput[];
};

function codigoTransferencia(tipo: TransferenciaTipoMovimiento): string {
  const pref =
    tipo === 'salida_obra'
      ? 'SAL'
      : tipo === 'retorno_garantia'
        ? 'GAR'
        : tipo === 'retorno_merma'
          ? 'MER'
          : 'TRF';
  const t = Date.now().toString(36).toUpperCase();
  return `${pref}-${t}`;
}

export function validarDistribucionLinea(
  cantidadLinea: number,
  imputaciones: ImputacionPartidaInput[],
): { ok: boolean; error?: string; totalImputado: number } {
  const totalImputado = imputaciones.reduce((s, i) => s + Number(i.cantidad_imputada ?? 0), 0);
  if (imputaciones.length === 0) {
    return { ok: false, error: 'Distribuya la cantidad entre al menos una partida.', totalImputado };
  }
  if (totalImputado <= 0) {
    return { ok: false, error: 'Indique cantidades en las partidas.', totalImputado };
  }
  const diff = Math.abs(totalImputado - cantidadLinea);
  if (diff > 0.0001) {
    return {
      ok: false,
      error: `La suma por partidas (${totalImputado}) debe igualar la cantidad de la línea (${cantidadLinea}).`,
      totalImputado,
    };
  }
  for (const imp of imputaciones) {
    if (!imp.partida_id && !imp.ci_presupuesto_partida_id) {
      return { ok: false, error: 'Cada imputación debe tener partida.', totalImputado };
    }
    if (Number(imp.cantidad_imputada) <= 0) {
      return { ok: false, error: 'Cantidades de partida deben ser mayores a cero.', totalImputado };
    }
  }
  return { ok: true, totalImputado };
}

export async function crearTransferenciaInventario(
  supabase: SupabaseClient,
  input: CrearTransferenciaInput,
): Promise<{ transferenciaId: string; codigo: string }> {
  if (input.origen_ubicacion_id === input.destino_ubicacion_id) {
    throw new Error('Origen y destino deben ser ubicaciones distintas.');
  }
  if (!input.lineas.length) {
    throw new Error('Agregue al menos un material.');
  }

  const tipo = input.tipo_movimiento ?? 'salida_obra';
  const codigo = codigoTransferencia(tipo);

  for (const linea of input.lineas) {
    const v = validarDistribucionLinea(linea.cantidad, linea.imputaciones);
    if (!v.ok) throw new Error(v.error);
  }

  const { data: trf, error: trfErr } = await supabase
    .from('transferencias_inventario')
    .insert({
      codigo,
      tipo_movimiento: tipo,
      origen_ubicacion_id: input.origen_ubicacion_id,
      destino_ubicacion_id: input.destino_ubicacion_id,
      ci_proyecto_id: input.ci_proyecto_id,
      estado: 'pendiente',
      observaciones: input.observaciones?.trim() || null,
      usuario_despacha_id: input.usuario_despacha_id ?? null,
      usuario_transporta_id: input.usuario_transporta_id ?? null,
      usuario_recibe_id: input.usuario_recibe_id ?? null,
    })
    .select('id, codigo')
    .single();

  if (trfErr?.code === '42P01') {
    throw new Error('Módulo de transferencias no instalado. Aplique migración 180.');
  }
  if (trfErr) throw new Error(trfErr.message);

  const transferenciaId = String((trf as { id: string }).id);

  for (const linea of input.lineas) {
    const { data: tl, error: tlErr } = await supabase
      .from('transferencias_inventario_lineas')
      .insert({
        transferencia_id: transferenciaId,
        material_id: linea.material_id,
        cantidad: linea.cantidad,
        cantidad_recibida: 0,
      })
      .select('id')
      .single();

    if (tlErr) throw new Error(tlErr.message);
    const lineaId = String((tl as { id: string }).id);

    const imputacionesPayload = linea.imputaciones.map((imp) => ({
      transferencia_linea_id: lineaId,
      partida_id: imp.partida_id ?? null,
      ci_presupuesto_partida_id: imp.ci_presupuesto_partida_id ?? null,
      cantidad_imputada: imp.cantidad_imputada,
      justificacion_exceso: imp.justificacion_exceso?.trim() || null,
    }));

    const { error: impErr } = await supabase
      .from('detalle_transferencia_partidas')
      .insert(imputacionesPayload);

    if (impErr) throw new Error(impErr.message);
  }

  return { transferenciaId, codigo: String((trf as { codigo: string }).codigo) };
}
