'use client';

import { Table2 } from 'lucide-react';
import type { LuloMdbTable } from '@/lib/proyectos/lulo/luloProyectoTypes';
import { esTablaPartidasMdb } from '@/lib/proyectos/lulo/luloProyectoTypes';

type Props = {
  tablas: LuloMdbTable[];
  tablaActiva: string;
  onSeleccionar: (nombre: string) => void;
};

export default function LuloCatalogoTablasMdb({ tablas, tablaActiva, onSeleccionar }: Props) {
  if (tablas.length === 0) return null;

  const filasTotales = tablas.reduce((s, t) => s + t.rowCount, 0);

  return (
    <div className="rounded-xl border border-white/10 bg-zinc-900/60 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase text-zinc-500 flex items-center gap-1.5">
          <Table2 className="h-3.5 w-3.5 text-sky-400" />
          Catálogo Access ({tablas.length} tablas · {filasTotales.toLocaleString()} filas)
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 max-h-[280px] overflow-y-auto pr-1">
        {tablas.map((t) => {
          const activa = t.name === tablaActiva;
          const esPartidas = esTablaPartidasMdb(t.name);
          return (
            <button
              key={t.name}
              type="button"
              onClick={() => onSeleccionar(t.name)}
              className={`text-left rounded-lg border px-3 py-2 transition-colors ${
                activa
                  ? 'border-sky-500/50 bg-sky-950/40'
                  : 'border-white/10 bg-black/30 hover:border-white/20 hover:bg-white/5'
              }`}
            >
              <p className="text-xs font-mono font-semibold text-zinc-200 truncate" title={t.name}>
                {t.name}
                {esPartidas ? (
                  <span className="ml-1 text-[9px] uppercase text-amber-400/90">· partidas</span>
                ) : null}
              </p>
              <p className="text-[10px] text-zinc-500 mt-0.5">
                {t.rowCount.toLocaleString()} filas · {t.columns.length} columnas
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
