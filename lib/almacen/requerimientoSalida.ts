import type { SupabaseClient } from '@supabase/supabase-js';
import { completarTransferenciaInventario } from '@/lib/almacen/completarTransferenciaInventario';
import { crearTransferenciaInventario } from '@/lib/almacen/crearTransferenciaInventario';
import { guardarFotoTransferencia } from '@/lib/almacen/fotoTransferencia';
import { registrarEgresoCampo } from '@/lib/almacen/registrarEgresoCampo';

/**
 * Requerimiento de salida de almacén (migración 343): el ingeniero pide un material
 * diciendo para qué, alguien del almacén lo despacha con foto y el stock se mueve.
 *
 *   solicitado → en_despacho → despachado
 *        ↘ rechazado ↙
 *
 * Todas las funciones toleran que la tabla no exista.
 */

export const TIPOS_REQUERIMIENTO_SALIDA = [
  'uso',
  'colocacion',
  'traspaso',
  'devolucion',
  'deterioro',
] as const;

export type TipoRequerimientoSalida = (typeof TIPOS_REQUERIMIENTO_SALIDA)[number];

export const ETIQUETA_TIPO_REQUERIMIENTO: Record<TipoRequerimientoSalida, string> = {
  uso: 'Uso en obra',
  colocacion: 'Colocación en obra',
  traspaso: 'Traspaso a otra obra',
  devolucion: 'Devolución a proveedor',
  deterioro: 'Deterioro o pérdida',
};

/** Ubicación virtual a la que va lo que sale del inventario disponible (migración 343). */
export const CODIGO_UBICACION_VIRTUAL: Partial<Record<TipoRequerimientoSalida, string>> = {
  devolucion: 'DEVOLUCIONES',
  deterioro: 'BAJAS',
};

export const ESTADOS_REQUERIMIENTO_SALIDA = [
  'solicitado',
  'en_despacho',
  'despachado',
  'rechazado',
  'cancelado',
] as const;

export type EstadoRequerimientoSalida = (typeof ESTADOS_REQUERIMIENTO_SALIDA)[number];

export type FotoRequerimiento = { storage_path: string; url: string };

export type RequerimientoSalida = {
  id: string;
  codigo: string;
  proyecto_id: string;
  origen_ubicacion_id: string;
  destino_ubicacion_id: string | null;
  tipo: TipoRequerimientoSalida;
  material_id: string;
  material_nombre: string;
  unidad: string;
  cantidad: number;
  motivo: string | null;
  estado: EstadoRequerimientoSalida;
  solicitante_chat_id: number | null;
  solicitante_nombre: string | null;
  despachador_chat_id: number | null;
  despachador_nombre: string | null;
  motivo_rechazo: string | null;
  transferencia_id: string | null;
};

const TABLA = 'inv_requerimientos_salida';

type ErrorDb = { code?: string; message?: string } | null;

/** La tabla aún no existe (Postgres 42P01) o PostgREST no la conoce (PGRST205). */
export function esTablaRequerimientosAusente(error: ErrorDb): boolean {
  if (!error) return false;
  if (error.code === '42P01' || error.code === 'PGRST205') return true;
  return (
    /inv_requerimientos_salida/.test(error.message ?? '') &&
    /does not exist|schema cache/i.test(error.message ?? '')
  );
}

export function esTipoRequerimientoSalida(v: unknown): v is TipoRequerimientoSalida {
  return (TIPOS_REQUERIMIENTO_SALIDA as readonly string[]).includes(String(v));
}

function esEstado(v: unknown): v is EstadoRequerimientoSalida {
  return (ESTADOS_REQUERIMIENTO_SALIDA as readonly string[]).includes(String(v));
}

function chatIdNumerico(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function texto(v: unknown): string | null {
  const t = v == null ? '' : String(v).trim();
  return t || null;
}

/** `unknown` a propósito: `select('*')` sin tipos generados no da una fila tipada. */
function mapRequerimiento(fila: unknown): RequerimientoSalida {
  const row = fila as Record<string, unknown>;
  return {
    id: String(row.id),
    codigo: String(row.codigo ?? ''),
    proyecto_id: String(row.proyecto_id),
    origen_ubicacion_id: String(row.origen_ubicacion_id),
    destino_ubicacion_id: texto(row.destino_ubicacion_id),
    tipo: esTipoRequerimientoSalida(row.tipo) ? row.tipo : 'uso',
    material_id: String(row.material_id),
    material_nombre: String(row.material_nombre ?? 'Material'),
    unidad: String(row.unidad ?? 'UND'),
    cantidad: Number(row.cantidad) || 0,
    motivo: texto(row.motivo),
    estado: esEstado(row.estado) ? row.estado : 'solicitado',
    solicitante_chat_id: chatIdNumerico(row.solicitante_chat_id),
    solicitante_nombre: texto(row.solicitante_nombre),
    despachador_chat_id: chatIdNumerico(row.despachador_chat_id),
    despachador_nombre: texto(row.despachador_nombre),
    motivo_rechazo: texto(row.motivo_rechazo),
    transferencia_id: texto(row.transferencia_id),
  };
}

function primeraFila(data: unknown): RequerimientoSalida | null {
  const fila = Array.isArray(data) ? data[0] : data;
  return fila ? mapRequerimiento(fila) : null;
}

function nuevoCodigo(): string {
  return `RS-${Date.now().toString(36).toUpperCase()}`;
}

/** ¿Está instalada la tabla? El bot la consulta antes de ofrecer «Pedir material». */
export async function requerimientosSalidaDisponibles(supabase: SupabaseClient): Promise<boolean> {
  const { error } = await supabase.from(TABLA).select('id').limit(1);
  return !error;
}

export type CrearRequerimientoSalidaInput = {
  proyectoId: string;
  origenUbicacionId: string;
  destinoUbicacionId?: string | null;
  tipo: TipoRequerimientoSalida;
  materialId: string;
  materialNombre: string;
  unidad: string;
  cantidad: number;
  motivo?: string | null;
  solicitanteChatId: string | number;
  solicitanteNombre: string;
};

export type CrearRequerimientoSalidaResult =
  | { ok: true; requerimiento: RequerimientoSalida }
  | { ok: false; motivo: 'sin_migracion' | 'error'; error?: string };

export async function crearRequerimientoSalida(
  supabase: SupabaseClient,
  input: CrearRequerimientoSalidaInput,
): Promise<CrearRequerimientoSalidaResult> {
  if (!(input.cantidad > 0)) return { ok: false, motivo: 'error', error: 'Cantidad inválida.' };
  if (input.tipo === 'traspaso' && !input.destinoUbicacionId?.trim()) {
    return { ok: false, motivo: 'error', error: 'El traspaso necesita la obra de destino.' };
  }

  const { data, error } = await supabase
    .from(TABLA)
    .insert({
      codigo: nuevoCodigo(),
      proyecto_id: input.proyectoId.trim(),
      origen_ubicacion_id: input.origenUbicacionId.trim(),
      destino_ubicacion_id: input.tipo === 'traspaso' ? texto(input.destinoUbicacionId) : null,
      tipo: input.tipo,
      material_id: input.materialId.trim(),
      material_nombre: input.materialNombre.trim().slice(0, 200) || 'Material',
      unidad: input.unidad.trim() || 'UND',
      cantidad: input.cantidad,
      motivo: texto(input.motivo)?.slice(0, 500) ?? null,
      estado: 'solicitado',
      solicitante_chat_id: chatIdNumerico(input.solicitanteChatId),
      solicitante_nombre: input.solicitanteNombre.trim().slice(0, 150) || 'Solicitante',
      fotos: [],
    })
    .select('*')
    .single();

  if (esTablaRequerimientosAusente(error)) return { ok: false, motivo: 'sin_migracion' };
  if (error || !data) return { ok: false, motivo: 'error', error: error?.message ?? 'Sin datos' };
  return { ok: true, requerimiento: mapRequerimiento(data) };
}

export async function obtenerRequerimientoSalida(
  supabase: SupabaseClient,
  id: string,
): Promise<RequerimientoSalida | null> {
  const { data, error } = await supabase.from(TABLA).select('*').eq('id', id.trim()).maybeSingle();
  if (error || !data) return null;
  return mapRequerimiento(data);
}

/**
 * «Despachar». Solo gana quien lo encuentra todavía solicitado: el filtro por estado
 * va en el mismo UPDATE, así dos toques simultáneos no lo asignan a dos personas.
 */
export async function tomarRequerimientoSalida(
  supabase: SupabaseClient,
  params: { id: string; chatId: string | number; nombre: string },
): Promise<RequerimientoSalida | null> {
  const ahora = new Date().toISOString();
  const { data, error } = await supabase
    .from(TABLA)
    .update({
      estado: 'en_despacho',
      despachador_chat_id: chatIdNumerico(params.chatId),
      despachador_nombre: params.nombre.trim().slice(0, 150) || 'Almacén',
      tomado_at: ahora,
      updated_at: ahora,
    })
    .eq('id', params.id.trim())
    .eq('estado', 'solicitado')
    .select('*');
  if (error) return null;
  return primeraFila(data);
}

/** Quien lo tomó lo devuelve a «solicitado» (antes de enviar la foto). */
export async function soltarRequerimientoSalida(
  supabase: SupabaseClient,
  params: { id: string; chatId: string | number },
): Promise<RequerimientoSalida | null> {
  const chat = chatIdNumerico(params.chatId);
  if (chat == null) return null;
  const { data, error } = await supabase
    .from(TABLA)
    .update({
      estado: 'solicitado',
      despachador_chat_id: null,
      despachador_nombre: null,
      tomado_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.id.trim())
    .eq('estado', 'en_despacho')
    .eq('despachador_chat_id', chat)
    .select('*');
  if (error) return null;
  return primeraFila(data);
}

/** Rechazo desde el almacén. Vale mientras nadie lo haya despachado. */
export async function rechazarRequerimientoSalida(
  supabase: SupabaseClient,
  params: { id: string; chatId: string | number; nombre: string; motivo: string },
): Promise<RequerimientoSalida | null> {
  const { data, error } = await supabase
    .from(TABLA)
    .update({
      estado: 'rechazado',
      motivo_rechazo: params.motivo.trim().slice(0, 300) || 'Rechazado por almacén',
      despachador_chat_id: chatIdNumerico(params.chatId),
      despachador_nombre: params.nombre.trim().slice(0, 150) || 'Almacén',
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.id.trim())
    .in('estado', ['solicitado', 'en_despacho'])
    .select('*');
  if (error) return null;
  return primeraFila(data);
}

/** El requerimiento más reciente que este chat tomó y al que le falta la foto. */
export async function requerimientoEsperandoFoto(
  supabase: SupabaseClient,
  chatId: string | number,
): Promise<RequerimientoSalida | null> {
  const chat = chatIdNumerico(chatId);
  if (chat == null) return null;
  const { data, error } = await supabase
    .from(TABLA)
    .select('*')
    .eq('despachador_chat_id', chat)
    .eq('estado', 'en_despacho')
    .is('despachado_at', null)
    .order('tomado_at', { ascending: false })
    .limit(1);
  if (error) return null;
  return primeraFila(data);
}

/**
 * Reserva el despacho antes de mover stock. Telegram reintenta un mensaje si el bot tarda
 * en responder; sin esta marca, la misma foto podría descontar el stock dos veces.
 */
async function reservarDespacho(supabase: SupabaseClient, id: string): Promise<boolean> {
  const { data, error } = await supabase
    .from(TABLA)
    .update({ despachado_at: new Date().toISOString() })
    .eq('id', id)
    .eq('estado', 'en_despacho')
    .is('despachado_at', null)
    .select('id');
  return !error && Array.isArray(data) && data.length > 0;
}

async function liberarDespacho(supabase: SupabaseClient, id: string): Promise<void> {
  await supabase
    .from(TABLA)
    .update({ despachado_at: null })
    .eq('id', id)
    .eq('estado', 'en_despacho');
}

async function ubicacionVirtual(supabase: SupabaseClient, codigo: string): Promise<string | null> {
  const { data } = await supabase.from('inv_ubicaciones').select('id').eq('codigo', codigo).maybeSingle();
  return data ? String((data as { id: string }).id) : null;
}

export type DespachoRequerimientoResult =
  | { ok: true; requerimiento: RequerimientoSalida; codigoTransferencia: string }
  | { ok: false; error: string };

/**
 * Mueve el stock según el motivo y deja el requerimiento en «despachado».
 * Si el movimiento falla (p. ej. ya no hay stock), el requerimiento sigue en
 * «en_despacho» para que el almacén lo suelte o lo rechace.
 */
export async function despacharRequerimientoSalida(
  supabase: SupabaseClient,
  params: { requerimiento: RequerimientoSalida; foto: FotoRequerimiento; nombreObra: string },
): Promise<DespachoRequerimientoResult> {
  const r = params.requerimiento;
  const etiqueta = ETIQUETA_TIPO_REQUERIMIENTO[r.tipo];
  const observaciones = [
    `${etiqueta} · ${r.codigo}`,
    r.motivo,
    r.solicitante_nombre ? `Pidió: ${r.solicitante_nombre}` : null,
    r.despachador_nombre ? `Despachó: ${r.despachador_nombre}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  if (!(await reservarDespacho(supabase, r.id))) {
    return { ok: false, error: 'Este requerimiento ya se está despachando o ya no está a su nombre.' };
  }

  let transferenciaId: string;
  let codigoTransferencia: string;

  try {
    if (r.tipo === 'uso' || r.tipo === 'colocacion') {
      const egreso = await registrarEgresoCampo(supabase, {
        proyectoId: r.proyecto_id,
        nombreObra: params.nombreObra,
        origenUbicacionId: r.origen_ubicacion_id,
        obreroNombre: r.solicitante_nombre ?? 'Solicitante',
        observaciones,
        fotoStoragePath: params.foto.storage_path,
        fotoUrl: params.foto.url,
        chatId: r.despachador_chat_id != null ? String(r.despachador_chat_id) : null,
        lineas: [
          {
            material_id: r.material_id,
            material_nombre: r.material_nombre,
            cantidad: r.cantidad,
            unidad: r.unidad,
          },
        ],
      });
      if (!egreso.ok) {
        await liberarDespacho(supabase, r.id);
        return { ok: false, error: egreso.error };
      }
      transferenciaId = egreso.transferenciaId;
      codigoTransferencia = egreso.codigoTransferencia;
    } else {
      const codigoVirtual = CODIGO_UBICACION_VIRTUAL[r.tipo];
      const destino =
        r.tipo === 'traspaso'
          ? r.destino_ubicacion_id
          : codigoVirtual
            ? await ubicacionVirtual(supabase, codigoVirtual)
            : null;
      if (!destino) {
        await liberarDespacho(supabase, r.id);
        return {
          ok: false,
          error:
            r.tipo === 'traspaso'
              ? 'El requerimiento no tiene obra de destino.'
              : `Falta la ubicación ${codigoVirtual} en la base (migración 343).`,
        };
      }
      const creada = await crearTransferenciaInventario(supabase, {
        origen_ubicacion_id: r.origen_ubicacion_id,
        destino_ubicacion_id: destino,
        ci_proyecto_id: r.proyecto_id,
        tipo_movimiento:
          r.tipo === 'traspaso'
            ? 'transferencia'
            : r.tipo === 'devolucion'
              ? 'retorno_garantia'
              : 'retorno_merma',
        observaciones,
        lineas: [{ material_id: r.material_id, cantidad: r.cantidad, imputaciones: [] }],
      });
      await completarTransferenciaInventario(supabase, creada.transferenciaId);
      await guardarFotoTransferencia(supabase, creada.transferenciaId, params.foto, observaciones);
      transferenciaId = creada.transferenciaId;
      codigoTransferencia = creada.codigo;
    }
  } catch (e) {
    await liberarDespacho(supabase, r.id);
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo mover el stock.' };
  }

  const ahora = new Date().toISOString();
  const { data, error } = await supabase
    .from(TABLA)
    .update({
      estado: 'despachado',
      fotos: [params.foto],
      transferencia_id: transferenciaId,
      despachado_at: ahora,
      updated_at: ahora,
    })
    .eq('id', r.id)
    .select('*');

  const actualizado = error ? null : primeraFila(data);
  // El stock ya se movió: aunque no se haya podido marcar, se informa como despachado.
  if (!actualizado) {
    console.error('[requerimientoSalida] stock movido pero no se marcó despachado:', r.codigo, error?.message);
  }
  return {
    ok: true,
    requerimiento: actualizado ?? { ...r, estado: 'despachado', transferencia_id: transferenciaId },
    codigoTransferencia,
  };
}
