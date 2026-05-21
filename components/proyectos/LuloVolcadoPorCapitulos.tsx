'use client';

import { useMemo } from 'react';
import {
  agruparFilasMdbPartidasPorCapitulos,
  type GrupoCapituloFilas,
} from '@/lib/proyectos/luloCapitulos';
import type { LuloMdbFullDump, LuloMdbTableDump } from '@/lib/proyectos/extractLuloFull';
import LuloTablaFiltrable, { type LuloColumnaDef } from '@/components/proyectos/LuloTablaFiltrable';

type Props = {
  dump: LuloMdbFullDump;
  tablaPartidas: LuloMdbTableDump;
  columnas: LuloColumnaDef[];
};

export default function LuloVolcadoPorCapitulos({ dump, tablaPartidas, columnas }: Props) {
  const grupos: GrupoCapituloFilas[] = useMemo(
    () => agruparFilasMdbPartidasPorCapitulos(dump, tablaPartidas),
    [dump, tablaPartidas],
  );

  if (grupos.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        No se pudo agrupar por capítulos. Revisa la tabla CAPITULOS o el campo Cod_Cap en PARTIDAS.
      </p>
    );
  }

  const totalFilas = grupos.reduce((s, g) => s + g.partidas.length, 0);

  return (
    <div className="space-y-4">
      <p className="text-[11px] text-zinc-500">
        {grupos.length} capítulos · {totalFilas} partidas (orden Lulo)
      </p>
      {grupos.map((grupo) => (
        <div key={grupo.capitulo.codigo} className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-500/30 bg-amber-950/30 px-3 py-2">
            <h4 className="text-xs font-semibold text-amber-100">
              Cap. {grupo.capitulo.codigo} — {grupo.capitulo.descripcion}
            </h4>
            <span className="text-[11px] font-mono text-amber-200/80">
              {grupo.partidas.length} partidas
            </span>
          </div>
          <LuloTablaFiltrable
            columnas={columnas}
            filas={grupo.partidas}
            vacio="Sin partidas en este capítulo."
            mostrarFiltros={false}
            maxFilasVisibles={500}
          />
        </div>
      ))}
    </div>
  );
}
