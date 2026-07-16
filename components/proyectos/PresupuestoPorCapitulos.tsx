'use client';

import { useMemo } from 'react';
import {
  agruparPartidasPorCapitulo,
  parcialPartida,
  type CapituloPresupuestoGrupo,
  type ObraData,
  type Partida,
} from '@/lib/proyectos/presupuestoObraCalculos';
import {
  fmtMontoLulo,
  fmtPorcentajeLulo,
  montoUsdEnLetrasMayus,
} from '@/lib/proyectos/presupuestoCapitulosFormat';

export type {
  CapituloPresupuestoGrupo,
  ObraData,
  Partida,
} from '@/lib/proyectos/presupuestoObraCalculos';
export { agruparPartidasPorCapitulo, parcialPartida } from '@/lib/proyectos/presupuestoObraCalculos';

/* -------------------------------------------------------------------------- */
/* Tipos (props del componente)                                              */
/* -------------------------------------------------------------------------- */

export type PresupuestoPorCapitulosProps = {
  obra: ObraData;
  variant?: 'report' | 'app';
  moneda?: string;
  titulo?: string;
  className?: string;
  pagina?: number;
  /** Tablas de partidas por capítulo (estilo listado Lulo debajo del resumen). */
  mostrarDetalle?: boolean;
};

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
  mostrarDetalle = false,
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

        {mostrarDetalle && grupos.length > 0 ? (
          <div className="mt-10 space-y-8 print:space-y-6">
            <h2 className={`text-xs font-bold uppercase tracking-wider border-b pb-2 ${t.border} ${t.label}`}>
              Detalle de partidas por capítulo
            </h2>
            {grupos.map((grupo) => (
              <section key={`det-${grupo.titulo}-${grupo.rango}`} className="break-inside-avoid">
                <div className={`mb-2 flex flex-wrap items-baseline justify-between gap-2 border-b pb-1 ${t.border}`}>
                  <h3 className={`text-[11px] font-bold uppercase ${t.label}`}>
                    {grupo.titulo} {grupo.rango}
                  </h3>
                  <span className={`text-[11px] font-semibold tabular-nums ${t.label}`}>
                    Subtotal {simbolo} {fmtMontoLulo(grupo.subtotal)}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] border-collapse text-[10px]">
                    <thead>
                      <tr>
                        <th className={`${t.headCell} text-left w-[14%]`}>Código</th>
                        <th className={`${t.headCell} text-left`}>Descripción</th>
                        <th className={`${t.headCell} text-center w-[8%]`}>Und</th>
                        <th className={`${t.headCell} text-right w-[12%]`}>Cantidad</th>
                        <th className={`${t.headCell} text-right w-[14%]`}>P.U.</th>
                        <th className={`${t.headCell} text-right w-[14%]`}>Monto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {grupo.partidas.map((p) => {
                        const monto = parcialPartida(p);
                        return (
                          <tr key={p.id} className="align-top">
                            <td className={`${t.bodyCell} font-mono ${t.label}`}>{p.codigo_covenin}</td>
                            <td className={`${t.bodyCell} ${t.label} leading-snug`}>{p.descripcion}</td>
                            <td className={`${t.bodyCell} text-center ${t.meta}`}>{p.unidad}</td>
                            <td className={`${t.bodyCell} text-right tabular-nums ${t.meta}`}>
                              {fmtMontoLulo(p.cantidad, 4)}
                            </td>
                            <td className={`${t.bodyCell} text-right tabular-nums ${t.meta}`}>
                              {fmtMontoLulo(p.precio_unitario)}
                            </td>
                            <td className={`${t.bodyCell} text-right tabular-nums font-medium ${t.label}`}>
                              {fmtMontoLulo(monto)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
          </div>
        ) : null}
      </div>
    </article>
  );
}
