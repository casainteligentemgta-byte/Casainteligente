import type { ObraData, Partida } from '@/lib/proyectos/presupuestoObraCalculos';
import {
  agruparPartidasPorCapitulo,
  parcialPartida,
} from '@/lib/proyectos/presupuestoObraCalculos';
import { getRubroDisciplinaKey, compareCodigoNatural } from '@/lib/proyectos/luloVistaAgrupada';

export type SubCapituloResumen = {
  titulo: string;
  totalSub: number;
};

export type CapituloResumen = {
  titulo: string;
  subCapitulos: SubCapituloResumen[];
  totalCapitulo: number;
  porcentaje: number;
};

export type ResumenPresupuestoCapitulosData = {
  proyectoNombre: string;
  numeroContrato: string;
  propietarioObra: string;
  capitulos: CapituloResumen[];
  totalGeneral: number;
};

function tituloSubCapitulo(rubroKey: string, partidas: Partida[]): string {
  const header = partidas.find((p) => {
    const cod = p.codigo_covenin.trim();
    return cod === rubroKey || cod.startsWith(`${rubroKey}.`) || cod.startsWith(`${rubroKey}-`);
  });
  const desc = header?.descripcion?.trim();
  if (desc && desc.length <= 80) return `${rubroKey} — ${desc}`;
  if (desc) return `${rubroKey} — ${desc.slice(0, 77)}…`;
  return rubroKey;
}

function subCapitulosDesdePartidas(partidas: Partida[]): SubCapituloResumen[] {
  const buckets = new Map<string, Partida[]>();
  for (const p of partidas) {
    const key = getRubroDisciplinaKey(p.codigo_covenin);
    const list = buckets.get(key) ?? [];
    list.push(p);
    buckets.set(key, list);
  }

  const keys = Array.from(buckets.keys()).sort(compareCodigoNatural);
  const subs: SubCapituloResumen[] = [];

  for (const key of keys) {
    const filas = buckets.get(key) ?? [];
    const totalSub = filas.reduce((s, p) => s + parcialPartida(p), 0);
    if (totalSub <= 0 && filas.length === 0) continue;
    subs.push({
      titulo: tituloSubCapitulo(key, filas),
      totalSub: Math.round(totalSub * 100) / 100,
    });
  }

  return subs;
}

/** Convierte partidas agrupadas al modelo del resumen con sub-capítulos por rubro Lulo. */
export function buildResumenPresupuestoCapitulos(obra: ObraData): ResumenPresupuestoCapitulosData {
  const grupos = agruparPartidasPorCapitulo(obra.partidas ?? []);
  const totalGeneral = Math.round(grupos.reduce((s, g) => s + g.subtotal, 0) * 100) / 100;

  const capitulos: CapituloResumen[] = grupos.map((g) => {
    const subs = subCapitulosDesdePartidas(g.partidas);
    const mostrarSubs = subs.length > 1 ? subs : [];
    return {
      titulo: g.titulo,
      subCapitulos: mostrarSubs,
      totalCapitulo: Math.round(g.subtotal * 100) / 100,
      porcentaje: totalGeneral > 0 ? (g.subtotal / totalGeneral) * 100 : 0,
    };
  });

  return {
    proyectoNombre: obra.nombre_obra,
    numeroContrato: obra.contrato_nro || 'E.S/C',
    propietarioObra: obra.propietario || '—',
    capitulos,
    totalGeneral,
  };
}
