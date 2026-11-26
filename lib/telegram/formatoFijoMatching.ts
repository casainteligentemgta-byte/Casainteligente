import { normalizarTextoMaterial } from '@/lib/almacen/normalizarTextoMaterial';
import { scoreMaterialInteligente } from '@/lib/almacen/scoreMaterialInteligente';
import type { MaterialCampoOpcion } from '@/components/almacen/BuscadorMaterialCampo';

export type MaterialFormatoFijo = MaterialCampoOpcion & {
  cantidadDisponible?: number;
  enAlmacen?: boolean;
};

export type ProblemaLineaFormatoFijo = {
  indice: number;
  lineaOriginal: string;
  descripcion: string;
  cantidad: number;
  codigo: 'sin_match' | 'ambiguo' | 'stock_insuficiente';
  detalle: string;
};

export type MatchLineaFormatoFijo =
  | {
      ok: true;
      material: MaterialFormatoFijo;
      score: number;
      cantidad: number;
      descripcion: string;
      lineaOriginal: string;
      indice: number;
    }
  | {
      ok: false;
      problema: ProblemaLineaFormatoFijo;
    };

const UMBRAL_MIN = 62;
const UMBRAL_AMBIGUO = 8;

function boostAlmacen(m: MaterialFormatoFijo): number {
  return m.enAlmacen ? 4 : 0;
}

/**
 * Empareja un nombre libre con el catálogo del almacén / obra.
 * Exacto gana. Si el 2.º score está a menos de 8 puntos, es ambiguo.
 */
export function emparejarMaterialFormatoFijo(
  descripcion: string,
  catalogo: MaterialFormatoFijo[],
): { estado: 'unico'; material: MaterialFormatoFijo; score: number } | { estado: 'ambiguo'; candidatos: MaterialFormatoFijo[] } | { estado: 'sin_match' } {
  const term = normalizarTextoMaterial(descripcion);
  if (!term || !catalogo.length) return { estado: 'sin_match' };

  const ranked = catalogo
    .map((m) => ({
      material: m,
      score: Math.min(100, scoreMaterialInteligente(term, m) + boostAlmacen(m)),
    }))
    .filter((r) => r.score >= UMBRAL_MIN)
    .sort((a, b) => b.score - a.score || a.material.name.localeCompare(b.material.name, 'es'));

  if (!ranked.length) return { estado: 'sin_match' };

  const primero = ranked[0]!;
  const segundo = ranked[1];
  if (segundo && primero.score - segundo.score < UMBRAL_AMBIGUO && segundo.score >= UMBRAL_MIN) {
    const nombres = new Set<string>();
    const candidatos: MaterialFormatoFijo[] = [];
    for (const r of ranked) {
      if (primero.score - r.score >= UMBRAL_AMBIGUO) break;
      if (nombres.has(r.material.id)) continue;
      nombres.add(r.material.id);
      candidatos.push(r.material);
      if (candidatos.length >= 4) break;
    }
    if (candidatos.length > 1) return { estado: 'ambiguo', candidatos };
  }

  return { estado: 'unico', material: primero.material, score: primero.score };
}

export function emparejarLineaFormatoFijo(
  linea: { cantidad: number; descripcion: string; lineaOriginal: string; indice: number },
  catalogo: MaterialFormatoFijo[],
): MatchLineaFormatoFijo {
  const r = emparejarMaterialFormatoFijo(linea.descripcion, catalogo);
  if (r.estado === 'sin_match') {
    return {
      ok: false,
      problema: {
        indice: linea.indice,
        lineaOriginal: linea.lineaOriginal,
        descripcion: linea.descripcion,
        cantidad: linea.cantidad,
        codigo: 'sin_match',
        detalle: `No encontré «${linea.descripcion}» en el almacén de esta obra.`,
      },
    };
  }
  if (r.estado === 'ambiguo') {
    const nombres = r.candidatos.map((c) => c.name).join(', ');
    return {
      ok: false,
      problema: {
        indice: linea.indice,
        lineaOriginal: linea.lineaOriginal,
        descripcion: linea.descripcion,
        cantidad: linea.cantidad,
        codigo: 'ambiguo',
        detalle: `«${linea.descripcion}» coincide con varios: ${nombres}.`,
      },
    };
  }
  return {
    ok: true,
    material: r.material,
    score: r.score,
    cantidad: linea.cantidad,
    descripcion: linea.descripcion,
    lineaOriginal: linea.lineaOriginal,
    indice: linea.indice,
  };
}

export function validarStockSalidaFormatoFijo(
  matches: Array<Extract<MatchLineaFormatoFijo, { ok: true }>>,
): ProblemaLineaFormatoFijo[] {
  const agregado = new Map<
    string,
    { cantidad: number; disponible: number; nombre: string; lineas: typeof matches }
  >();

  for (const m of matches) {
    const prev = agregado.get(m.material.id);
    const disponible = Number(m.material.cantidadDisponible ?? 0);
    if (!prev) {
      agregado.set(m.material.id, {
        cantidad: m.cantidad,
        disponible,
        nombre: m.material.name,
        lineas: [m],
      });
    } else {
      prev.cantidad += m.cantidad;
      prev.lineas.push(m);
    }
  }

  const problemas: ProblemaLineaFormatoFijo[] = [];
  for (const { cantidad, disponible, nombre, lineas } of Array.from(agregado.values())) {
    if (disponible + 0.0001 >= cantidad) continue;
    for (const ln of lineas) {
      problemas.push({
        indice: ln.indice,
        lineaOriginal: ln.lineaOriginal,
        descripcion: ln.descripcion,
        cantidad: ln.cantidad,
        codigo: 'stock_insuficiente',
        detalle: `Stock insuficiente de «${nombre}»: hay ${disponible}, se piden ${cantidad}.`,
      });
    }
  }
  return problemas;
}
