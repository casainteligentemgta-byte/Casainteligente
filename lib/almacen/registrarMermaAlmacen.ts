import type { SupabaseClient } from '@supabase/supabase-js';
import { aplicarDeltaStockInventario } from '@/lib/almacen/aplicarDeltaStockInventario';
import { crearTransferenciaInventario } from '@/lib/almacen/crearTransferenciaInventario';
import { guardarFotoTransferencia } from '@/lib/almacen/fotoTransferencia';

export const MOTIVOS_MERMA = ['danado', 'vencido', 'perdido', 'robo'] as const;
export type MotivoMerma = (typeof MOTIVOS_MERMA)[number];

export const ETIQUETA_MOTIVO_MERMA: Record<MotivoMerma, string> = {
  danado: 'Dañado',
  vencido: 'Vencido',
  perdido: 'Perdido',
  robo: 'Robo',
};

const CODIGO_BAJAS = 'BAJAS';

export function esMotivoMerma(v: unknown): v is MotivoMerma {
  return (MOTIVOS_MERMA as readonly string[]).includes(String(v));
}

export type RegistrarMermaAlmacenInput = {
  origenUbicacionId: string;
  materialId: string;
  materialNombre?: string | null;
  cantidad: number;
  motivo: MotivoMerma;
  observaciones?: string | null;
  fotoStoragePath?: string | null;
  fotoUrl?: string | null;
  chatId?: string | null;
};

export type ResultadoMermaAlmacen =
  | {
      ok: true;
      transferenciaId: string;
      codigo: string;
      origenNombre: string;
      destinoNombre: string;
    }
  | { ok: false; error: string };

async function ubicacionPorCodigo(
  supabase: SupabaseClient,
  codigo: string,
): Promise<{ id: string; nombre: string } | null> {
  const { data, error } = await supabase
    .from('inv_ubicaciones')
    .select('id, nombre')
    .eq('codigo', codigo)
    .maybeSingle();
  if (error || !data?.id) return null;
  return { id: String(data.id), nombre: String(data.nombre ?? codigo) };
}

async function datosOrigen(
  supabase: SupabaseClient,
  ubicacionId: string,
): Promise<{ id: string; nombre: string; proyectoId: string | null } | null> {
  const { data, error } = await supabase
    .from('inv_ubicaciones')
    .select('id, nombre, ci_proyecto_id')
    .eq('id', ubicacionId)
    .maybeSingle();
  if (error || !data?.id) return null;
  return {
    id: String(data.id),
    nombre: String(data.nombre ?? 'Almacén'),
    proyectoId: data.ci_proyecto_id ? String(data.ci_proyecto_id) : null,
  };
}

async function stockDisponible(
  supabase: SupabaseClient,
  ubicacionId: string,
  materialId: string,
): Promise<number> {
  const { data } = await supabase
    .from('inventario_stock')
    .select('cantidad_disponible')
    .eq('ubicacion_id', ubicacionId)
    .eq('material_id', materialId)
    .maybeSingle();
  return Number(data?.cantidad_disponible ?? 0);
}

async function aplicarDeltaBaja(
  supabase: SupabaseClient,
  params: {
    ubicacionId: string;
    materialId: string;
    delta: number;
    transferenciaId: string;
    notas: string;
  },
): Promise<void> {
  try {
    await aplicarDeltaStockInventario(supabase, {
      ubicacionId: params.ubicacionId,
      materialId: params.materialId,
      deltaDisponible: params.delta,
      tipoMovimiento: 'baja',
      referenciaTipo: 'transferencias_inventario',
      referenciaId: params.transferenciaId,
      notas: params.notas,
    });
  } catch {
    await aplicarDeltaStockInventario(supabase, {
      ubicacionId: params.ubicacionId,
      materialId: params.materialId,
      deltaDisponible: params.delta,
      tipoMovimiento: 'ajuste',
      referenciaTipo: 'transferencias_inventario',
      referenciaId: params.transferenciaId,
      notas: params.notas,
    });
  }
}

/**
 * Baja directa de almacén (deterioro / merma). Escribe transferencias_inventario
 * (retorno_merma → BAJAS), descuenta stock y deja el kardex en inv_movimientos.
 *
 * El stock se aplica por RPC (no se espera al trigger): así el bot no deja la
 * transferencia pendiente si el trigger de la migr. 180 no corre con la firma nueva.
 */
export async function registrarMermaAlmacen(
  supabase: SupabaseClient,
  input: RegistrarMermaAlmacenInput,
): Promise<ResultadoMermaAlmacen> {
  const cantidad = Number(input.cantidad);
  if (!(cantidad > 0)) {
    return { ok: false, error: 'La cantidad debe ser mayor a cero.' };
  }
  if (!esMotivoMerma(input.motivo)) {
    return { ok: false, error: 'Elija un motivo: dañado, vencido, perdido o robo.' };
  }

  const origen = await datosOrigen(supabase, input.origenUbicacionId);
  if (!origen) {
    return { ok: false, error: 'No se encontró el almacén.' };
  }
  if (!origen.proyectoId) {
    return { ok: false, error: 'Ese almacén no está vinculado a una obra.' };
  }

  const bajas = await ubicacionPorCodigo(supabase, CODIGO_BAJAS);
  if (!bajas) {
    return {
      ok: false,
      error: 'Falta la ubicación BAJAS en la base (migración 343). Avise al administrador.',
    };
  }
  if (origen.id === bajas.id) {
    return { ok: false, error: 'El almacén de origen no puede ser BAJAS.' };
  }

  const disp = await stockDisponible(supabase, origen.id, input.materialId);
  if (disp + 0.0001 < cantidad) {
    const nombre = input.materialNombre?.trim() || 'Material';
    return {
      ok: false,
      error: `No hay suficiente stock de «${nombre}»: hay ${disp}, pidió ${cantidad}.`,
    };
  }

  const etiqueta = ETIQUETA_MOTIVO_MERMA[input.motivo];
  const material = input.materialNombre?.trim() || 'Material';
  const obs = [
    `Baja · ${etiqueta}`,
    `${material} × ${cantidad}`,
    input.observaciones?.trim() || null,
    input.chatId ? `Telegram ${input.chatId}` : null,
  ]
    .filter(Boolean)
    .join(' · ')
    .slice(0, 500);

  let transferenciaId: string;
  let codigo: string;
  try {
    const trf = await crearTransferenciaInventario(supabase, {
      origen_ubicacion_id: origen.id,
      destino_ubicacion_id: bajas.id,
      ci_proyecto_id: origen.proyectoId,
      tipo_movimiento: 'retorno_merma',
      observaciones: obs,
      lineas: [{ material_id: input.materialId, cantidad, imputaciones: [] }],
    });
    transferenciaId = trf.transferenciaId;
    codigo = trf.codigo;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo registrar la baja.' };
  }

  const notasKardex = `Baja · ${etiqueta} · ${material} × ${cantidad}`;
  try {
    await aplicarDeltaBaja(supabase, {
      ubicacionId: origen.id,
      materialId: input.materialId,
      delta: -cantidad,
      transferenciaId,
      notas: notasKardex,
    });
    await aplicarDeltaBaja(supabase, {
      ubicacionId: bajas.id,
      materialId: input.materialId,
      delta: cantidad,
      transferenciaId,
      notas: notasKardex,
    });
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Se creó la baja pero no se pudo descontar el stock.',
    };
  }

  // pendiente → completado (el trigger no aplica stock en ese salto; ya lo hizo la RPC).
  const ahora = new Date().toISOString();
  const { error: estErr } = await supabase
    .from('transferencias_inventario')
    .update({
      estado: 'completado',
      despachado_at: ahora,
      recibido_at: ahora,
      updated_at: ahora,
    })
    .eq('id', transferenciaId)
    .eq('estado', 'pendiente');

  if (estErr) {
    console.warn(
      '[merma] stock aplicado pero no se marcó la transferencia completada:',
      estErr.message,
    );
  }

  if (input.fotoStoragePath?.trim()) {
    await guardarFotoTransferencia(
      supabase,
      transferenciaId,
      {
        storage_path: input.fotoStoragePath.trim(),
        url: input.fotoUrl ?? '',
      },
      obs,
    );
  }

  return {
    ok: true,
    transferenciaId,
    codigo,
    origenNombre: origen.nombre,
    destinoNombre: bajas.nombre,
  };
}
