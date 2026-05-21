'use client';

import { useMemo } from 'react';
import { Building2, FileText, MapPin, User } from 'lucide-react';

/* -------------------------------------------------------------------------- */
/* Tipos de entrada (contrato del componente)                                  */
/* -------------------------------------------------------------------------- */

export interface Partida {
  id: string;
  codigo_covenin: string;
  descripcion: string;
  unidad: string;
  cantidad: number;
  precio_unitario: number;
  capitulo: string;
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
  partidas: Partida[];
  subtotal: number;
};

export type PresupuestoPorCapitulosProps = {
  obra: ObraData;
  /** `report`: fondo claro tipo impresión Lulo; `app`: tema oscuro integrado al CRM */
  variant?: 'report' | 'app';
  moneda?: string;
  titulo?: string;
  className?: string;
};

/* -------------------------------------------------------------------------- */
/* Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function parcialPartida(p: Partida): number {
  const c = Number.isFinite(p.cantidad) ? p.cantidad : 0;
  const pu = Number.isFinite(p.precio_unitario) ? p.precio_unitario : 0;
  return Math.round(c * pu * 100) / 100;
}

function fmtNum(n: number, dec = 2): string {
  return n.toLocaleString('es-VE', {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  });
}

function fmtMoney(n: number, moneda: string): string {
  const code = moneda === 'VES' || moneda === 'Bs' ? 'VES' : 'USD';
  try {
    return n.toLocaleString('es-VE', {
      style: 'currency',
      currency: code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  } catch {
    return `${moneda} ${fmtNum(n)}`;
  }
}

/** Agrupa partidas por capítulo conservando el orden de primera aparición. */
export function agruparPartidasPorCapitulo(partidas: Partida[]): CapituloPresupuestoGrupo[] {
  const ordenCapitulos: string[] = [];
  const map = new Map<string, Partida[]>();

  for (const p of partidas) {
    const cap = String(p.capitulo ?? '').trim() || 'SIN CAPÍTULO';
    if (!map.has(cap)) {
      map.set(cap, []);
      ordenCapitulos.push(cap);
    }
    map.get(cap)!.push(p);
  }

  return ordenCapitulos.map((capitulo) => {
    const filas = [...(map.get(capitulo) ?? [])].sort((a, b) =>
      a.codigo_covenin.localeCompare(b.codigo_covenin, 'es', { numeric: true }),
    );
    const subtotal = filas.reduce((s, row) => s + parcialPartida(row), 0);
    return { capitulo, partidas: filas, subtotal };
  });
}

/* -------------------------------------------------------------------------- */
/* Estilos por variante                                                        */
/* -------------------------------------------------------------------------- */

const STYLES = {
  report: {
    root: 'bg-white text-slate-900 border border-slate-200 shadow-sm',
    header: 'border-b-2 border-slate-800 bg-slate-50',
    title: 'text-slate-900',
    meta: 'text-slate-600',
    metaValue: 'text-slate-900 font-medium',
    capHeader: 'bg-slate-800 text-white',
    capSub: 'text-slate-300',
    thead: 'bg-slate-100 text-slate-700 border-b border-slate-300',
    row: 'border-b border-slate-100 hover:bg-slate-50/80',
    rowAlt: 'bg-slate-50/40',
    cellMono: 'font-mono text-slate-800',
    subtotal: 'bg-slate-100 border-t-2 border-slate-300 text-slate-900',
    total: 'bg-slate-900 text-white',
    empty: 'text-slate-500',
  },
  app: {
    root: 'bg-[#0A0A0F] text-zinc-100 border border-white/10',
    header: 'border-b border-white/10 bg-zinc-900/80',
    title: 'text-white',
    meta: 'text-zinc-500',
    metaValue: 'text-zinc-200 font-medium',
    capHeader: 'bg-amber-950/50 text-amber-100 border border-amber-500/25',
    capSub: 'text-amber-200/70',
    thead: 'bg-zinc-900 text-zinc-400 border-b border-white/10',
    row: 'border-b border-white/5 hover:bg-white/[0.02]',
    rowAlt: 'bg-white/[0.01]',
    cellMono: 'font-mono text-zinc-300',
    subtotal: 'bg-zinc-900/60 border-t border-white/10 text-amber-100',
    total: 'bg-amber-500/15 border border-amber-500/30 text-amber-100',
    empty: 'text-zinc-500',
  },
} as const;

/* -------------------------------------------------------------------------- */
/* Componente principal                                                        */
/* -------------------------------------------------------------------------- */

export default function PresupuestoPorCapitulos({
  obra,
  variant = 'report',
  moneda = 'USD',
  titulo = 'PRESUPUESTO DE OBRA',
  className = '',
}: PresupuestoPorCapitulosProps) {
  const t = STYLES[variant];

  const grupos = useMemo(
    () => agruparPartidasPorCapitulo(obra.partidas ?? []),
    [obra.partidas],
  );

  const totalGeneral = useMemo(
    () => grupos.reduce((s, g) => s + g.subtotal, 0),
    [grupos],
  );

  const totalPartidas = obra.partidas?.length ?? 0;

  return (
    <article
      className={`rounded-xl overflow-hidden ${t.root} ${className}`.trim()}
      aria-label={`Presupuesto por capítulos: ${obra.nombre_obra}`}
    >
      {/* Encabezado tipo reporte de ingeniería */}
      <header className={`px-4 py-5 sm:px-6 sm:py-6 ${t.header}`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
              Ingeniería de costos
            </p>
            <h1 className={`mt-1 text-xl sm:text-2xl font-bold tracking-tight ${t.title}`}>
              {titulo}
            </h1>
            <p className={`mt-2 text-base sm:text-lg font-semibold ${t.metaValue}`}>
              {obra.nombre_obra}
            </p>
          </div>
          <div
            className={`shrink-0 rounded-lg border px-3 py-2 text-right text-xs ${
              variant === 'report' ? 'border-slate-200 bg-white' : 'border-white/10 bg-black/30'
            }`}
          >
            <p className={t.meta}>Fecha del presupuesto</p>
            <p className={`mt-0.5 font-semibold tabular-nums ${t.metaValue}`}>{obra.fecha || '—'}</p>
          </div>
        </div>

        <dl className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 text-xs">
          <MetaItem
            icon={MapPin}
            label="Ubicación"
            value={obra.ubicacion}
            variant={variant}
          />
          <MetaItem icon={User} label="Propietario" value={obra.propietario} variant={variant} />
          <MetaItem
            icon={FileText}
            label="Contrato Nº"
            value={obra.contrato_nro}
            variant={variant}
          />
          <MetaItem
            icon={Building2}
            label="Partidas"
            value={`${totalPartidas} · ${grupos.length} capítulos`}
            variant={variant}
          />
        </dl>
      </header>

      {/* Cuerpo: capítulos */}
      <div className="px-2 py-4 sm:px-4 sm:py-5 space-y-6">
        {grupos.length === 0 ? (
          <p className={`px-4 py-12 text-center text-sm ${t.empty}`}>
            No hay partidas para mostrar en el presupuesto.
          </p>
        ) : (
          grupos.map((grupo, capIdx) => (
            <section key={`${grupo.capitulo}-${capIdx}`} className="space-y-0">
              <div
                className={`flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 sm:px-4 rounded-t-lg ${t.capHeader}`}
              >
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">
                    Capítulo {capIdx + 1}
                  </p>
                  <h2 className="text-sm sm:text-base font-bold">{grupo.capitulo}</h2>
                </div>
                <p className={`text-xs font-mono ${t.capSub}`}>
                  {grupo.partidas.length} partida{grupo.partidas.length === 1 ? '' : 's'}
                </p>
              </div>

              <div
                className={`overflow-x-auto rounded-b-lg border border-t-0 ${
                  variant === 'report' ? 'border-slate-200/80' : 'border-white/10'
                }`}
              >
                <table className="w-full min-w-[720px] text-left text-xs sm:text-[13px]">
                  <thead>
                    <tr className={t.thead}>
                      <th className="px-2 py-2.5 w-10 font-semibold text-center">#</th>
                      <th className="px-2 py-2.5 w-24 font-semibold">Código</th>
                      <th className="px-2 py-2.5 min-w-[200px] font-semibold">Descripción</th>
                      <th className="px-2 py-2.5 w-14 font-semibold text-center">Und</th>
                      <th className="px-2 py-2.5 w-20 font-semibold text-right">Cantidad</th>
                      <th className="px-2 py-2.5 w-24 font-semibold text-right">P. unit.</th>
                      <th className="px-3 py-2.5 w-28 font-semibold text-right">Parcial</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grupo.partidas.map((p, idx) => {
                      const parcial = parcialPartida(p);
                      const rowCls = `${t.row} ${idx % 2 === 1 ? t.rowAlt : ''}`;
                      return (
                        <tr key={p.id} className={rowCls}>
                          <td className="px-2 py-2 text-center text-slate-500 tabular-nums">
                            {idx + 1}
                          </td>
                          <td className={`px-2 py-2 ${t.cellMono}`}>{p.codigo_covenin}</td>
                          <td className="px-2 py-2 leading-snug">{p.descripcion}</td>
                          <td className="px-2 py-2 text-center uppercase">{p.unidad}</td>
                          <td className="px-2 py-2 text-right tabular-nums">{fmtNum(p.cantidad, 4)}</td>
                          <td className="px-2 py-2 text-right tabular-nums">
                            {fmtMoney(p.precio_unitario, moneda)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums font-semibold">
                            {fmtMoney(parcial, moneda)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className={t.subtotal}>
                      <td colSpan={6} className="px-3 py-2.5 text-right text-[11px] font-bold uppercase">
                        Subtotal {grupo.capitulo}
                      </td>
                      <td className="px-3 py-2.5 text-right font-bold tabular-nums">
                        {fmtMoney(grupo.subtotal, moneda)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>
          ))
        )}
      </div>

      {/* Total general */}
      {grupos.length > 0 ? (
        <footer
          className={`mx-2 mb-4 sm:mx-4 flex flex-wrap items-center justify-between gap-3 rounded-lg px-4 py-4 ${t.total}`}
        >
          <span className="text-sm font-bold uppercase tracking-wide">
            Total presupuesto de obra
          </span>
          <span className="text-xl sm:text-2xl font-bold tabular-nums">
            {fmtMoney(totalGeneral, moneda)}
          </span>
        </footer>
      ) : null}
    </article>
  );
}

function MetaItem({
  icon: Icon,
  label,
  value,
  variant,
}: {
  icon: typeof MapPin;
  label: string;
  value: string;
  variant: 'report' | 'app';
}) {
  const t = STYLES[variant];
  return (
    <div
      className={`flex gap-2 rounded-lg px-3 py-2 ${
        variant === 'report' ? 'bg-white border border-slate-100' : 'bg-black/20 border border-white/5'
      }`}
    >
      <Icon className={`h-4 w-4 shrink-0 mt-0.5 ${variant === 'report' ? 'text-slate-400' : 'text-zinc-500'}`} />
      <div className="min-w-0">
        <dt className={`text-[10px] uppercase tracking-wide font-semibold ${t.meta}`}>{label}</dt>
        <dd className={`mt-0.5 text-sm break-words ${t.metaValue}`}>{value || '—'}</dd>
      </div>
    </div>
  );
}
