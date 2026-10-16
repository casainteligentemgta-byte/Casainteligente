import type { SupabaseClient } from '@supabase/supabase-js';
import {
  crearCuarentenaDesdeFactura,
  type LineaCuarentenaInput,
} from '@/lib/almacen/crearCuarentenaDesdeFactura';
import { notificarCuarentenaParaInvoice } from '@/lib/almacen/notificarCuarentenaParaInvoice';
import { resolverMaterialIdLineasCompra } from '@/lib/almacen/resolverMaterialIdPorSku';

/**
 * Después de registrar una factura de compra, deja la mercancía «en camino» al almacén:
 *
 *   1. cuarentena (quality_inspections + stock en tránsito) por cada línea con material
 *   2. aviso al depositario de que hay mercancía por verificar
 *   3. retiro pendiente (ci_compras_retiros) y aviso a Logística / comprador
 *
 * Todos los caminos de carga de factura deben pasar por aquí; antes sólo el canal de
 * Telegram lo hacía y las facturas cargadas desde /compras/procuras quedaban sin
 * cuarentena ni retiro (el material nunca llegaba al stock).
 *
 * Nunca lanza: un fallo aquí no debe tumbar el registro de la compra.
 */
export type EncaminarMercanciaInput = {
  purchaseInvoiceId: string;
  contabilidadCompraId: string;
  procuraId?: string | null;
  proyectoId?: string | null;
  ubicacionDestinoId?: string | null;
  numeroFactura?: string | null;
  proveedorNombre?: string | null;
  solicitadoPorChatId?: string | number | null;
  /** Si se omiten, se leen (y resuelven contra el catálogo) desde contabilidad_compra_lineas. */
  lineas?: LineaCuarentenaInput[];
};

export type EncaminarMercanciaResult = {
  lineasCuarentena: number;
  cuarentenaYaExistia: boolean;
  sinMaterial: string[];
  notificado: boolean;
  retiro: 'creado' | 'ya_existia' | 'no_aplica' | 'error';
  error?: string;
};

export async function encaminarMercanciaFactura(
  supabase: SupabaseClient,
  input: EncaminarMercanciaInput,
): Promise<EncaminarMercanciaResult> {
  const out: EncaminarMercanciaResult = {
    lineasCuarentena: 0,
    cuarentenaYaExistia: false,
    sinMaterial: [],
    notificado: false,
    retiro: 'no_aplica',
  };

  try {
    let lineas = input.lineas;
    if (!lineas) {
      const resuelto = await resolverMaterialIdLineasCompra(supabase, input.contabilidadCompraId, {
        proyectoIdFallback: input.proyectoId ?? undefined,
        ubicacionDestinoId: input.ubicacionDestinoId ?? undefined,
        purchaseInvoiceId: input.purchaseInvoiceId,
      });
      out.sinMaterial = resuelto.sinMatch;
      lineas = resuelto.lineas.map((l) => ({
        material_id: l.material_id,
        descripcion: l.descripcion,
        cantidad: l.cantidad,
        precio_unitario: l.precio_unitario,
      }));
    }

    const cuarentena = await crearCuarentenaDesdeFactura(supabase, {
      purchaseInvoiceId: input.purchaseInvoiceId,
      ubicacionDestinoId: input.ubicacionDestinoId,
      lineas,
    });
    out.lineasCuarentena = cuarentena.lineasCreadas;
    out.cuarentenaYaExistia = cuarentena.yaExistia;

    if (cuarentena.lineasCreadas > 0 || cuarentena.yaExistia) {
      const notify = await notificarCuarentenaParaInvoice(supabase, input.purchaseInvoiceId);
      out.notificado = Boolean(notify.ok && !notify.skipped);
    }

    // Hay mercancía por recibir (nueva o aún en cuarentena): que alguien la retire.
    if (cuarentena.lineasCreadas > 0 || cuarentena.yaExistia) {
      const { avisarRetiroCompraPendiente } = await import('@/lib/telegram/retiroCompraTelegram');
      const aviso = await avisarRetiroCompraPendiente(supabase, {
        purchaseInvoiceId: input.purchaseInvoiceId,
        contabilidadCompraId: input.contabilidadCompraId,
        procuraId: input.procuraId ?? null,
        proyectoId: input.proyectoId ?? null,
        ubicacionDestinoId: input.ubicacionDestinoId ?? null,
        numeroFactura: input.numeroFactura ?? null,
        proveedorNombre: input.proveedorNombre ?? null,
        solicitadoPorChatId: input.solicitadoPorChatId ?? null,
      });
      out.retiro = aviso.ok
        ? aviso.motivo === 'ya_existia'
          ? 'ya_existia'
          : 'creado'
        : aviso.motivo === 'sin_migracion'
          ? 'no_aplica'
          : 'error';
    }
  } catch (e) {
    out.error = e instanceof Error ? e.message : String(e);
    console.warn('[encaminarMercanciaFactura]', input.purchaseInvoiceId, out.error);
  }

  // Control: ¿la factura cobra más de lo pedido o trae algo que nadie pidió?
  try {
    const { revisarControlCompra } = await import('@/lib/compras/controlCompra');
    await revisarControlCompra(supabase, input.purchaseInvoiceId);
  } catch (e) {
    console.warn('[encaminarMercanciaFactura] control', e);
  }

  return out;
}
