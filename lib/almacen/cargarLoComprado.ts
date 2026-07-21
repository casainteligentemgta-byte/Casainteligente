import type { SupabaseClient } from '@supabase/supabase-js';
import {
  claveAgrupacionLoComprado,
  elegirDescripcionCanonica,
} from '@/lib/almacen/claveAgrupacionLoComprado';
import { normalizarTextoMaterial } from '@/lib/almacen/normalizarTextoMaterial';
import {
  esCompraSoloAuditoriaCco,
  esDescripcionAuditoriaCco,
} from '@/lib/contabilidad/compraEsAuditoriaCco';

export type LoCompradoFiltros = {
  proyectoId?: string | null;
  entidadId?: string | null;
  desde?: string | null;
  hasta?: string | null;
  q?: string | null;
};

export type FilaLoComprado = {
  clave: string;
  material_id: string | null;
  descripcion: string;
  item_code: string | null;
  unidad: string;
  cantidad_comprada: number;
  lineas_count: number;
  compras_count: number;
  proyecto_id: string | null;
  proyecto_nombre: string | null;
  entidad_id: string | null;
  entidad_nombre: string | null;
  descripciones_variantes: string[];
};

export type ResumenLoComprado = {
  ok: true;
  filas: FilaLoComprado[];
  total_articulos: number;
  total_lineas: number;
  total_compras: number;
  compras_escaneadas: number;
  compras_omitidas_auditoria: number;
};

type LineaRow = {
  id?: string;
  descripcion?: string | null;
  item_code?: string | null;
  unidad?: string | null;
  cantidad?: number | string | null;
  material_id?: string | null;
};

type CompraRow = {
  id: string;
  fecha?: string | null;
  created_at?: string | null;
  invoice_number?: string | null;
  supplier_name?: string | null;
  supplier_rif?: string | null;
  origen?: string | null;
  notas?: string | null;
  proyecto_id?: string | null;
  entidad_id?: string | null;
  monto_usd?: number | null;
  total_amount?: number | null;
  ci_proyectos?: { nombre?: string | null } | { nombre?: string | null }[] | null;
  contabilidad_compra_lineas?: LineaRow[] | null;
};

type Accumulador = {
  clave: string;
  material_id: string | null;
  item_code: string | null;
  unidad: string;
  cantidad_comprada: number;
  lineas_count: number;
  compraIds: Set<string>;
  proyecto_id: string | null;
  proyecto_nombre: string | null;
  entidad_id: string | null;
  variantes: Map<string, number>;
};

const PAGE_SIZE = 400;
const MAX_COMPRAS = 8000;

function proyectoNombre(row: CompraRow): string | null {
  const p = row.ci_proyectos;
  if (Array.isArray(p)) return p[0]?.nombre?.trim() || null;
  return p?.nombre?.trim() || null;
}

function parseCantidad(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : Number(String(raw ?? '').replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n;
}

function coincideBusqueda(qNorm: string, descripcion: string, itemCode: string | null): boolean {
  if (!qNorm) return true;
  const d = normalizarTextoMaterial(descripcion);
  const c = normalizarTextoMaterial(itemCode ?? '');
  return d.includes(qNorm) || c.includes(qNorm);
}

/**
 * Agrega cantidades compradas desde contabilidad_compra_lineas.
 * Solo lectura: no escribe stock ni toca CCO.
 */
export async function cargarLoComprado(
  supabase: SupabaseClient,
  filtros: LoCompradoFiltros = {},
): Promise<ResumenLoComprado> {
  const proyectoId = filtros.proyectoId?.trim() || null;
  const entidadId = filtros.entidadId?.trim() || null;
  const desde = filtros.desde?.trim().slice(0, 10) || null;
  const hasta = filtros.hasta?.trim().slice(0, 10) || null;
  const qNorm = normalizarTextoMaterial(filtros.q ?? '');

  const selectBase =
    'id,fecha,created_at,invoice_number,supplier_name,supplier_rif,origen,notas,proyecto_id,entidad_id,monto_usd,total_amount,ci_proyectos(nombre),contabilidad_compra_lineas(id,descripcion,item_code,unidad,cantidad,material_id)';

  const filasBrutas: CompraRow[] = [];
  let offset = 0;
  let omitidasAuditoria = 0;

  while (offset < MAX_COMPRAS) {
    let q = supabase
      .from('contabilidad_compras')
      .select(selectBase)
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (proyectoId) q = q.eq('proyecto_id', proyectoId);
    if (entidadId) q = q.eq('entidad_id', entidadId);
    if (desde) q = q.gte('fecha', desde);
    if (hasta) q = q.lte('fecha', hasta);

    const { data, error } = await q;
    if (error) {
      throw new Error(error.message);
    }

    const batch = (data ?? []) as unknown as CompraRow[];
    filasBrutas.push(...batch);
    if (batch.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  const acc = new Map<string, Accumulador>();
  let totalLineas = 0;

  for (const compra of filasBrutas) {
    const lineas = Array.isArray(compra.contabilidad_compra_lineas)
      ? compra.contabilidad_compra_lineas
      : [];

    if (
      esCompraSoloAuditoriaCco({
        supplier_name: compra.supplier_name,
        supplier_rif: compra.supplier_rif,
        notas: compra.notas,
        invoice_number: compra.invoice_number,
        origen: compra.origen,
        monto_usd: compra.monto_usd,
        total_amount: compra.total_amount,
        lineas: lineas.map((l) => ({ descripcion: l.descripcion })),
      })
    ) {
      omitidasAuditoria += 1;
      continue;
    }

    const obraNombre = proyectoNombre(compra);
    const proyId = compra.proyecto_id?.trim() || null;
    const entId = compra.entidad_id?.trim() || null;

    for (const linea of lineas) {
      const descripcion = String(linea.descripcion ?? '').trim();
      if (!descripcion) continue;
      if (esDescripcionAuditoriaCco(descripcion)) continue;

      const cantidad = parseCantidad(linea.cantidad);
      if (cantidad <= 0) continue;

      if (!coincideBusqueda(qNorm, descripcion, linea.item_code ?? null)) continue;

      const clave = claveAgrupacionLoComprado({
        materialId: linea.material_id,
        descripcion,
        proyectoId: proyId,
      });
      if (!clave) continue;

      totalLineas += 1;
      let row = acc.get(clave);
      if (!row) {
        row = {
          clave,
          material_id: linea.material_id?.trim() || null,
          item_code: linea.item_code?.trim() || null,
          unidad: String(linea.unidad ?? 'UND').trim() || 'UND',
          cantidad_comprada: 0,
          lineas_count: 0,
          compraIds: new Set(),
          proyecto_id: proyId,
          proyecto_nombre: obraNombre,
          entidad_id: entId,
          variantes: new Map(),
        };
        acc.set(clave, row);
      }

      row.cantidad_comprada += cantidad;
      row.lineas_count += 1;
      row.compraIds.add(compra.id);
      if (!row.material_id && linea.material_id) {
        row.material_id = linea.material_id.trim();
      }
      if (!row.item_code && linea.item_code) {
        row.item_code = linea.item_code.trim();
      }
      if (!row.proyecto_nombre && obraNombre) {
        row.proyecto_nombre = obraNombre;
      }
      row.variantes.set(descripcion, (row.variantes.get(descripcion) ?? 0) + 1);
    }
  }

  const entidadIds = Array.from(
    new Set(
      Array.from(acc.values())
        .map((r) => r.entidad_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );

  const entidadesMap = new Map<string, string>();
  if (entidadIds.length) {
    const { data: ents } = await supabase
      .from('ci_entidades')
      .select('id,nombre')
      .in('id', entidadIds);
    for (const e of ents ?? []) {
      entidadesMap.set(String(e.id), String(e.nombre ?? '').trim());
    }
  }

  const filas: FilaLoComprado[] = Array.from(acc.values())
    .map((r) => {
      const descripcion = elegirDescripcionCanonica(r.variantes, 'Sin descripción');
      const variantes = Array.from(r.variantes.keys())
        .map((t) => t.trim())
        .filter((t) => t && normalizarTextoMaterial(t) !== normalizarTextoMaterial(descripcion))
        .slice(0, 6);
      return {
        clave: r.clave,
        material_id: r.material_id,
        descripcion,
        item_code: r.item_code,
        unidad: r.unidad,
        cantidad_comprada: Math.round(r.cantidad_comprada * 100) / 100,
        lineas_count: r.lineas_count,
        compras_count: r.compraIds.size,
        proyecto_id: r.proyecto_id,
        proyecto_nombre: r.proyecto_nombre,
        entidad_id: r.entidad_id,
        entidad_nombre: r.entidad_id ? entidadesMap.get(r.entidad_id) ?? null : null,
        descripciones_variantes: variantes,
      };
    })
    .sort((a, b) => {
      const oa = (a.proyecto_nombre ?? '').localeCompare(b.proyecto_nombre ?? '', 'es');
      if (oa !== 0) return oa;
      return b.cantidad_comprada - a.cantidad_comprada;
    });

  return {
    ok: true,
    filas,
    total_articulos: filas.length,
    total_lineas: totalLineas,
    total_compras: filasBrutas.length - omitidasAuditoria,
    compras_escaneadas: filasBrutas.length,
    compras_omitidas_auditoria: omitidasAuditoria,
  };
}
