import type { SupabaseClient } from '@supabase/supabase-js';
import {
  cargarMaterialesComprasPeriodo,
  type LineaMaterialCompraTelegram,
  type PeriodoComprasTelegram,
} from '@/lib/contabilidad/cargarComprasPeriodoTelegram';
import { todayIsoVenezuela } from '@/lib/contabilidad/comprasFiltros';

export type InformeComprasResumen = {
  materiales: number;
  facturas: number;
  telegram: number;
  app: number;
  cantidadTotal: number;
};

export async function cargarInformeCompras(
  supabase: SupabaseClient,
  periodo: PeriodoComprasTelegram,
  refDate = todayIsoVenezuela(),
): Promise<{
  lineas: LineaMaterialCompraTelegram[];
  rango: { desde: string; hasta: string };
  resumen: InformeComprasResumen;
}> {
  const { lineas, rango } = await cargarMaterialesComprasPeriodo(supabase, periodo, refDate);
  const facturas = new Set(lineas.map((l) => l.factura));
  let telegram = 0;
  let app = 0;
  let cantidadTotal = 0;
  for (const l of lineas) {
    if (l.origen === 'Telegram') telegram += 1;
    else app += 1;
    cantidadTotal += Number(l.cantidad) || 0;
  }
  return {
    lineas,
    rango,
    resumen: {
      materiales: lineas.length,
      facturas: facturas.size,
      telegram,
      app,
      cantidadTotal,
    },
  };
}
