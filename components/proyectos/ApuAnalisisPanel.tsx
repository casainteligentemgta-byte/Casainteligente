'use client';

import type {
  InsumoMaestroLulo,
  LineaApuInsumoLulo,
  MargenesProyectoApu,
  PartidaApuLulo,
} from '@/types/apu-lulo';
import { useMemo, useState } from 'react';
import {
  calcularCostoTotalInsumoApu,
  clasificarInsumoApu,
  type CategoriaInsumoApu,
} from '@/lib/proyectos/apuCalculos';
import {
  ArrowDownWideNarrow,
  BarChart3,
  Filter,
  Layers,
  Percent,
  TrendingUp,
  Wrench,
  Users,
  Package,
} from 'lucide-react';

/* -------------------------------------------------------------------------- */
/* Tipos (datos relacionales Lulo → Casa Inteligente)                          */
/* -------------------------------------------------------------------------- */

export type {
  InsumoMaestroLulo,
  PartidaApuLulo,
  LineaApuInsumoLulo,
  MargenesProyectoApu,
} from '@/types/apu-lulo';

export type ApuAnalisisPanelProps = {
  partida: PartidaApuLulo;
  lineas: LineaApuInsumoLulo[];
  margenes?: MargenesProyectoApu;
  moneda?: string;
  className?: string;
};

/* -------------------------------------------------------------------------- */
/* Clasificación y fórmulas de ingeniería de costos                            */
/* -------------------------------------------------------------------------- */

export type { CategoriaInsumoApu } from '@/lib/proyectos/apuCalculos';
export { clasificarInsumoApu, calcularCostoTotalInsumoApu } from '@/lib/proyectos/apuCalculos';

export type OrdenApuCriterio = 'impacto' | 'rendimiento';

export type FiltroTipoApu = 'todos' | CategoriaInsumoApu;

export type LineaApuCalculada = {
  lineaId: string;
  categoria: CategoriaInsumoApu;
  codigo: string;
  descripcion: string;
  unidad: string;
  tipoRaw: string;
  rendimiento: number;
  precioBase: number;
  desperdicioPct: number;
  costoTotal: number;
  pctDelCostoDirecto: number;
  pctAcumuladoPareto: number;
  esPareto80: boolean;
  insumo: InsumoMaestroLulo;
  linea: LineaApuInsumoLulo;
};

export type ResumenApuKpi = {
  costoDirecto: number;
  subtotalEquipos: number;
  subtotalManoObra: number;
  subtotalMateriales: number;
  totalAdministracion: number;
  totalUtilidad: number;
  margenIndirectos: number;
  precioUnitarioVenta: number;
  pctAdmin: number;
  pctUtilidad: number;
  cantidadLineas: number;
  insumoDominante: LineaApuCalculada | null;
};

const CATEGORIA_META: Record<
  CategoriaInsumoApu,
  { label: string; emoji: string; badge: string; header: string; icon: typeof Wrench }
> = {
  equipo: {
    label: 'Equipos',
    emoji: '🛠️',
    badge: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
    header: 'bg-sky-950/40 border-sky-500/25',
    icon: Wrench,
  },
  mano_obra: {
    label: 'Mano de Obra',
    emoji: '👥',
    badge: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
    header: 'bg-orange-950/40 border-orange-500/25',
    icon: Users,
  },
  material: {
    label: 'Materiales',
    emoji: '🧱',
    badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    header: 'bg-emerald-950/40 border-emerald-500/25',
    icon: Package,
  },
};

const ORDEN_CATEGORIAS: CategoriaInsumoApu[] = ['equipo', 'mano_obra', 'material'];

export function calcularLineasApu(
  lineas: LineaApuInsumoLulo[],
  orden: OrdenApuCriterio,
): LineaApuCalculada[] {
  const conCosto = lineas.map((linea) => {
    const ins = linea.insumo;
    const categoria = clasificarInsumoApu(ins.tipo);
    const costoTotal = calcularCostoTotalInsumoApu(
      categoria,
      linea.cantidad_rendimiento,
      ins.precio_base,
      linea.desperdicio_porcentaje,
    );
    const row: LineaApuCalculada = {
      lineaId: linea.id,
      categoria,
      codigo: ins.codigo,
      descripcion: ins.descripcion,
      unidad: ins.unidad,
      tipoRaw: ins.tipo ?? '—',
      rendimiento: linea.cantidad_rendimiento,
      precioBase: ins.precio_base,
      desperdicioPct: linea.desperdicio_porcentaje,
      costoTotal,
      pctDelCostoDirecto: 0,
      pctAcumuladoPareto: 0,
      esPareto80: false,
      insumo: ins,
      linea,
    };
    return row;
  });

  const costoDirecto = conCosto.reduce((s, l) => s + l.costoTotal, 0);

  const ordenadas: LineaApuCalculada[] =
    orden === 'rendimiento'
      ? [...conCosto].sort((a, b) => b.rendimiento - a.rendimiento)
      : [...conCosto].sort((a, b) => b.costoTotal - a.costoTotal);

  let acumulado = 0;
  for (const row of ordenadas) {
    row.pctDelCostoDirecto = costoDirecto > 0 ? (row.costoTotal / costoDirecto) * 100 : 0;
    const prevAcum = acumulado;
    acumulado += row.pctDelCostoDirecto;
    row.pctAcumuladoPareto = acumulado;
    row.esPareto80 = prevAcum < 80;
  }

  return ordenadas;
}

export function calcularResumenApu(
  lineasCalc: LineaApuCalculada[],
  margenes?: MargenesProyectoApu,
): ResumenApuKpi {
  const subtotalEquipos = lineasCalc
    .filter((l) => l.categoria === 'equipo')
    .reduce((s, l) => s + l.costoTotal, 0);
  const subtotalManoObra = lineasCalc
    .filter((l) => l.categoria === 'mano_obra')
    .reduce((s, l) => s + l.costoTotal, 0);
  const subtotalMateriales = lineasCalc
    .filter((l) => l.categoria === 'material')
    .reduce((s, l) => s + l.costoTotal, 0);

  const costoDirecto = subtotalEquipos + subtotalManoObra + subtotalMateriales;
  const pctAdmin = Number(margenes?.porcentaje_admin ?? 0);
  const pctUtilidad = Number(margenes?.porcentaje_utilidad ?? 0);

  const totalAdministracion = costoDirecto * (pctAdmin / 100);
  const totalUtilidad = (costoDirecto + totalAdministracion) * (pctUtilidad / 100);
  const margenIndirectos = totalAdministracion + totalUtilidad;
  const precioUnitarioVenta = costoDirecto + margenIndirectos;

  const insumoDominante =
    lineasCalc.length > 0
      ? [...lineasCalc].sort((a, b) => b.costoTotal - a.costoTotal)[0] ?? null
      : null;

  return {
    costoDirecto,
    subtotalEquipos,
    subtotalManoObra,
    subtotalMateriales,
    totalAdministracion,
    totalUtilidad,
    margenIndirectos,
    precioUnitarioVenta,
    pctAdmin,
    pctUtilidad,
    cantidadLineas: lineasCalc.length,
    insumoDominante,
  };
}

function fmtMoney(n: number, moneda: string): string {
  return n.toLocaleString('es-VE', {
    style: 'currency',
    currency: moneda === 'USD' ? 'USD' : 'VES',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtNum(n: number, dec = 4): string {
  return n.toLocaleString('es-VE', {
    minimumFractionDigits: 0,
    maximumFractionDigits: dec,
  });
}

function fmtPct(n: number): string {
  return `${n.toLocaleString('es-VE', { maximumFractionDigits: 1 })}%`;
}

/* -------------------------------------------------------------------------- */
/* Componente principal                                                        */
/* -------------------------------------------------------------------------- */

export default function ApuAnalisisPanel({
  partida,
  lineas,
  margenes,
  moneda = 'USD',
  className = '',
}: ApuAnalisisPanelProps) {
  const [orden, setOrden] = useState<OrdenApuCriterio>('impacto');
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipoApu>('todos');

  const lineasCalculadas = useMemo(() => calcularLineasApu(lineas, orden), [lineas, orden]);

  const lineasFiltradas = useMemo(() => {
    if (filtroTipo === 'todos') return lineasCalculadas;
    return lineasCalculadas.filter((l) => l.categoria === filtroTipo);
  }, [lineasCalculadas, filtroTipo]);

  const resumen = useMemo(
    () => calcularResumenApu(lineasCalculadas, margenes),
    [lineasCalculadas, margenes],
  );

  const grupos = useMemo(() => {
    const map = new Map<CategoriaInsumoApu, LineaApuCalculada[]>();
    for (const cat of ORDEN_CATEGORIAS) map.set(cat, []);
    for (const row of lineasFiltradas) {
      const list = map.get(row.categoria) ?? [];
      list.push(row);
      map.set(row.categoria, list);
    }
    return ORDEN_CATEGORIAS.map((cat) => ({
      categoria: cat,
      meta: CATEGORIA_META[cat],
      filas: map.get(cat) ?? [],
      subtotal: (map.get(cat) ?? []).reduce((s, r) => s + r.costoTotal, 0),
    })).filter((g) => g.filas.length > 0 || filtroTipo === 'todos');
  }, [lineasFiltradas, filtroTipo]);

  const pctFcm = Number(margenes?.porcentaje_fcm ?? 0);

  return (
    <div className={`space-y-6 text-zinc-100 ${className}`.trim()}>
      {/* Cabecera partida */}
      <header className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-4 md:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Análisis de precio unitario
            </p>
            <h2 className="mt-1 text-lg font-bold text-white md:text-xl">
              <span className="font-mono text-amber-400/90">{partida.codigo_partida}</span>
              <span className="mx-2 text-zinc-600">·</span>
              {partida.descripcion}
            </h2>
            <p className="mt-1 text-xs text-zinc-500">
              Unidad de obra: <strong className="text-zinc-300">{partida.unidad || 'UND'}</strong>
              {partida.cantidad_presupuestada != null ? (
                <>
                  {' '}
                  · Cantidad presupuestada:{' '}
                  <strong className="text-zinc-300">{fmtNum(partida.cantidad_presupuestada, 2)}</strong>
                </>
              ) : null}
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-violet-500/25 bg-violet-950/30 px-3 py-2">
            <Layers className="h-4 w-4 text-violet-400" aria-hidden />
            <span className="text-xs text-violet-200">
              {resumen.cantidadLineas} insumo{resumen.cantidadLineas === 1 ? '' : 's'} en composición
            </span>
          </div>
        </div>
      </header>

      {/* KPIs */}
      <section
        className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6"
        aria-label="Indicadores del APU"
      >
        <KpiCard
          label="Costo directo"
          value={fmtMoney(resumen.costoDirecto, moneda)}
          sub="Equipos + MO + Materiales"
          accent="text-emerald-400"
        />
        <KpiCard
          label="Subtotal equipos"
          value={fmtMoney(resumen.subtotalEquipos, moneda)}
          sub={fmtPct(
            resumen.costoDirecto > 0 ? (resumen.subtotalEquipos / resumen.costoDirecto) * 100 : 0,
          )}
          accent="text-sky-400"
        />
        <KpiCard
          label="Subtotal MO"
          value={fmtMoney(resumen.subtotalManoObra, moneda)}
          sub={fmtPct(
            resumen.costoDirecto > 0 ? (resumen.subtotalManoObra / resumen.costoDirecto) * 100 : 0,
          )}
          accent="text-orange-400"
        />
        <KpiCard
          label="Subtotal materiales"
          value={fmtMoney(resumen.subtotalMateriales, moneda)}
          sub={fmtPct(
            resumen.costoDirecto > 0 ? (resumen.subtotalMateriales / resumen.costoDirecto) * 100 : 0,
          )}
          accent="text-emerald-300"
        />
        <KpiCard
          label="Indirectos"
          value={fmtMoney(resumen.margenIndirectos, moneda)}
          sub={`Adm. ${fmtPct(resumen.pctAdmin)} + Util. ${fmtPct(resumen.pctUtilidad)}`}
          accent="text-amber-400"
          icon={Percent}
        />
        <KpiCard
          label="P. unit. venta sugerido"
          value={fmtMoney(resumen.precioUnitarioVenta, moneda)}
          sub="CD + administración + utilidad"
          accent="text-violet-300"
          icon={TrendingUp}
        />
      </section>

      {resumen.insumoDominante ? (
        <div className="rounded-lg border border-amber-500/20 bg-amber-950/20 px-4 py-3 flex flex-wrap items-center gap-3">
          <BarChart3 className="h-5 w-5 text-amber-400 shrink-0" aria-hidden />
          <p className="text-sm text-amber-100/90">
            <strong className="text-amber-200">Insumo dominante (Pareto):</strong>{' '}
            {resumen.insumoDominante.descripcion}{' '}
            <span className="font-mono text-xs text-amber-400/80">({resumen.insumoDominante.codigo})</span>
            {' — '}
            {fmtMoney(resumen.insumoDominante.costoTotal, moneda)} (
            {fmtPct(resumen.insumoDominante.pctDelCostoDirecto)} del costo directo)
          </p>
        </div>
      ) : null}

      {pctFcm > 0 ? (
        <p className="text-[11px] text-zinc-500 px-1">
          FCM proyecto (mano de obra Lulo): <span className="text-zinc-400">{fmtPct(pctFcm)}</span> — no
          incluido en el P. unit. sugerido anterior; aplícalo según tu metodología de obra.
        </p>
      ) : null}

      {/* Controles analíticos */}
      <section className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-semibold uppercase text-zinc-500 mr-1">Ordenar</span>
          <button
            type="button"
            onClick={() => setOrden('impacto')}
            className={btnOrdenCls(orden === 'impacto')}
            title="Mayor costo total en la partida primero (regla 80/20)"
          >
            <ArrowDownWideNarrow className="h-3.5 w-3.5" aria-hidden />
            Impacto de costo (Pareto)
          </button>
          <button
            type="button"
            onClick={() => setOrden('rendimiento')}
            className={btnOrdenCls(orden === 'rendimiento')}
          >
            Rendimiento / incidencia
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-zinc-500" aria-hidden />
          <span className="text-[10px] font-semibold uppercase text-zinc-500">Tipo</span>
          {(
            [
              ['todos', 'Todos'],
              ['equipo', '🛠️ Equipos'],
              ['mano_obra', '👥 MO'],
              ['material', '🧱 Materiales'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFiltroTipo(id)}
              className={btnFiltroCls(filtroTipo === id, id)}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {/* Tabla por categorías */}
      <section className="space-y-4" aria-label="Composición APU por categoría">
        {grupos.length === 0 ? (
          <p className="rounded-xl border border-dashed border-zinc-700 py-12 text-center text-sm text-zinc-500">
            No hay líneas APU para el filtro seleccionado.
          </p>
        ) : (
          grupos.map((grupo) => (
            <CategoriaApuTable
              key={grupo.categoria}
              grupo={grupo}
              moneda={moneda}
              costoDirecto={resumen.costoDirecto}
              mostrarPareto={orden === 'impacto'}
            />
          ))
        )}
      </section>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Subcomponentes UI                                                           */
/* -------------------------------------------------------------------------- */

function KpiCard({
  label,
  value,
  sub,
  accent,
  icon: Icon,
}: {
  label: string;
  value: string;
  sub: string;
  accent: string;
  icon?: typeof TrendingUp;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 px-3 py-3 hover:border-zinc-700 transition-colors">
      <div className="flex items-center justify-between gap-1">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">{label}</p>
        {Icon ? <Icon className={`h-3.5 w-3.5 ${accent}`} aria-hidden /> : null}
      </div>
      <p className={`mt-1 text-base font-bold tabular-nums ${accent}`}>{value}</p>
      <p className="mt-0.5 text-[10px] text-zinc-500 leading-snug">{sub}</p>
    </div>
  );
}

function btnOrdenCls(active: boolean): string {
  return [
    'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition',
    active
      ? 'border-violet-500/50 bg-violet-500/15 text-violet-200'
      : 'border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200',
  ].join(' ');
}

function btnFiltroCls(active: boolean, id: FiltroTipoApu): string {
  const tint =
    id === 'equipo'
      ? active
        ? 'border-sky-500/50 bg-sky-500/15 text-sky-200'
        : 'border-zinc-700 text-zinc-400'
      : id === 'mano_obra'
        ? active
          ? 'border-orange-500/50 bg-orange-500/15 text-orange-200'
          : 'border-zinc-700 text-zinc-400'
        : id === 'material'
          ? active
            ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-200'
            : 'border-zinc-700 text-zinc-400'
          : active
            ? 'border-zinc-500 bg-zinc-800 text-zinc-100'
            : 'border-zinc-700 text-zinc-400';
  return `rounded-lg border px-3 py-1.5 text-xs font-medium transition hover:opacity-90 ${tint}`;
}

type GrupoCategoria = {
  categoria: CategoriaInsumoApu;
  meta: (typeof CATEGORIA_META)[CategoriaInsumoApu];
  filas: LineaApuCalculada[];
  subtotal: number;
};

function CategoriaApuTable({
  grupo,
  moneda,
  costoDirecto,
  mostrarPareto,
}: {
  grupo: GrupoCategoria;
  moneda: string;
  costoDirecto: number;
  mostrarPareto: boolean;
}) {
  const { meta, filas, subtotal } = grupo;
  const Icon = meta.icon;

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/30">
      <div
        className={`flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3 ${meta.header}`}
      >
        <div className="flex items-center gap-2">
          <span className="text-lg" aria-hidden>
            {meta.emoji}
          </span>
          <Icon className="h-4 w-4 text-zinc-400" aria-hidden />
          <h3 className="text-sm font-bold text-white">{meta.label}</h3>
          <span className="text-xs text-zinc-500">({filas.length})</span>
        </div>
        <p className="text-sm font-semibold tabular-nums text-zinc-200">
          Subtotal: {fmtMoney(subtotal, moneda)}
          <span className="ml-2 text-xs font-normal text-zinc-500">
            {fmtPct(costoDirecto > 0 ? (subtotal / costoDirecto) * 100 : 0)} del CD
          </span>
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-xs">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/80 text-[10px] uppercase tracking-wider text-zinc-500">
              <th className="px-3 py-2.5 font-semibold">Código</th>
              <th className="px-3 py-2.5 font-semibold min-w-[200px]">Descripción</th>
              <th className="px-3 py-2.5 font-semibold text-center">Tipo</th>
              <th className="px-3 py-2.5 font-semibold text-right">Rendimiento</th>
              <th className="px-3 py-2.5 font-semibold text-right">P. base</th>
              <th className="px-3 py-2.5 font-semibold text-right">Desp. %</th>
              <th className="px-3 py-2.5 font-semibold text-right">Costo total</th>
              <th className="px-3 py-2.5 font-semibold text-right">% CD</th>
              {mostrarPareto ? (
                <th className="px-3 py-2.5 font-semibold text-right">Pareto acum.</th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {filas.map((row) => (
              <tr
                key={row.lineaId}
                className={[
                  'border-b border-zinc-800/80 transition-colors hover:bg-white/[0.03]',
                  row.esPareto80 && mostrarPareto ? 'bg-amber-500/[0.06]' : '',
                ].join(' ')}
              >
                <td className="px-3 py-2.5 font-mono text-zinc-400">{row.codigo}</td>
                <td className="px-3 py-2.5 text-zinc-200 max-w-[280px]">
                  <span className="line-clamp-2" title={row.descripcion}>
                    {row.descripcion}
                  </span>
                  <span className="text-[10px] text-zinc-600"> · {row.unidad}</span>
                </td>
                <td className="px-3 py-2.5 text-center">
                  <span
                    className={`inline-flex rounded-md border px-2 py-0.5 text-[10px] font-semibold ${meta.badge}`}
                  >
                    {row.tipoRaw}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-zinc-300">
                  {fmtNum(row.rendimiento)}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-zinc-300">
                  {fmtMoney(row.precioBase, moneda)}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-zinc-400">
                  {row.categoria === 'material' ? fmtPct(row.desperdicioPct) : '—'}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-white">
                  {fmtMoney(row.costoTotal, moneda)}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-zinc-400">
                  {fmtPct(row.pctDelCostoDirecto)}
                </td>
                {mostrarPareto ? (
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    <span
                      className={
                        row.esPareto80 ? 'font-semibold text-amber-400' : 'text-zinc-500'
                      }
                    >
                      {fmtPct(row.pctAcumuladoPareto)}
                    </span>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-zinc-900/60">
              <td
                colSpan={6}
                className="px-3 py-2 text-right text-[10px] font-semibold uppercase text-zinc-500"
              >
                Subtotal {meta.label}
              </td>
              <td className="px-3 py-2" />
              <td className="px-3 py-2 text-right font-bold tabular-nums text-zinc-100">
                {fmtMoney(subtotal, moneda)}
              </td>
              <td className="px-3 py-2" />
              {mostrarPareto ? <td className="px-3 py-2" /> : null}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
