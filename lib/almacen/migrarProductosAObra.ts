import type { SupabaseClient } from '@supabase/supabase-js';

export type ProductoCatalogoRow = {
  id: number;
  nombre: string;
  categoria: string | null;
  marca: string | null;
  modelo: string | null;
  descripcion: string | null;
  costo: number | null;
  imagen: string | null;
  ubicacion: string | null;
};

export type MigrarProductosAObraInput = {
  proyectoId: string;
  productIds: number[];
  ubicacionId?: string | null;
  stockInicial?: number;
  presupuestoPartidaId?: string | null;
  /** Si ya existe ítem con mismo product_id en la obra, no duplicar. */
  omitirExistentes?: boolean;
};

export type MigrarProductosAObraResult = {
  creados: number;
  omitidos: number;
  errores: string[];
  materialIds: string[];
};

const CATEGORIA_PRODUCTO_A_MATERIAL: Record<string, string> = {
  herramientas: 'Herramientas',
  materiales: 'Materiales',
  insumos: 'Insumos',
  consumibles: 'Consumibles',
};

async function resolverCategoriaId(
  supabase: SupabaseClient,
  nombreCategoriaProducto: string | null,
): Promise<string> {
  const { data: cats, error } = await supabase
    .from('material_categories')
    .select('id, name')
    .order('name');

  if (error || !cats?.length) {
    throw new Error(
      error?.message ?? 'No hay categorías de material. Configure maestros de almacén.',
    );
  }

  const hint = (nombreCategoriaProducto ?? '').trim().toLowerCase();
  const mapped = CATEGORIA_PRODUCTO_A_MATERIAL[hint];
  if (mapped) {
    const hit = cats.find((c) => c.name.toLowerCase() === mapped.toLowerCase());
    if (hit) return String(hit.id);
  }
  if (hint) {
    const partial = cats.find((c) => c.name.toLowerCase().includes(hint) || hint.includes(c.name.toLowerCase()));
    if (partial) return String(partial.id);
  }

  const materiales = cats.find((c) => c.name.toLowerCase().includes('material'));
  const herramientas = cats.find((c) => c.name.toLowerCase().includes('herramient'));
  if (hint.includes('herramient') && herramientas) return String(herramientas.id);
  return String(materiales?.id ?? cats[0]!.id);
}

function esCategoriaHerramientas(nombreCat: string | null, categoryName: string): boolean {
  const n = `${nombreCat ?? ''} ${categoryName}`.toLowerCase();
  return n.includes('herramient');
}

/** Migra filas de `products` a `global_inventory` clasificadas por obra. */
export async function migrarProductosAObra(
  supabase: SupabaseClient,
  input: MigrarProductosAObraInput,
): Promise<MigrarProductosAObraResult> {
  const productIds = Array.from(new Set(input.productIds.filter((id) => Number.isFinite(id) && id > 0)));
  const result: MigrarProductosAObraResult = {
    creados: 0,
    omitidos: 0,
    errores: [],
    materialIds: [],
  };

  if (!input.proyectoId.trim() || !productIds.length) return result;

  const { data: proyecto, error: pErr } = await supabase
    .from('ci_proyectos')
    .select('id, nombre, entidad_id')
    .eq('id', input.proyectoId)
    .maybeSingle();

  if (pErr) throw new Error(pErr.message);
  if (!proyecto) throw new Error('Proyecto no encontrado.');

  const { data: productos, error: prodErr } = await supabase
    .from('products')
    .select('id,nombre,categoria,marca,modelo,descripcion,costo,imagen,ubicacion')
    .in('id', productIds);

  if (prodErr) throw new Error(prodErr.message);

  const byId = new Map((productos ?? []).map((p) => [Number(p.id), p as ProductoCatalogoRow]));
  const omitirExistentes = input.omitirExistentes !== false;
  const stockInicial = Math.max(0, Number(input.stockInicial ?? 0));

  let existentesPorProducto = new Set<number>();
  if (omitirExistentes) {
    const { data: yaEnObra } = await supabase
      .from('global_inventory')
      .select('product_id')
      .eq('proyecto_id', input.proyectoId)
      .in('product_id', productIds);

    if (yaEnObra) {
      existentesPorProducto = new Set(
        yaEnObra.map((r) => Number(r.product_id)).filter((n) => Number.isFinite(n)),
      );
    }
  }

  const categoriaCache = new Map<string, string>();

  for (const pid of productIds) {
    const prod = byId.get(pid);
    if (!prod) {
      result.errores.push(`Producto #${pid} no encontrado.`);
      continue;
    }
    if (omitirExistentes && existentesPorProducto.has(pid)) {
      result.omitidos += 1;
      continue;
    }

    try {
      const catKey = (prod.categoria ?? '').trim().toLowerCase() || '__default__';
      let categoryId = categoriaCache.get(catKey);
      if (!categoryId) {
        categoryId = await resolverCategoriaId(supabase, prod.categoria);
        categoriaCache.set(catKey, categoryId);
      }

      const { data: catRow } = await supabase
        .from('material_categories')
        .select('name')
        .eq('id', categoryId)
        .maybeSingle();

      const herramientas = esCategoriaHerramientas(prod.categoria, String(catRow?.name ?? ''));
      const costo = Math.max(0, Number(prod.costo ?? 0));

      const payload: Record<string, unknown> = {
        name: prod.nombre.trim() || `Producto ${pid}`,
        category_id: categoryId,
        unit: 'UND',
        stock_available: 0,
        stock_quarantine: 0,
        reorder_point: 0,
        average_weighted_cost: costo,
        location: prod.ubicacion?.trim() || null,
        brand: prod.marca?.trim() || null,
        model: prod.modelo?.trim() || null,
        observations: prod.descripcion?.trim() || null,
        product_id: pid,
        entidad_id: proyecto.entidad_id ?? null,
        proyecto_id: input.proyectoId,
        presupuesto_partida_id: input.presupuestoPartidaId ?? null,
        status: herramientas ? 'OPERATIVO' : null,
      };

      const img = prod.imagen?.trim();
      if (img) payload.image_url = img;

      const { data: inserted, error: insErr } = await supabase
        .from('global_inventory')
        .insert(payload)
        .select('id')
        .single();

      if (insErr) {
        result.errores.push(`${prod.nombre}: ${insErr.message}`);
        continue;
      }

      const materialId = String(inserted.id);
      result.materialIds.push(materialId);
      result.creados += 1;

      const deltaStock =
        stockInicial > 0 ? stockInicial : herramientas ? 1 : 0;
      if (input.ubicacionId && deltaStock > 0) {
        const { error: rpcErr } = await supabase.rpc('inv_stock_apply_delta', {
          p_ubicacion_id: input.ubicacionId,
          p_material_id: materialId,
          p_delta_disponible: deltaStock,
          p_delta_reservada: 0,
          p_delta_transito_entrante: 0,
        });
        if (rpcErr && rpcErr.code !== '42883') {
          result.errores.push(
            `${prod.nombre}: material creado pero stock en ubicación falló (${rpcErr.message}).`,
          );
        }
      }
    } catch (e) {
      result.errores.push(
        `${prod.nombre}: ${e instanceof Error ? e.message : 'Error desconocido'}`,
      );
    }
  }

  return result;
}
