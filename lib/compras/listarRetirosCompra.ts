import type { SupabaseClient } from '@supabase/supabase-js';
import { PROCUREMENT_DOCUMENTS_BUCKET } from '@/lib/almacen/procurementDocumentStorage';
import {
  ESTADOS_RETIRO_COMPRA,
  esTablaRetirosAusente,
  type EstadoRetiroCompra,
} from '@/lib/compras/retiroCompra';

/** Fila del cuadro «Retiros» en /almacen/retiros. */
export type RetiroCompraVista = {
  id: string;
  estado: EstadoRetiroCompra;
  numero_factura: string | null;
  proveedor_nombre: string | null;
  obra: string | null;
  almacen: string | null;
  ticket_procura: string | null;
  transportista_nombre: string | null;
  created_at: string | null;
  asignado_at: string | null;
  retirado_at: string | null;
  entregado_at: string | null;
  /** Enlaces temporales (1 h) a las fotos tomadas al retirar. */
  fotos: string[];
};

export type ListaRetirosCompra = {
  retiros: RetiroCompraVista[];
  /** La tabla aún no existe: falta aplicar la migración 341. */
  sinMigracion: boolean;
};

export const ETIQUETA_ESTADO_RETIRO: Record<EstadoRetiroCompra, string> = {
  pendiente: 'Por retirar',
  asignado: 'Asignado, falta foto',
  en_camino: 'En camino',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
};

/** Estados que todavía requieren que alguien haga algo. */
export const ESTADOS_RETIRO_ACTIVOS: readonly EstadoRetiroCompra[] = [
  'pendiente',
  'asignado',
  'en_camino',
];

const VIGENCIA_ENLACE_FOTO_SEG = 60 * 60;

type FilaDb = Record<string, unknown> & {
  ci_proyectos?: { nombre?: string | null } | { nombre?: string | null }[] | null;
  inv_ubicaciones?: { nombre?: string | null } | { nombre?: string | null }[] | null;
  ci_procuras?: { ticket?: string | null } | { ticket?: string | null }[] | null;
};

function texto(v: unknown): string | null {
  const t = v == null ? '' : String(v).trim();
  return t || null;
}

function campoRelacion<T extends Record<string, unknown>>(
  rel: T | T[] | null | undefined,
  campo: keyof T,
): string | null {
  if (!rel) return null;
  const fila = Array.isArray(rel) ? rel[0] : rel;
  return texto(fila?.[campo]);
}

function esEstado(v: unknown): v is EstadoRetiroCompra {
  return (ESTADOS_RETIRO_COMPRA as readonly string[]).includes(String(v));
}

function rutasFotos(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((f) => texto((f as { storage_path?: unknown })?.storage_path))
    .filter((p): p is string => p != null);
}

async function enlacesFotos(supabase: SupabaseClient, rutas: string[]): Promise<string[]> {
  if (!rutas.length) return [];
  const { data, error } = await supabase.storage
    .from(PROCUREMENT_DOCUMENTS_BUCKET)
    .createSignedUrls(rutas, VIGENCIA_ENLACE_FOTO_SEG);
  if (error || !data) return [];
  return data.map((d) => d.signedUrl).filter((u): u is string => Boolean(u));
}

/** Retiros más recientes primero. `soloActivos` deja fuera entregados y cancelados. */
export async function listarRetirosCompra(
  supabase: SupabaseClient,
  opts?: { soloActivos?: boolean; limite?: number },
): Promise<ListaRetirosCompra> {
  let q = supabase
    .from('ci_compras_retiros')
    .select('*, ci_proyectos(nombre), inv_ubicaciones(nombre), ci_procuras(ticket)')
    .order('created_at', { ascending: false })
    .limit(Math.min(Math.max(opts?.limite ?? 100, 1), 300));
  if (opts?.soloActivos) q = q.in('estado', [...ESTADOS_RETIRO_ACTIVOS]);

  const { data, error } = await q;
  if (esTablaRetirosAusente(error)) return { retiros: [], sinMigracion: true };
  if (error) throw new Error(error.message);

  const filas = (data ?? []) as unknown as FilaDb[];
  const retiros = await Promise.all(
    filas.map(async (f): Promise<RetiroCompraVista> => ({
      id: String(f.id),
      estado: esEstado(f.estado) ? f.estado : 'pendiente',
      numero_factura: texto(f.numero_factura),
      proveedor_nombre: texto(f.proveedor_nombre),
      obra: campoRelacion(f.ci_proyectos, 'nombre'),
      almacen: campoRelacion(f.inv_ubicaciones, 'nombre'),
      ticket_procura: campoRelacion(f.ci_procuras, 'ticket'),
      transportista_nombre: texto(f.transportista_nombre),
      created_at: texto(f.created_at),
      asignado_at: texto(f.asignado_at),
      retirado_at: texto(f.retirado_at),
      entregado_at: texto(f.entregado_at),
      fotos: await enlacesFotos(supabase, rutasFotos(f.fotos)),
    })),
  );

  return { retiros, sinMigracion: false };
}
