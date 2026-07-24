import type { SupabaseClient } from '@supabase/supabase-js';
import { completarTransferenciaInventario } from '@/lib/almacen/completarTransferenciaInventario';
import {
  crearTransferenciaInventario,
  type LineaTransferenciaDespachoInput,
} from '@/lib/almacen/crearTransferenciaInventario';
import type { ExtractedInvoiceItem } from '@/lib/almacen/extractPurchaseInvoiceGemini';
import { matchProcurementMaterialId } from '@/lib/almacen/matchProcurementMaterial';
import { asegurarUbicacionObra } from '@/lib/almacen/ubicacionesInventario';
import type { ImputacionPartidaInput } from '@/types/inventario-obra';

const JUSTIFICACION_EXCESO = 'Egreso depositario vía Telegram (/salida)';

export type LineaOcrSalida = {
  description: string;
  quantity: number;
  unit?: string;
  item_code?: string;
  material_id?: string | null;
  material_nombre?: string | null;
  match_ok?: boolean;
};

function normSku(s: string): string {
  return s.trim().toUpperCase();
}

async function cargarCatalogoMateriales(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('global_inventory')
    .select('id, name, sap_code')
    .limit(4000);

  if (error?.code === '42P01') return [];
  if (error) throw new Error(error.message);
  return (data ?? []).map((m) => ({
    id: String(m.id),
    name: m.name != null ? String(m.name) : null,
    sap_code: m.sap_code != null ? String(m.sap_code) : null,
  }));
}

/** Resuelve ítems OCR contra global_inventory. */
export async function matchearLineasOcrSalida(
  supabase: SupabaseClient,
  items: ExtractedInvoiceItem[],
): Promise<LineaOcrSalida[]> {
  const catalogo = await cargarCatalogoMateriales(supabase);
  const porSku = new Map<string, string>();
  for (const m of catalogo) {
    const sku = normSku(m.sap_code ?? '');
    if (sku) porSku.set(sku, m.id);
  }

  const agregadas = new Map<string, LineaOcrSalida>();

  for (const it of items) {
    const description = String(it.description ?? '').trim();
    const qty = Number(it.quantity);
    const quantity = Number.isFinite(qty) && qty > 0 ? qty : 1;
    const sku = normSku(String(it.item_code ?? ''));
    let materialId = sku ? (porSku.get(sku) ?? null) : null;
    if (!materialId && description) {
      materialId = matchProcurementMaterialId(description, catalogo);
    }

    const material = materialId ? catalogo.find((m) => m.id === materialId) : null;
    const key = materialId ?? (description.toLowerCase() || `item-${agregadas.size}`);

    const prev = agregadas.get(key);
    if (prev) {
      prev.quantity += quantity;
      continue;
    }

    agregadas.set(key, {
      description: description || sku || 'Material',
      quantity,
      unit: String(it.unit ?? 'UND').trim() || 'UND',
      item_code: sku || undefined,
      material_id: materialId,
      material_nombre: material?.name ?? null,
      match_ok: Boolean(materialId),
    });
  }

  return Array.from(agregadas.values());
}

export async function primeraPartidaCapitulo(
  supabase: SupabaseClient,
  capituloId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('partidas')
    .select('id')
    .eq('capitulo_id', capituloId.trim())
    .order('codigo')
    .limit(1)
    .maybeSingle();

  if (error?.code === '42P01') return null;
  if (error) throw new Error(error.message);
  return data?.id ? String(data.id) : null;
}

async function validarStockOrigen(
  supabase: SupabaseClient,
  origenUbicacionId: string,
  lineas: Array<{ material_id: string; cantidad: number; material_nombre?: string | null }>,
): Promise<{ ok: true } | { ok: false; mensaje: string }> {
  for (const ln of lineas) {
    const { data } = await supabase
      .from('inventario_stock')
      .select('cantidad_disponible')
      .eq('ubicacion_id', origenUbicacionId)
      .eq('material_id', ln.material_id)
      .maybeSingle();

    const disp = Number(data?.cantidad_disponible ?? 0);
    if (disp + 0.0001 < ln.cantidad) {
      const nombre = ln.material_nombre?.trim() || 'Material';
      return {
        ok: false,
        mensaje: `Stock insuficiente de «${nombre}»: hay ${disp}, se requieren ${ln.cantidad}.`,
      };
    }
  }
  return { ok: true };
}

export type ResultadoDespachoTelegramSalida =
  | { ok: true; transferenciaId: string; codigo: string; nLineas: number }
  | { ok: false; error: string };

/** Crea transferencia salida_obra y aplica stock (origen → obra). */
export async function ejecutarDespachoTelegramSalida(params: {
  supabase: SupabaseClient;
  proyectoId: string;
  nombreObra: string;
  capituloId: string;
  origenUbicacionId: string;
  lineasOcr: LineaOcrSalida[];
  observacion: string;
}): Promise<ResultadoDespachoTelegramSalida> {
  const lineasMatch = params.lineasOcr.filter((l) => l.material_id && l.match_ok);
  if (!lineasMatch.length) {
    return { ok: false, error: 'No hay materiales reconocidos en el inventario.' };
  }

  const partidaId = await primeraPartidaCapitulo(params.supabase, params.capituloId);
  if (!partidaId) {
    return {
      ok: false,
      error:
        'El capítulo no tiene partidas en presupuesto. Agregue partidas en control de obra para imputar el despacho.',
    };
  }

  const destinoUbicacionId = await asegurarUbicacionObra(
    params.supabase,
    params.proyectoId,
    params.nombreObra,
  );

  if (params.origenUbicacionId === destinoUbicacionId) {
    return { ok: false, error: 'El almacén origen no puede ser la misma ubicación de la obra.' };
  }

  const lineasTransferencia: LineaTransferenciaDespachoInput[] = lineasMatch.map((l) => {
    const imputaciones: ImputacionPartidaInput[] = [
      {
        partida_id: partidaId,
        cantidad_imputada: l.quantity,
        justificacion_exceso: JUSTIFICACION_EXCESO,
      },
    ];
    return {
      material_id: String(l.material_id),
      cantidad: l.quantity,
      imputaciones,
    };
  });

  const stockVal = await validarStockOrigen(
    params.supabase,
    params.origenUbicacionId,
    lineasMatch.map((l) => ({
      material_id: String(l.material_id),
      cantidad: l.quantity,
      material_nombre: l.material_nombre,
    })),
  );
  if (!stockVal.ok) {
    return { ok: false, error: stockVal.mensaje };
  }

  try {
    const { transferenciaId, codigo } = await crearTransferenciaInventario(params.supabase, {
      origen_ubicacion_id: params.origenUbicacionId,
      destino_ubicacion_id: destinoUbicacionId,
      ci_proyecto_id: params.proyectoId,
      tipo_movimiento: 'salida_obra',
      observaciones: `[Telegram /salida] ${params.observacion.trim().slice(0, 500)}`,
      lineas: lineasTransferencia,
    });

    await completarTransferenciaInventario(params.supabase, transferenciaId);

    return { ok: true, transferenciaId, codigo, nLineas: lineasMatch.length };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error al crear transferencia' };
  }
}
