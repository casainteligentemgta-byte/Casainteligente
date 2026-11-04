'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, Loader2, RefreshCw } from 'lucide-react';
import { etiquetaFuenteManoObra } from '@/lib/proyectos/costoObra/reglasCostoObra';
import type { CostoObraDetalleItem, CostoObraPayload } from '@/lib/proyectos/costoObra/tipos';
import { formatApiErrorBody, formatErrorMessage } from '@/lib/utils/formatErrorMessage';
import { parseFetchJson } from '@/lib/utils/parseFetchJson';

type Props = {
  proyectoId: string;
  className?: string;
};

function fmtUsd(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

const PARTIDAS: Array<{
  key: 'materiales' | 'mano_obra' | 'herramientas' | 'otros';
  titulo: string;
  ayuda: string;
  color: string;
}> = [
  {
    key: 'materiales',
    titulo: 'Materiales',
    ayuda: 'Facturas de la obra. Lo que ya se compró para esta obra no se vuelve a sumar al sacarlo del almacén de la obra. Si vino de otro almacén, sí cuenta.',
    color: 'border-sky-500/35 bg-sky-950/25',
  },
  {
    key: 'mano_obra',
    titulo: 'Mano de obra',
    ayuda: 'Nómina pagada. Si esa semana no se pagó nómina, se usan los jornales. Nunca se suman las dos cosas a la misma persona en la misma semana.',
    color: 'border-amber-500/35 bg-amber-950/25',
  },
  {
    key: 'herramientas',
    titulo: 'Herramientas y equipos',
    ayuda: 'Días que la herramienta estuvo en esta obra, por el costo por día (o el arriendo).',
    color: 'border-violet-500/35 bg-violet-950/25',
  },
  {
    key: 'otros',
    titulo: 'Otros gastos',
    ayuda: 'Gastos sueltos de la obra (viáticos, gestiones, etc.).',
    color: 'border-zinc-500/35 bg-zinc-900/40',
  },
];

function usdDePartida(data: CostoObraPayload, key: (typeof PARTIDAS)[number]['key']): number {
  return data.partidas[key].usd;
}

function detalleDePartida(data: CostoObraPayload, key: (typeof PARTIDAS)[number]['key']): CostoObraDetalleItem[] {
  return data.partidas[key].detalle;
}

function subDePartida(data: CostoObraPayload, key: (typeof PARTIDAS)[number]['key']): string {
  if (key === 'materiales') {
    const m = data.partidas.materiales;
    return `Compras ${fmtUsd(m.compras_usd)} · de otro almacén ${fmtUsd(m.egresos_ajenos_usd)}`;
  }
  if (key === 'mano_obra') {
    return etiquetaFuenteManoObra(data.partidas.mano_obra.fuente);
  }
  if (key === 'otros') {
    const o = data.partidas.otros;
    return `Gastos ${fmtUsd(o.gastos_obra_usd)} · libro CCO ${fmtUsd(o.registros_gastos_usd)}`;
  }
  return 'Uso o arriendo asignado a esta obra';
}

export default function CostoObraPanel({ proyectoId, className = '' }: Props) {
  const [data, setData] = useState<CostoObraPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [abierta, setAbierta] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/proyectos/${encodeURIComponent(proyectoId)}/costo`, {
        cache: 'no-store',
      });
      const json = await parseFetchJson<CostoObraPayload & { error?: string }>(res);
      if (!res.ok) throw new Error(formatApiErrorBody(json, 'No se pudo cargar el costo de la obra'));
      setData(json);
    } catch (e) {
      setError(formatErrorMessage(e));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [proyectoId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className={`rounded-2xl border border-white/10 bg-zinc-900/70 p-4 shadow-lg sm:p-5 ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Centro de costo</p>
          <h2 className="mt-1 text-lg font-black text-zinc-50 sm:text-xl">Costo de la obra</h2>
          <p className="mt-1 max-w-xl text-xs text-zinc-400">
            Cuánto ha costado esta obra, en dólares, en cuatro cuentas simples.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-zinc-300 hover:bg-white/[0.08]"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Actualizar
        </button>
      </div>

      {loading ? (
        <p className="mt-6 flex items-center gap-2 text-sm text-zinc-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Sumando costos…
        </p>
      ) : error ? (
        <p className="mt-4 rounded-xl border border-red-800/40 bg-red-950/30 px-3 py-3 text-sm text-red-200">{error}</p>
      ) : data?.excluido_demo ? (
        <p className="mt-4 rounded-xl border border-zinc-700 bg-zinc-950/50 px-3 py-3 text-sm text-zinc-400">
          Esta es una obra de demostración. No entra en el costo real.
        </p>
      ) : data ? (
        <>
          <div className="mt-5 rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400/80">Total de la obra</p>
            <p className="mt-1 text-3xl font-black tabular-nums text-zinc-50">{fmtUsd(data.total_directo_usd)}</p>
            <p className="mt-1 text-xs text-zinc-400">
              Las cuatro cuentas. Honorarios AD van aparte
              {data.honorarios_ad.pct === 0
                ? ' (esta obra tiene 0 %).'
                : ` (${data.honorarios_ad.pct}% = ${fmtUsd(data.honorarios_ad.usd)}).`}
            </p>
            {data.honorarios_ad.pct > 0 ? (
              <p className="mt-2 text-sm font-semibold text-emerald-100">
                Con honorarios AD: {fmtUsd(data.total_con_honorarios_ad_usd)}
              </p>
            ) : null}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {PARTIDAS.map((p) => {
              const abiertaEsta = abierta === p.key;
              const detalle = detalleDePartida(data, p.key);
              return (
                <div key={p.key} className={`rounded-2xl border p-4 ${p.color}`}>
                  <p className="text-sm font-bold text-zinc-100">{p.titulo}</p>
                  <p className="mt-1 text-2xl font-black tabular-nums text-white">{fmtUsd(usdDePartida(data, p.key))}</p>
                  <p className="mt-1 text-[11px] text-zinc-400">{subDePartida(data, p.key)}</p>
                  <button
                    type="button"
                    onClick={() => setAbierta(abiertaEsta ? null : p.key)}
                    className="mt-3 inline-flex min-h-11 w-full items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-left text-xs font-semibold text-zinc-200"
                    aria-expanded={abiertaEsta}
                  >
                    {abiertaEsta ? 'Ocultar detalle' : 'Ver de qué se trata'}
                    <ChevronDown className={`h-4 w-4 transition ${abiertaEsta ? 'rotate-180' : ''}`} />
                  </button>
                  {abiertaEsta ? (
                    <div className="mt-3 space-y-2">
                      <p className="text-[11px] leading-relaxed text-zinc-400">{p.ayuda}</p>
                      {detalle.length === 0 ? (
                        <p className="text-xs text-zinc-500">Todavía no hay movimientos en esta cuenta.</p>
                      ) : (
                        <ul className="space-y-1.5">
                          {detalle.map((d, i) => (
                            <li
                              key={`${d.tipo}-${d.id ?? i}`}
                              className="flex items-start justify-between gap-2 rounded-lg bg-black/25 px-2.5 py-2 text-xs"
                            >
                              <span className="min-w-0 text-zinc-200">{d.label}</span>
                              <span className="shrink-0 font-mono tabular-nums text-zinc-100">{fmtUsd(d.usd)}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </>
      ) : null}
    </section>
  );
}
