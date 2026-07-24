import type { SupabaseClient } from '@supabase/supabase-js';
import { patronIlike } from '@/lib/contabilidad/comprasQueryFiltros';
import { limpiarDescripcionProcura } from '@/lib/compras/procuraMaterialTexto';

export type PrecioHistoricoMaterial = {
  precioUnitarioUsd: number;
  fuente: 'contabilidad_compra_lineas' | 'ci_procuras';
  fechaReferencia: string;
};

export type ResultadoPrecioHistorico = {
  precio: PrecioHistoricoMaterial | null;
  /** true solo ante excepción de red/runtime (no cuando simplemente no hay datos). */
  errorConsulta: boolean;
};

const ESTADOS_PROCURA_HISTORICO = ['en_compra', 'recibida', 'recibida_parcial'] as const;

function esMonedaUsd(moneda: string | null | undefined): boolean {
  const m = String(moneda ?? '')
    .trim()
    .toUpperCase();
  return m === 'USD' || m === 'US$' || m === 'DOLAR' || m === 'DÓLAR';
}

function mejorPrecio(
  actual: PrecioHistoricoMaterial | null,
  candidato: PrecioHistoricoMaterial | null,
): PrecioHistoricoMaterial | null {
  if (!candidato) return actual;
  if (!actual) return candidato;
  return candidato.fechaReferencia > actual.fechaReferencia ? candidato : actual;
}

type LineaContabilidad = {
  precio_unitario: number;
  created_at: string;
  compra_id: string;
};

/**
 * Último precio unitario USD conocido (compras contables o procuras ejecutadas).
 */
export async function buscarPrecioHistoricoUnitarioUsd(
  supabase: SupabaseClient,
  params: {
    materialId?: string | null;
    descripcionMaterial: string;
  },
): Promise<ResultadoPrecioHistorico> {
  try {
    const materialId = params.materialId?.trim() || null;
    const descripcion = limpiarDescripcionProcura(params.descripcionMaterial);
    let mejor: PrecioHistoricoMaterial | null = null;

    const procesarLineasContabilidad = async (lineas: LineaContabilidad[] | null) => {
      if (!lineas?.length) return;

      const compraIds = Array.from(new Set(lineas.map((l) => String(l.compra_id))));
      const { data: compras, error: errCompras } = await supabase
        .from('contabilidad_compras')
        .select('id, moneda, fecha, created_at')
        .in('id', compraIds);

      if (errCompras) {
        console.warn('[precioHistorico] contabilidad_compras:', errCompras.message);
        return;
      }

      const monedaPorCompra = new Map(
        (compras ?? []).map((c) => [
          String(c.id),
          { moneda: String(c.moneda ?? ''), fecha: String(c.fecha ?? c.created_at ?? '') },
        ]),
      );

      for (const linea of lineas) {
        const compra = monedaPorCompra.get(String(linea.compra_id));
        if (!compra || !esMonedaUsd(compra.moneda)) continue;
        const precio = Number(linea.precio_unitario);
        if (!Number.isFinite(precio) || precio <= 0) continue;
        mejor = mejorPrecio(mejor, {
          precioUnitarioUsd: precio,
          fuente: 'contabilidad_compra_lineas',
          fechaReferencia: linea.created_at || compra.fecha,
        });
      }
    };

    if (materialId) {
      const { data: lineasMat, error } = await supabase
        .from('contabilidad_compra_lineas')
        .select('precio_unitario, created_at, compra_id')
        .eq('material_id', materialId)
        .gt('precio_unitario', 0)
        .order('created_at', { ascending: false })
        .limit(12);
      if (error) console.warn('[precioHistorico] lineas material_id:', error.message);
      else await procesarLineasContabilidad((lineasMat ?? []) as LineaContabilidad[]);
    }

    if (descripcion.length >= 3) {
      const pattern = patronIlike(descripcion.slice(0, 120));
      if (pattern) {
        const { data: lineasDesc, error } = await supabase
          .from('contabilidad_compra_lineas')
          .select('precio_unitario, created_at, compra_id')
          .ilike('descripcion', pattern)
          .gt('precio_unitario', 0)
          .order('created_at', { ascending: false })
          .limit(12);
        if (error) console.warn('[precioHistorico] lineas descripcion:', error.message);
        else await procesarLineasContabilidad((lineasDesc ?? []) as LineaContabilidad[]);
      }
    }

    let queryProcura = supabase
      .from('ci_procuras')
      .select('monto_estimado_usd, cantidad, updated_at')
      .in('estado', [...ESTADOS_PROCURA_HISTORICO])
      .gt('monto_estimado_usd', 0)
      .gt('cantidad', 0)
      .order('updated_at', { ascending: false })
      .limit(12);

    if (materialId) {
      queryProcura = queryProcura.eq('material_id', materialId);
    } else if (descripcion.length >= 3) {
      const pattern = patronIlike(descripcion.slice(0, 120));
      if (!pattern) return { precio: mejor, errorConsulta: false };
      queryProcura = queryProcura.ilike('material_txt', pattern);
    } else {
      return { precio: mejor, errorConsulta: false };
    }

    const { data: procuras, error: errProcura } = await queryProcura;
    if (errProcura) {
      console.warn('[precioHistorico] ci_procuras:', errProcura.message);
    } else {
      for (const row of procuras ?? []) {
        const monto = Number(row.monto_estimado_usd);
        const cant = Number(row.cantidad);
        if (!Number.isFinite(monto) || !Number.isFinite(cant) || cant <= 0) continue;
        const unitario = monto / cant;
        if (unitario <= 0) continue;
        mejor = mejorPrecio(mejor, {
          precioUnitarioUsd: unitario,
          fuente: 'ci_procuras',
          fechaReferencia: String(row.updated_at),
        });
      }
    }

    return { precio: mejor, errorConsulta: false };
  } catch (e) {
    console.warn('[precioHistorico] excepción:', e);
    return { precio: null, errorConsulta: true };
  }
}
