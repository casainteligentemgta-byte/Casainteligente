import type { SupabaseClient } from '@supabase/supabase-js';

export type ProveedorSugeridoIngreso = {
  key: string;
  nombre: string;
  empresasId?: string | null;
};

/** Clave estable para callbacks Telegram (sin acentos ni espacios). */
export function proveedorKeyIngresoManual(name: string | null | undefined): string {
  const k = String(name ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .trim();
  return k || 'SINPROVEEDOR';
}

/**
 * Proveedores frecuentes para picker en ingreso Telegram: catálogo empresas + usados en la obra.
 */
export async function listarProveedoresSugeridosIngreso(
  supabase: SupabaseClient,
  proyectoId: string,
): Promise<ProveedorSugeridoIngreso[]> {
  const map = new Map<string, ProveedorSugeridoIngreso>();

  const { data: empresas } = await supabase
    .from('empresas')
    .select('id,nombre')
    .order('nombre')
    .limit(120);

  for (const e of empresas ?? []) {
    const nombre = String(e.nombre ?? '').trim();
    if (nombre.length < 2) continue;
    const key = proveedorKeyIngresoManual(nombre);
    map.set(key, { key, nombre, empresasId: String(e.id) });
  }

  const { data: campo } = await supabase
    .from('ci_recepciones_campo')
    .select('proveedor_nombre')
    .eq('proyecto_id', proyectoId)
    .not('proveedor_nombre', 'is', null)
    .order('created_at', { ascending: false })
    .limit(40);

  for (const r of campo ?? []) {
    const nombre = String(r.proveedor_nombre ?? '').trim();
    if (nombre.length < 2) continue;
    const key = proveedorKeyIngresoManual(nombre);
    if (!map.has(key)) {
      map.set(key, { key, nombre, empresasId: null });
    }
  }

  return Array.from(map.values()).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}
