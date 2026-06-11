import type { SupabaseClient } from '@supabase/supabase-js';
import {
  matchProcurementMaterialId,
  type MaterialCatalogRow,
} from '@/lib/almacen/matchProcurementMaterial';
import { fetchDefaultDepositId } from '@/lib/almacen/formatInventoryLocation';
import {
  crearMaterialParaLineaCompra,
  resolverMaterialParaLineaCompra,
} from '@/lib/almacen/resolverMaterialParaCompra';
import { resolverEntidadIdCatalogo } from '@/lib/almacen/catalogoEntidad';
import type { LineaCompraContabilidadInput } from '@/lib/contabilidad/registerCompraDesdeRecepcion';

/** Normaliza códigos SAP / item_code para comparación (OCR suele omitir prefijos o espacios). */
export function normSkuCodigo(s: string): string {
  return s
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/^SAP-?/, '');
}

export async function cargarMapaSkuGlobalInventory(
  supabase: SupabaseClient,
  entidadId?: string | null,
): Promise<Map<string, string>> {
  let q = supabase.from('global_inventory').select('id, sap_code').not('sap_code', 'is', null);
  const eid = entidadId?.trim();
  if (eid) q = q.eq('entidad_id', eid);
  const { data, error } = await q.limit(8000);

  if (error) throw new Error(error.message);

  const map = new Map<string, string>();
  for (const row of data ?? []) {
    const sku = normSkuCodigo(String((row as { sap_code?: string }).sap_code ?? ''));
    const id = String((row as { id: string }).id);
    if (sku) map.set(sku, id);
  }
  return map;
}

export async function cargarCatalogoMaterialCompra(
  supabase: SupabaseClient,
  entidadId?: string | null,
): Promise<MaterialCatalogRow[]> {
  let q = supabase.from('global_inventory').select('id, name, sap_code').limit(5000);
  const eid = entidadId?.trim();
  if (eid) q = q.eq('entidad_id', eid);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as MaterialCatalogRow[];
}

async function resolverMaterialIdEnLinea(
  supabase: SupabaseClient,
  l: LineaCompraContabilidadInput,
  opts: {
    mapaSku: Map<string, string>;
    catalogo: MaterialCatalogRow[];
    proyectoId?: string;
    entidadId?: string | null;
  },
): Promise<{ linea: LineaCompraContabilidadInput; sinMatch?: string }> {
  if (l.material_id?.trim()) return { linea: l };

  const cod = normSkuCodigo(String(l.item_code ?? ''));
  if (cod) {
    const porMapa = opts.mapaSku.get(cod);
    if (porMapa) return { linea: { ...l, material_id: porMapa } };
  }

  const desc = l.descripcion?.trim() ?? '';
  if (desc.length >= 3) {
    const porNombre = await resolverMaterialParaLineaCompra(supabase, {
      item_code: l.item_code ?? undefined,
      description: desc,
      proyectoId: opts.proyectoId,
      entidadId: opts.entidadId,
    });
    if (porNombre) {
      return { linea: { ...l, material_id: porNombre.id } };
    }

    const porFuzzy = matchProcurementMaterialId(desc, opts.catalogo);
    if (porFuzzy) return { linea: { ...l, material_id: porFuzzy } };
  }

  const etiqueta = cod || desc || 'Línea sin identificar';
  return { linea: l, sinMatch: etiqueta };
}

/** SKU + nombre exacto + coincidencia aproximada por descripción (como recepción de mercancía). */
export async function enriquecerLineasConMaterial(
  supabase: SupabaseClient,
  lineas: LineaCompraContabilidadInput[],
  opts?: { proyectoId?: string; entidadId?: string | null },
): Promise<{ lineas: LineaCompraContabilidadInput[]; sinMatch: string[] }> {
  const entidadId = await resolverEntidadIdCatalogo(supabase, {
    entidadId: opts?.entidadId,
    proyectoId: opts?.proyectoId,
  });
  const [mapa, catalogo] = await Promise.all([
    cargarMapaSkuGlobalInventory(supabase, entidadId),
    cargarCatalogoMaterialCompra(supabase, entidadId),
  ]);
  const sinMatch: string[] = [];
  const out: LineaCompraContabilidadInput[] = [];

  for (const l of lineas) {
    const r = await resolverMaterialIdEnLinea(supabase, l, {
      mapaSku: mapa,
      catalogo,
      proyectoId: opts?.proyectoId,
      entidadId,
    });
    out.push(r.linea);
    if (r.sinMatch) sinMatch.push(r.sinMatch);
  }

  return { lineas: out, sinMatch };
}

/** @deprecated Use enriquecerLineasConMaterial */
export async function enriquecerLineasConMaterialPorSku(
  supabase: SupabaseClient,
  lineas: LineaCompraContabilidadInput[],
  opts?: { proyectoId?: string },
): Promise<{ lineas: LineaCompraContabilidadInput[]; sinMatch: string[] }> {
  return enriquecerLineasConMaterial(supabase, lineas, opts);
}

type LineaCompraDb = {
  id: string;
  material_id: string | null;
  item_code: string | null;
  descripcion: string | null;
  cantidad: number | null;
  precio_unitario: number | null;
};

export type ResolverMaterialCompraOpts = {
  proyectoIdFallback?: string | null;
  ubicacionDestinoId?: string | null;
  purchaseInvoiceId?: string | null;
  /** Líneas OCR / Telegram si contabilidad_compra_lineas está vacía. */
  lineasExtracted?: LineaCompraContabilidadInput[];
};

/** Proyecto para catálogo: compra → ubicación → purchase_invoice → pendiente canal. */
export async function resolverProyectoIdParaCompra(
  supabase: SupabaseClient,
  opts: {
    proyectoIdCompra?: string | null;
    proyectoIdFallback?: string | null;
    ubicacionDestinoId?: string | null;
    purchaseInvoiceId?: string | null;
  },
): Promise<string> {
  const directo =
    String(opts.proyectoIdCompra ?? '').trim() ||
    String(opts.proyectoIdFallback ?? '').trim();
  if (directo) return directo;

  const ubi = String(opts.ubicacionDestinoId ?? '').trim();
  if (ubi) {
    const { data: ub } = await supabase
      .from('inv_ubicaciones')
      .select('ci_proyecto_id')
      .eq('id', ubi)
      .maybeSingle();
    const pid = String(ub?.ci_proyecto_id ?? '').trim();
    if (pid) return pid;
  }

  const pi = String(opts.purchaseInvoiceId ?? '').trim();
  if (pi) {
    const { data: inv } = await supabase
      .from('purchase_invoices')
      .select('proyecto_id')
      .eq('id', pi)
      .maybeSingle();
    const pid = String(inv?.proyecto_id ?? '').trim();
    if (pid) return pid;
  }

  return '';
}

async function insertarLineasCompraSiVacias(
  supabase: SupabaseClient,
  compraId: string,
  lineas: LineaCompraContabilidadInput[],
): Promise<LineaCompraDb[]> {
  const { count, error: cErr } = await supabase
    .from('contabilidad_compra_lineas')
    .select('id', { count: 'exact', head: true })
    .eq('compra_id', compraId);

  if (cErr) throw new Error(cErr.message);
  if ((count ?? 0) > 0 || !lineas.length) {
    const { data: raw } = await supabase
      .from('contabilidad_compra_lineas')
      .select('id,material_id,item_code,descripcion,cantidad,precio_unitario')
      .eq('compra_id', compraId);
    return (raw ?? []) as LineaCompraDb[];
  }

  const lineRows = lineas
    .filter((l) => String(l.descripcion ?? '').trim())
    .map((l) => {
      const cantidad = Number(l.cantidad) > 0 ? Number(l.cantidad) : 1;
      const precio = Number(l.precio_unitario) >= 0 ? Number(l.precio_unitario) : 0;
      return {
        compra_id: compraId,
        material_id: l.material_id?.trim() || null,
        descripcion: String(l.descripcion).trim(),
        item_code: l.item_code?.trim() || null,
        unidad: (l.unidad || 'UND').trim() || 'UND',
        cantidad,
        precio_unitario: precio,
        subtotal: cantidad * precio,
      };
    });

  if (!lineRows.length) return [];

  const { error: insErr } = await supabase.from('contabilidad_compra_lineas').insert(lineRows);
  if (insErr) throw new Error(insErr.message);

  const { data: raw, error } = await supabase
    .from('contabilidad_compra_lineas')
    .select('id,material_id,item_code,descripcion,cantidad,precio_unitario')
    .eq('compra_id', compraId);

  if (error) throw new Error(error.message);
  return (raw ?? []) as LineaCompraDb[];
}

/**
 * Rellena material_id en contabilidad_compra_lineas por item_code (facturas Telegram ya confirmadas).
 * Crea materiales faltantes en catálogo cuando hay proyecto/ubicación (no bloquea el ingreso).
 */
export async function resolverMaterialIdLineasCompra(
  supabase: SupabaseClient,
  compraId: string,
  opts?: ResolverMaterialCompraOpts,
): Promise<{
  total: number;
  vinculadas: number;
  sinMatch: string[];
  materialesCreados: number;
  lineas: Array<{
    material_id: string;
    descripcion: string;
    cantidad: number;
    precio_unitario: number;
  }>;
}> {
  let lineas = await insertarLineasCompraSiVacias(
    supabase,
    compraId,
    opts?.lineasExtracted ?? [],
  );

  const { data: compraRow } = await supabase
    .from('contabilidad_compras')
    .select('proyecto_id, fecha, ubicacion_destino_id, purchase_invoice_id')
    .eq('id', compraId)
    .maybeSingle();
  const compraMeta = compraRow as {
    proyecto_id?: string;
    fecha?: string;
    ubicacion_destino_id?: string | null;
    purchase_invoice_id?: string | null;
  } | null;

  const ubicacionDestino =
    String(compraMeta?.ubicacion_destino_id ?? opts?.ubicacionDestinoId ?? '').trim() || null;

  const proyectoId = await resolverProyectoIdParaCompra(supabase, {
    proyectoIdCompra: compraMeta?.proyecto_id,
    proyectoIdFallback: opts?.proyectoIdFallback,
    ubicacionDestinoId: ubicacionDestino,
    purchaseInvoiceId:
      compraMeta?.purchase_invoice_id ?? opts?.purchaseInvoiceId ?? null,
  });

  if (proyectoId && !String(compraMeta?.proyecto_id ?? '').trim()) {
    await supabase
      .from('contabilidad_compras')
      .update({ proyecto_id: proyectoId })
      .eq('id', compraId);
  }

  const fecha =
    (compraMeta?.fecha ?? '').slice(0, 10) || new Date().toISOString().slice(0, 10);

  const inputs: LineaCompraContabilidadInput[] = lineas.map((l) => ({
    material_id: l.material_id,
    descripcion: String(l.descripcion ?? '').trim() || 'Ítem',
    item_code: l.item_code,
    unidad: 'UND',
    cantidad: Number(l.cantidad ?? 0),
    precio_unitario: Number(l.precio_unitario ?? 0),
  }));

  let enriquecidas: LineaCompraContabilidadInput[];
  let sinMatch: string[];
  let materialesCreados = 0;

  if (proyectoId) {
    const r = await asegurarMaterialesLineasCompra(supabase, inputs, {
      proyectoId,
      fecha,
      ubicacionDestinoId: ubicacionDestino,
    });
    enriquecidas = r.lineas;
    sinMatch = r.sinMatch;
    materialesCreados = r.creados;
  } else {
    const r = await enriquecerLineasConMaterial(supabase, inputs);
    enriquecidas = r.lineas;
    sinMatch = r.sinMatch;
  }

  let vinculadas = 0;

  const paraInventario: Array<{
    material_id: string;
    descripcion: string;
    cantidad: number;
    precio_unitario: number;
  }> = [];

  for (let i = 0; i < lineas.length; i++) {
    const l = lineas[i];
    const enr = enriquecidas[i];
    const matId = enr?.material_id?.trim() ?? l.material_id?.trim() ?? '';
    if (matId && matId !== (l.material_id?.trim() ?? '')) {
      await supabase
        .from('contabilidad_compra_lineas')
        .update({ material_id: matId })
        .eq('id', l.id);
    }
    if (matId) {
      vinculadas += 1;
      const cantidad = Number(l.cantidad ?? enr?.cantidad ?? 0);
      if (cantidad > 0) {
        paraInventario.push({
          material_id: matId,
          descripcion: String(l.descripcion ?? enr?.descripcion ?? '').trim() || 'Ítem',
          cantidad,
          precio_unitario: Number(l.precio_unitario ?? enr?.precio_unitario ?? 0),
        });
      }
    }
  }

  return {
    total: lineas.length,
    vinculadas,
    sinMatch,
    materialesCreados,
    lineas: paraInventario,
  };
}

/**
 * Resuelve material_id por SKU/nombre y crea ítems faltantes (paridad con recepción de mercancía).
 */
export async function asegurarMaterialesLineasCompra(
  supabase: SupabaseClient,
  lineas: LineaCompraContabilidadInput[],
  opts: {
    proyectoId: string;
    fecha: string;
    ubicacionDestinoId?: string | null;
  },
): Promise<{ lineas: LineaCompraContabilidadInput[]; sinMatch: string[]; creados: number }> {
  let depositId: string | null = null;
  const ubId = opts.ubicacionDestinoId?.trim();
  if (ubId) {
    const { data: ub } = await supabase
      .from('inv_ubicaciones')
      .select('deposit_id')
      .eq('id', ubId)
      .maybeSingle();
    if (ub?.deposit_id) depositId = String(ub.deposit_id);
  }
  if (!depositId) {
    depositId = await fetchDefaultDepositId(supabase);
  }

  const { lineas: enriquecidas, sinMatch: prevSinMatch } = await enriquecerLineasConMaterial(
    supabase,
    lineas,
    { proyectoId: opts.proyectoId },
  );

  const sinMatch: string[] = [];
  let creados = 0;
  const out: LineaCompraContabilidadInput[] = [];

  for (const l of enriquecidas) {
    if (l.material_id?.trim()) {
      out.push(l);
      continue;
    }
    const desc = l.descripcion?.trim() ?? '';
    if (desc.length < 2) {
      sinMatch.push('Línea sin descripción');
      out.push(l);
      continue;
    }
    try {
      const materialId = await crearMaterialParaLineaCompra(supabase, {
        descripcion: desc,
        item_code: l.item_code,
        unidad: l.unidad,
        precio_unitario: l.precio_unitario,
        fecha: opts.fecha,
        proyectoId: opts.proyectoId,
        depositId,
      });
      creados += 1;
      out.push({ ...l, material_id: materialId });
    } catch {
      sinMatch.push(l.item_code?.trim() || desc);
      out.push(l);
    }
  }

  const hayMaterial = out.some((l) => l.material_id?.trim());
  if (!hayMaterial) {
    for (const s of prevSinMatch) {
      if (!sinMatch.includes(s)) sinMatch.push(s);
    }
  }

  return { lineas: out, sinMatch, creados };
}

export function mensajeLineasSinMaterialSku(sinMatch: string[]): string {
  if (!sinMatch.length) return '';
  const muestra = sinMatch.slice(0, 5).join(', ');
  const extra = sinMatch.length > 5 ? ` (+${sinMatch.length - 5})` : '';
  return `Sin material en catálogo para SKU/descripción: ${muestra}${extra}. Revise item_code en la factura o cree el material en Almacén.`;
}
