'use client';

import { useMemo } from 'react';
import { getCapituloKeyPartida } from '@/lib/proyectos/luloCapitulos';
import {
  fmtMontoLulo,
  fmtPorcentajeLulo,
  montoUsdEnLetrasMayus,
  nombreCapituloLulo,
  rangoPartidasLulo,
} from '@/lib/proyectos/presupuestoCapitulosFormat';
import { compareCodigoNatural } from '@/lib/proyectos/luloVistaAgrupada';

/* -------------------------------------------------------------------------- */
/* Tipos                                                                       */
/* -------------------------------------------------------------------------- */

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

export type PresupuestoPorCapitulosProps = {
  obra: ObraData;
  variant?: 'report' | 'app';
  moneda?: string;
  titulo?: string;
  className?: string;
  pagina?: number;
};

/* -------------------------------------------------------------------------- */
/* Cálculos                                                                    */
/* -------------------------------------------------------------------------- */

export function parcialPartida(p: Partida): number {
  const monto = Number(p.monto_total_estimado ?? 0);
  if (Number.isFinite(monto) && monto > 0) return Math.round(monto * 100) / 100;
  const c = Number.isFinite(p.cantidad) ? p.cantidad : 0;
  const pu = Number.isFinite(p.precio_unitario) ? p.precio_unitario : 0;
  return Math.round(c * pu * 100) / 100;
}

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

/* -------------------------------------------------------------------------- */
/* Estilos                                                                     */
/* -------------------------------------------------------------------------- */

const STYLES = {
  report: {
    root: 'bg-white text-black border border-slate-300',
    border: 'border-slate-400',
    headCell: 'border border-slate-400 bg-white font-bold text-[11px] px-2 py-1.5',
    bodyCell: 'border border-slate-400 px-2 py-1.5 text-[11px]',
    label: 'text-black',
    meta: 'text-black text-[11px]',
    totalBox: 'border border-slate-400',
    letras: 'text-[11px] font-semibold uppercase tracking-wide',
  },
  app: {
    root: 'bg-[#0A0A0F] text-zinc-100 border border-white/15',
    border: 'border-white/20',
    headCell: 'border border-white/20 bg-zinc-900 font-bold text-[11px] px-2 py-1.5 text-zinc-200',
    bodyCell: 'border border-white/15 px-2 py-1.5 text-[11px]',
    label: 'text-zinc-100',
    meta: 'text-zinc-400 text-[11px]',
    totalBox: 'border border-amber-500/40 bg-amber-950/20',
    letras: 'text-[11px] font-semibold uppercase tracking-wide text-amber-100/90',
  },
} as const;

/* -------------------------------------------------------------------------- */
/* Componente — resumen tipo Lulo (una fila por capítulo)                      */
/* -------------------------------------------------------------------------- */

export default function PresupuestoPorCapitulos({
  obra,
  variant = 'report',
  moneda = 'USD',
  titulo = 'PRESUPUESTO POR CAPITULOS',
  className = '',
  pagina = 1,
}: PresupuestoPorCapitulosProps) {
  const t = STYLES[variant];
  const simbolo = moneda === 'VES' || moneda === 'Bs' ? 'Bs' : 'US$';

  const grupos = useMemo(
    () => agruparPartidasPorCapitulo(obra.partidas ?? []),
    [obra.partidas],
  );

  const totalGeneral = useMemo(
    () => grupos.reduce((s, g) => s + g.subtotal, 0),
    [grupos],
  );

  const totalLetras = useMemo(
    () => montoUsdEnLetrasMayus(totalGeneral),
    [totalGeneral],
  );

  return (
    <article
      className={`rounded-lg overflow-hidden font-serif ${t.root} ${className}`.trim()}
      aria-label={`Presupuesto por capítulos: ${obra.nombre_obra}`}
    >
      <div className="px-4 py-5 sm:px-6 sm:py-6 print:px-8">
        {/* Encabezado Lulo */}
        <div className="text-center">
          <h1
            className={`text-base sm:text-lg font-bold uppercase tracking-wide underline underline-offset-4 ${t.label}`}
          >
            {titulo}
          </h1>
        </div>

        <div className="mt-3 flex justify-end gap-6 text-[11px]">
          <span className={t.meta}>
            Pág Nº: <span className={`font-semibold ${t.label}`}>{pagina}</span>
          </span>
          <span className={t.meta}>
            Fecha: <span className={`font-semibold ${t.label}`}>{obra.fecha || '—'}</span>
          </span>
        </div>

        <div className={`mt-4 space-y-1 text-[11px] ${t.meta}`}>
          <p>
            <span className="font-semibold">Obra:</span>{' '}
            <span className={t.label}>{obra.nombre_obra}</span>
          </p>
          <p>
            <span className="font-semibold">Contrato Nº:</span>{' '}
            <span className={t.label}>{obra.contrato_nro || '—'}</span>
          </p>
          <p>
            <span className="font-semibold">Propietario:</span>{' '}
            <span className={t.label}>{obra.propietario || '—'}</span>
          </p>
        </div>

        {/* Tabla resumen */}
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-[11px]">
            <thead>
              <tr>
                <th className={`${t.headCell} text-left w-[55%]`}>Capítulos / Sub Capítulos</th>
                <th className={`${t.headCell} text-right w-[15%]`}>Totales Sub-Capítulos</th>
                <th className={`${t.headCell} text-right w-[18%]`}>Totales Capítulos</th>
                <th className={`${t.headCell} text-right w-[12%]`}>%</th>
              </tr>
            </thead>
            <tbody>
              {grupos.length === 0 ? (
                <tr>
                  <td colSpan={4} className={`${t.bodyCell} text-center py-8 ${t.meta}`}>
                    No hay partidas para el presupuesto.
                  </td>
                </tr>
              ) : (
                grupos.map((grupo) => (
                  <tr key={grupo.titulo + grupo.rango}>
                    <td className={`${t.bodyCell} ${t.label} font-medium uppercase leading-snug`}>
                      {grupo.titulo} {grupo.rango}
                    </td>
                    <td className={`${t.bodyCell} text-right tabular-nums ${t.meta}`} />
                    <td className={`${t.bodyCell} text-right tabular-nums font-semibold ${t.label}`}>
                      {fmtMontoLulo(grupo.subtotal)}
                    </td>
                    <td className={`${t.bodyCell} text-right tabular-nums ${t.label}`}>
                      {fmtPorcentajeLulo(grupo.porcentaje)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Total y letras */}
        {grupos.length > 0 ? (
          <div className="mt-6 space-y-3">
            <div className="flex justify-end">
              <div className={`inline-flex items-baseline gap-2 px-4 py-2 ${t.totalBox}`}>
                <span className={`text-xs font-bold uppercase ${t.label}`}>Total {simbolo}:</span>
                <span className={`text-lg font-bold tabular-nums ${t.label}`}>
                  {fmtMontoLulo(totalGeneral)}
                </span>
              </div>
            </div>
            <p className={`text-center ${t.letras}`}>{totalLetras}</p>
          </div>
        ) : null}
      </div>
    </article>
  );
}
