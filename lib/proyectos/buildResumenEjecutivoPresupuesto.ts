import type { ObraData, Partida } from '@/lib/proyectos/presupuestoObraCalculos';
import { parcialPartida } from '@/lib/proyectos/presupuestoObraCalculos';
import {
  extraerCapituloRaizDesdeCodigo,
  tituloCapituloRaizEjecutivo,
} from '@/lib/proyectos/capituloRaizLulo';
import type { CapituloResumenFilas } from '@/lib/proyectos/resumenPresupuestoMembrete';
import { compareCodigoNatural } from '@/lib/proyectos/luloVistaAgrupada';
import { nombreCapituloLulo } from '@/lib/proyectos/presupuestoCapitulosFormat';

export type ResumenEjecutivoPresupuestoData = {
  proyectoNombre: string;
  numeroContrato: string;
  propietarioObra: string;
  capitulos: CapituloResumenFilas[];
  totalGeneral: number;
};

function claveSubCapitulo(p: Partida): string {
  const codCap = String(p.capitulo_codigo ?? '').trim();
  const descCap = String(p.capitulo_descripcion ?? '').trim();
  if (codCap && descCap) return `${codCap}|${descCap}`;
  if (descCap) return descCap;
  if (codCap) return codCap;
  return p.codigo_covenin.trim().slice(0, 12) || p.descripcion.trim().slice(0, 40) || 'Partidas';
}

function tituloSubCapitulo(p: Partida, partidasGrupo: Partida[]): string {
  const descCap = String(p.capitulo_descripcion ?? '').trim();
  const codCap = String(p.capitulo_codigo ?? '').trim();
  if (descCap) {
    return codCap ? `${codCap} — ${descCap}` : descCap.toUpperCase();
  }
  const header = partidasGrupo.find((x) => x.descripcion?.trim());
  const desc = header?.descripcion?.trim();
  if (desc && desc.length <= 72) return desc;
  if (desc) return `${desc.slice(0, 69)}…`;
  return nombreCapituloLulo('', claveSubCapitulo(p));
}

function subCapitulosDesdePartidas(partidas: Partida[]): CapituloResumenFilas['subCapitulos'] {
  const buckets = new Map<string, Partida[]>();
  for (const p of partidas) {
    const key = claveSubCapitulo(p);
    const list = buckets.get(key) ?? [];
    list.push(p);
    buckets.set(key, list);
  }

  const keys = Array.from(buckets.keys()).sort((a, b) => {
    const pa = buckets.get(a)?.[0];
    const pb = buckets.get(b)?.[0];
    const oa = Number(pa?.capitulo_orden ?? 9999);
    const ob = Number(pb?.capitulo_orden ?? 9999);
    if (oa !== ob) return oa - ob;
    return compareCodigoNatural(a, b);
  });

  return keys.map((key) => {
    const filas = buckets.get(key) ?? [];
    const totalSub = filas.reduce((s, row) => s + parcialPartida(row), 0);
    const ref = filas[0]!;
    return {
      titulo: tituloSubCapitulo(ref, filas),
      totalSub: Math.round(totalSub * 100) / 100,
    };
  });
}

/** Agrupa partidas por capítulo raíz del código (E-31 → ESTRUCTURA). */
export function agruparPartidasPorCapituloRaiz(partidas: Partida[]): CapituloResumenFilas[] {
  const raizBuckets = new Map<string, { prefijo: string; etiqueta: string; partidas: Partida[] }>();

  for (const p of partidas) {
    const raiz = extraerCapituloRaizDesdeCodigo(p.codigo_covenin);
    const bucket = raizBuckets.get(raiz.prefijo) ?? {
      prefijo: raiz.prefijo,
      etiqueta: raiz.etiqueta,
      partidas: [],
    };
    bucket.partidas.push(p);
    raizBuckets.set(raiz.prefijo, bucket);
  }

  const ordenados = Array.from(raizBuckets.values()).sort((a, b) =>
    compareCodigoNatural(a.prefijo, b.prefijo),
  );

  const totalGeneral =
    Math.round(partidas.reduce((s, p) => s + parcialPartida(p), 0) * 100) / 100;

  return ordenados.map((grupo) => {
    const subs = subCapitulosDesdePartidas(grupo.partidas);
    const totalCapitulo = Math.round(
      grupo.partidas.reduce((s, p) => s + parcialPartida(p), 0) * 100,
    ) / 100;
    return {
      titulo: tituloCapituloRaizEjecutivo({
        prefijo: grupo.prefijo,
        etiqueta: grupo.etiqueta,
      }),
      subCapitulos: subs.length > 1 ? subs : [],
      totalCapitulo,
      porcentaje: totalGeneral > 0 ? (totalCapitulo / totalGeneral) * 100 : 0,
    };
  });
}

/** Resumen ejecutivo desde obra (datos proyecto vienen de ci_proyectos vía buildObraDataPresupuesto). */
export function buildResumenEjecutivoPresupuesto(obra: ObraData): ResumenEjecutivoPresupuestoData {
  const capitulos = agruparPartidasPorCapituloRaiz(obra.partidas ?? []);
  const totalGeneral = Math.round(
    capitulos.reduce((s, c) => s + c.totalCapitulo, 0) * 100,
  ) / 100;

  return {
    proyectoNombre: obra.nombre_obra,
    numeroContrato: obra.contrato_nro || 'E.S/C',
    propietarioObra: obra.propietario || '—',
    capitulos,
    totalGeneral,
  };
}
