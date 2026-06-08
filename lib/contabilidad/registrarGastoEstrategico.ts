import type { SupabaseClient } from '@supabase/supabase-js';
import { aplicarDeltaStockInventario } from '@/lib/almacen/aplicarDeltaStockInventario';
import {
  asegurarCategoriasCompraSugeridas,
  type MaterialCategoryRow,
} from '@/lib/almacen/categoriasMaterialCompra';
import { esGastoInmediatoCompra } from '@/lib/almacen/esGastoInmediatoCompra';
import {
  actualizarMaterialExistenteCompra,
  crearMaterialParaLineaCompra,
  resolverMaterialParaLineaCompra,
} from '@/lib/almacen/resolverMaterialParaCompra';
import { buscarCompraContablePorFactura } from '@/lib/contabilidad/buscarCompraContablePorFactura';
import {
  payloadCompraBimonetario,
  resolverMontosCompraBimonetario,
} from '@/lib/contabilidad/comprasBimonetario';
import { resolverEntidadIdDesdeProyecto } from '@/lib/contabilidad/resolverEntidadProyecto';

export type LineaGastoEstrategico = {
  articulo: string;
  cantidad: number;
  monto_usd: number;
  monto_bs: number;
  /** Literal exacto: p. ej. `Consumibles / Logística de Campo`, `Materiales`, `Servicios`. */
  categoria: string;
  es_servicio?: boolean;
  item_code?: string | null;
  unidad?: string;
  /** Si ya existe el SKU en global_inventory. */
  material_id?: string | null;
};

export type DatosGastoEstrategico = {
  proyecto_id: string;
  ubicacion_id: string;
  proveedor_nombre: string;
  proveedor_rif?: string;
  nro_factura: string;
  fecha?: string;
  moneda?: 'VES' | 'USD';
  tasa_bcv_ves_por_usd?: number | null;
  lineas: LineaGastoEstrategico[];
  /** Por defecto TELEGRAM_GASTO_ESTRATEGICO */
  origen?: string;
  notas?: string;
};

export type LineaGastoEstrategicoResultado = {
  lineaId: string;
  materialId: string;
  gastoInmediato: boolean;
  stockAplicado: boolean;
};

export type ResultadoGastoEstrategico =
  | { success: true; compraId: string; yaExistia: boolean; lineas: LineaGastoEstrategicoResultado[] }
  | { success: false; error: string };

function resolverCategoryId(
  categorias: MaterialCategoryRow[],
  nombre: string,
): string | null {
  const n = nombre.trim().toLowerCase();
  if (!n) return null;
  const hit = categorias.find((c) => c.name.trim().toLowerCase() === n);
  return hit?.id ?? null;
}

function precioUnitarioLinea(linea: LineaGastoEstrategico): number {
  const qty = Number(linea.cantidad);
  if (!Number.isFinite(qty) || qty <= 0) return 0;
  const bs = Number(linea.monto_bs);
  if (Number.isFinite(bs) && bs > 0) return bs / qty;
  const usd = Number(linea.monto_usd);
  if (Number.isFinite(usd) && usd > 0) return usd / qty;
  return 0;
}

function subtotalLineaBs(linea: LineaGastoEstrategico): number {
  const bs = Number(linea.monto_bs);
  if (Number.isFinite(bs) && bs > 0) return bs;
  return 0;
}

/**
 * Registra gasto estratégico (Telegram / oficina / OpEx de obra):
 * - Siempre en contabilidad_compras + contabilidad_compra_lineas.
 * - Consumibles / Servicios: sin stock (gasto inmediato).
 * - Materiales: delta positivo en inventario_stock vía inv_stock_apply_delta.
 */
export async function registrarGastoEstrategico(
  supabase: SupabaseClient,
  datos: DatosGastoEstrategico,
): Promise<ResultadoGastoEstrategico> {
  try {
    const proyectoId = datos.proyecto_id.trim();
    const ubicacionId = datos.ubicacion_id.trim();
    const invoiceNumber = datos.nro_factura.trim() || 'S/N';
    const supplierName = datos.proveedor_nombre.trim() || 'Proveedor';
    const supplierRif = (datos.proveedor_rif ?? 'S/R').trim() || 'S/R';
    const fecha = (datos.fecha ?? new Date().toISOString()).slice(0, 10);

    if (!proyectoId) {
      return { success: false, error: 'proyecto_id es obligatorio.' };
    }
    if (!ubicacionId) {
      return { success: false, error: 'ubicacion_id es obligatorio.' };
    }
    if (!datos.lineas.length) {
      return { success: false, error: 'Debe indicar al menos una línea.' };
    }

    const duplicada = await buscarCompraContablePorFactura(supabase, {
      invoice_number: invoiceNumber,
      supplier_rif: supplierRif,
      supplier_name: supplierName,
      proyecto_id: proyectoId,
    });
    if (duplicada?.id) {
      return {
        success: true,
        compraId: duplicada.id,
        yaExistia: true,
        lineas: [],
      };
    }

    const totalBs = datos.lineas.reduce((s, l) => s + subtotalLineaBs(l), 0);
    const montos = await resolverMontosCompraBimonetario({
      montoTotal: totalBs > 0 ? totalBs : datos.lineas.reduce((s, l) => s + Number(l.monto_usd ?? 0), 0),
      moneda: totalBs > 0 ? 'VES' : datos.moneda ?? 'USD',
      fecha,
      tasaBcvDigitada: datos.tasa_bcv_ves_por_usd,
    });

    const entidadId = await resolverEntidadIdDesdeProyecto(supabase, proyectoId);
    const categorias = await asegurarCategoriasCompraSugeridas(supabase);

    const { data: ubicacion } = await supabase
      .from('inv_ubicaciones')
      .select('deposit_id')
      .eq('id', ubicacionId)
      .maybeSingle();
    const depositId = ubicacion?.deposit_id ? String(ubicacion.deposit_id) : null;

    const { data: compra, error: errorCompra } = await supabase
      .from('contabilidad_compras')
      .insert({
        invoice_number: invoiceNumber,
        supplier_rif: supplierRif,
        supplier_name: supplierName,
        fecha,
        ...payloadCompraBimonetario(montos),
        origen: (datos.origen ?? 'TELEGRAM_GASTO_ESTRATEGICO').trim(),
        estado: 'REGISTRADA',
        proyecto_id: proyectoId,
        ubicacion_destino_id: ubicacionId,
        ...(entidadId ? { entidad_id: entidadId } : {}),
        notas:
          datos.notas?.trim() ||
          'Gasto estratégico: contabilidad + stock selectivo (consumibles/servicios sin inventario).',
      })
      .select('id')
      .single();

    if (errorCompra || !compra?.id) {
      return {
        success: false,
        error: errorCompra?.message ?? 'No se pudo crear contabilidad_compras.',
      };
    }

    const compraId = String(compra.id);
    const resultados: LineaGastoEstrategicoResultado[] = [];

    for (const linea of datos.lineas) {
      const desc = linea.articulo.trim();
      const cantidad = Number(linea.cantidad);
      if (!desc || !Number.isFinite(cantidad) || cantidad <= 0) {
        return { success: false, error: `Línea inválida: «${linea.articulo}».` };
      }

      const gastoInmediato = esGastoInmediatoCompra(
        { categoria: linea.categoria, es_servicio: linea.es_servicio },
        categorias,
      );

      const categoryId = resolverCategoryId(categorias, linea.categoria);
      const precioUnitario = precioUnitarioLinea(linea);
      const subtotal = subtotalLineaBs(linea) || cantidad * precioUnitario;

      let materialId = linea.material_id?.trim() || '';
      if (!materialId) {
        const resuelto = await resolverMaterialParaLineaCompra(supabase, {
          item_code: linea.item_code ?? undefined,
          description: desc,
          proyectoId,
        });
        if (resuelto) {
          materialId = resuelto.id;
          await actualizarMaterialExistenteCompra(supabase, materialId, {
            unitPrice: precioUnitario,
            purchaseDate: fecha,
            proyectoId,
            depositId,
            sapCode: linea.item_code?.trim() || undefined,
            categoryId: categoryId ?? resuelto.category_id ?? undefined,
            entidadId: entidadId ?? undefined,
          });
        } else {
          materialId = await crearMaterialParaLineaCompra(supabase, {
            descripcion: desc,
            item_code: linea.item_code,
            unidad: linea.unidad,
            precio_unitario: precioUnitario,
            fecha,
            proyectoId,
            depositId,
            categoryId: categoryId ?? undefined,
            entidadId: entidadId ?? undefined,
          });
        }
      }

      const { data: lineaContable, error: errorLinea } = await supabase
        .from('contabilidad_compra_lineas')
        .insert({
          compra_id: compraId,
          material_id: materialId,
          descripcion: desc,
          item_code: linea.item_code?.trim() || null,
          unidad: (linea.unidad || 'UND').trim() || 'UND',
          cantidad,
          precio_unitario: precioUnitario,
          subtotal,
        })
        .select('id')
        .single();

      if (errorLinea || !lineaContable?.id) {
        return {
          success: false,
          error: errorLinea?.message ?? `No se pudo registrar línea «${desc}».`,
        };
      }

      let stockAplicado = false;
      if (!gastoInmediato) {
        await aplicarDeltaStockInventario(supabase, {
          ubicacionId,
          materialId,
          deltaDisponible: cantidad,
          tipoMovimiento: 'ingreso_compra',
          referenciaTipo: 'contabilidad_compra_linea',
          referenciaId: String(lineaContable.id),
          documentoId: compraId,
          notas: `Gasto estratégico — ingreso compra (${invoiceNumber})`,
        });
        stockAplicado = true;
      }

      resultados.push({
        lineaId: String(lineaContable.id),
        materialId,
        gastoInmediato,
        stockAplicado,
      });
    }

    return { success: true, compraId, yaExistia: false, lineas: resultados };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error en registro estratégico.';
    return { success: false, error: msg };
  }
}
