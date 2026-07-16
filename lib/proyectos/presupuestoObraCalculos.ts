import { getCapituloKeyPartida } from '@/lib/proyectos/luloCapitulos';
import { compareCodigoNatural } from '@/lib/proyectos/luloVistaAgrupada';
import {
  nombreCapituloLulo,
  rangoPartidasLulo,
} from '@/lib/proyectos/presupuestoCapitulosFormat';

export interface Partida {
  id: string;
  codigo_covenin: string;
  descripcion: string;
  unidad: string;
  cantidad: number;
  precio_unitario: number;
  capitulo: string;
  capitulo_codigo?: string | null;
  capitulo_descripcion?: string | null;
  capitulo_orden?: number | null;
  monto_total_estimado?: number | null;
}

export interface ObraData {
  nombre_obra: string;
  ubicacion: string;
  propietario: string;
  contrato_nro: string;
  fecha: string;
  partidas: Partida[];
}

export type CapituloPresupuestoGrupo = {
  capitulo: string;
  titulo: string;
  rango: string;
  partidas: Partida[];
  subtotal: number;
  porcentaje: number;
};

export function parcialPartida(p: Partida): number {
  const monto = Number(p.monto_total_estimado ?? 0);
  if (Number.isFinite(monto) && monto > 0) return Math.round(monto * 100) / 100;
  const c = Number.isFinite(p.cantidad) ? p.cantidad : 0;
  const pu = Number.isFinite(p.precio_unitario) ? p.precio_unitario : 0;
  return Math.round(c * pu * 100) / 100;
}

/** Agrupa partidas del reporte presupuesto (título Lulo, rango, subtotal, %). */
export function agruparPartidasPorCapitulo(partidas: Partida[]): CapituloPresupuestoGrupo[] {
  const map = new Map<string, Partida[]>();
  const ordenMeta = new Map<string, number>();
  const descMeta = new Map<string, string>();

  for (const p of partidas) {
    const key = getCapituloKeyPartida({
      codigo_partida: p.codigo_covenin,
      capitulo_codigo: p.capitulo_codigo,
    });
    if (!map.has(key)) {
      map.set(key, []);
      ordenMeta.set(key, Number(p.capitulo_orden ?? 9999));
    } else {
      ordenMeta.set(key, Math.min(ordenMeta.get(key)!, Number(p.capitulo_orden ?? 9999)));
    }
    const desc = String(p.capitulo_descripcion ?? '').trim();
    if (desc && !descMeta.has(key)) descMeta.set(key, desc);
    map.get(key)!.push(p);
  }

  const keys = Array.from(map.keys()).sort((ka, kb) => {
    const oa = ordenMeta.get(ka) ?? 9999;
    const ob = ordenMeta.get(kb) ?? 9999;
    if (oa !== ob) return oa - ob;
    return compareCodigoNatural(ka, kb);
  });

  const indiceGlobal = new Map<string, number>();
  let n = 0;
  for (const key of keys) {
    const filas = [...(map.get(key) ?? [])].sort((a, b) =>
      compareCodigoNatural(a.codigo_covenin, b.codigo_covenin),
    );
    for (const p of filas) {
      n += 1;
      indiceGlobal.set(p.id, n);
    }
  }

  const grupos = keys.map((key) => {
    const filas = [...(map.get(key) ?? [])].sort((a, b) =>
      compareCodigoNatural(a.codigo_covenin, b.codigo_covenin),
    );
    const indices = filas.map((p) => indiceGlobal.get(p.id) ?? 0).filter((i) => i > 0);
    const desde = indices.length ? Math.min(...indices) : 0;
    const hasta = indices.length ? Math.max(...indices) : 0;
    const desc = descMeta.get(key) ?? '';
    const titulo = nombreCapituloLulo(desc, key);
    const subtotal = filas.reduce((s, row) => s + parcialPartida(row), 0);
    return {
      capitulo: titulo,
      titulo,
      rango: rangoPartidasLulo(desde, hasta),
      partidas: filas,
      subtotal,
      porcentaje: 0,
    };
  });

  const total = grupos.reduce((s, g) => s + g.subtotal, 0);
  return grupos.map((g) => ({
    ...g,
    porcentaje: total > 0 ? (g.subtotal / total) * 100 : 0,
  }));
}
