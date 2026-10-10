import type { SupabaseClient } from '@supabase/supabase-js';
import {
  ESTADOS_REQUERIMIENTO_SALIDA,
  TIPOS_REQUERIMIENTO_SALIDA,
  esTablaRequerimientosAusente,
  type EstadoRequerimientoSalida,
  type TipoRequerimientoSalida,
} from '@/lib/almacen/requerimientoSalida';

/** Fila del cuadro «Pedidos de material» en /almacen/pedidos. */
export type PedidoMaterialVista = {
  id: string;
  codigo: string;
  estado: EstadoRequerimientoSalida;
  tipo: TipoRequerimientoSalida;
  material_nombre: string;
  cantidad: number;
  unidad: string;
  motivo: string | null;
  obra: string | null;
  origen: string | null;
  /** Solo en traspasos, devoluciones y bajas: a dónde fue el material. */
  destino: string | null;
  solicitante_nombre: string | null;
  despachador_nombre: string | null;
  motivo_rechazo: string | null;
  /** Código del movimiento de inventario que generó el despacho. */
  movimiento_codigo: string | null;
  created_at: string | null;
  tomado_at: string | null;
  despachado_at: string | null;
  /** Enlaces temporales (1 h) a las fotos tomadas al despachar. */
  fotos: string[];
};

export type ListaPedidosMaterial = {
  pedidos: PedidoMaterialVista[];
  /** La tabla aún no existe: falta aplicar la migración 343. */
  sinMigracion: boolean;
};

export const ETIQUETA_ESTADO_PEDIDO: Record<EstadoRequerimientoSalida, string> = {
  solicitado: 'Por despachar',
  en_despacho: 'En despacho, falta foto',
  despachado: 'Despachado',
  rechazado: 'Rechazado',
  cancelado: 'Cancelado',
};

/** Estados que todavía requieren que alguien del almacén haga algo. */
export const ESTADOS_PEDIDO_ACTIVOS: readonly EstadoRequerimientoSalida[] = ['solicitado', 'en_despacho'];

const BUCKET_FOTOS = 'ci-proyectos-media';
const VIGENCIA_ENLACE_FOTO_SEG = 60 * 60;

type FilaDb = Record<string, unknown> & {
  ci_proyectos?: { nombre?: string | null } | { nombre?: string | null }[] | null;
};

function texto(v: unknown): string | null {
  const t = v == null ? '' : String(v).trim();
  return t || null;
}

function nombreObra(rel: FilaDb['ci_proyectos']): string | null {
  if (!rel) return null;
  return texto((Array.isArray(rel) ? rel[0] : rel)?.nombre);
}

function esEstado(v: unknown): v is EstadoRequerimientoSalida {
  return (ESTADOS_REQUERIMIENTO_SALIDA as readonly string[]).includes(String(v));
}

function esTipo(v: unknown): v is TipoRequerimientoSalida {
  return (TIPOS_REQUERIMIENTO_SALIDA as readonly string[]).includes(String(v));
}

function rutasFotos(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((f) => texto((f as { storage_path?: unknown })?.storage_path))
    .filter((p): p is string => p != null);
}

async function enlacesFotos(supabase: SupabaseClient, rutas: string[]): Promise<string[]> {
  if (!rutas.length) return [];
  const { data, error } = await supabase.storage.from(BUCKET_FOTOS).createSignedUrls(rutas, VIGENCIA_ENLACE_FOTO_SEG);
  if (error || !data) return [];
  return data.map((d) => d.signedUrl).filter((u): u is string => Boolean(u));
}

/** Nombre (o código) de cada fila pedida por id; vacío si la consulta falla. */
async function mapaPorId(
  supabase: SupabaseClient,
  tabla: string,
  campo: string,
  ids: string[],
): Promise<Map<string, string>> {
  const mapa = new Map<string, string>();
  const unicos = Array.from(new Set(ids.filter(Boolean)));
  if (!unicos.length) return mapa;
  const { data, error } = await supabase.from(tabla).select(`id,${campo}`).in('id', unicos);
  if (error) return mapa;
  for (const fila of (data ?? []) as unknown as Array<Record<string, unknown>>) {
    const valor = texto(fila[campo]);
    if (valor) mapa.set(String(fila.id), valor);
  }
  return mapa;
}

/** Pedidos más recientes primero. `soloActivos` deja fuera despachados, rechazados y cancelados. */
export async function listarPedidosMaterial(
  supabase: SupabaseClient,
  opts?: { soloActivos?: boolean; limite?: number },
): Promise<ListaPedidosMaterial> {
  let q = supabase
    .from('inv_requerimientos_salida')
    .select('*, ci_proyectos(nombre)')
    .order('created_at', { ascending: false })
    .limit(Math.min(Math.max(opts?.limite ?? 100, 1), 300));
  if (opts?.soloActivos) q = q.in('estado', [...ESTADOS_PEDIDO_ACTIVOS]);

  const { data, error } = await q;
  if (esTablaRequerimientosAusente(error)) return { pedidos: [], sinMigracion: true };
  if (error) throw new Error(error.message);

  const filas = (data ?? []) as unknown as FilaDb[];
  const [ubicaciones, movimientos] = await Promise.all([
    mapaPorId(
      supabase,
      'inv_ubicaciones',
      'nombre',
      filas.flatMap((f) => [texto(f.origen_ubicacion_id) ?? '', texto(f.destino_ubicacion_id) ?? '']),
    ),
    mapaPorId(
      supabase,
      'transferencias_inventario',
      'codigo',
      filas.map((f) => texto(f.transferencia_id) ?? ''),
    ),
  ]);

  const pedidos = await Promise.all(
    filas.map(async (f): Promise<PedidoMaterialVista> => ({
      id: String(f.id),
      codigo: texto(f.codigo) ?? '—',
      estado: esEstado(f.estado) ? f.estado : 'solicitado',
      tipo: esTipo(f.tipo) ? f.tipo : 'uso',
      material_nombre: texto(f.material_nombre) ?? 'Material',
      cantidad: Number(f.cantidad) || 0,
      unidad: texto(f.unidad) ?? 'UND',
      motivo: texto(f.motivo),
      obra: nombreObra(f.ci_proyectos),
      origen: ubicaciones.get(texto(f.origen_ubicacion_id) ?? '') ?? null,
      destino: ubicaciones.get(texto(f.destino_ubicacion_id) ?? '') ?? null,
      solicitante_nombre: texto(f.solicitante_nombre),
      despachador_nombre: texto(f.despachador_nombre),
      motivo_rechazo: texto(f.motivo_rechazo),
      movimiento_codigo: movimientos.get(texto(f.transferencia_id) ?? '') ?? null,
      created_at: texto(f.created_at),
      tomado_at: texto(f.tomado_at),
      despachado_at: texto(f.despachado_at),
      fotos: await enlacesFotos(supabase, rutasFotos(f.fotos)),
    })),
  );

  return { pedidos, sinMigracion: false };
}
