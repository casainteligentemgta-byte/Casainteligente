'use client';

import { useMemo, useState } from 'react';
import { Search, Filter } from 'lucide-react';
import { filtrarFilasLulo, valorCeldaLulo } from '@/lib/proyectos/luloTablaFiltros';

export type LuloColumnaDef = {
  key: string;
  label: string;
  align?: 'left' | 'right' | 'center';
  mono?: boolean;
  /** Ancho máximo con truncate en celdas de solo lectura */
  maxWidth?: number;
};

type Props = {
  titulo?: string;
  columnas: LuloColumnaDef[];
  filas: Record<string, unknown>[];
  vacio?: string;
  maxFilasVisibles?: number;
  /** Render personalizado por fila (p. ej. botones editar) */
  renderFila?: (row: Record<string, unknown>, index: number) => React.ReactNode;
  className?: string;
  /** Barra de búsqueda por columna (desactivar en tablas agrupadas secundarias). */
  mostrarFiltros?: boolean;
};

export default function LuloTablaFiltrable({
  titulo,
  columnas,
  filas,
  vacio = 'Sin filas que coincidan.',
  maxFilasVisibles = 1000,
  renderFila,
  className = '',
  mostrarFiltros = true,
}: Props) {
  const [busqueda, setBusqueda] = useState('');
  const [columnaFiltro, setColumnaFiltro] = useState('');

  const keys = useMemo(() => columnas.map((c) => c.key), [columnas]);

  const filtradas = useMemo(
    () => filtrarFilasLulo(filas, keys, busqueda, columnaFiltro || undefined),
    [filas, keys, busqueda, columnaFiltro],
  );

  const visibles = filtradas.slice(0, maxFilasVisibles);
  const truncadas = filtradas.length > maxFilasVisibles;

  return (
    <div className={`space-y-3 ${className}`.trim()}>
      {titulo ? <h3 className="text-sm font-semibold text-zinc-300">{titulo}</h3> : null}

      {mostrarFiltros ? (
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar en la tabla…"
            className="w-full rounded-lg border border-white/10 bg-black/40 py-2 pl-8 pr-3 text-xs text-white placeholder:text-zinc-600 focus:border-sky-500/40 focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <Filter className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
          <select
            value={columnaFiltro}
            onChange={(e) => setColumnaFiltro(e.target.value)}
            className="rounded-lg border border-white/10 bg-black/40 px-2 py-2 text-xs text-zinc-300 focus:border-sky-500/40 focus:outline-none max-w-[180px]"
          >
            <option value="">Todas las columnas</option>
            {columnas.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <span className="text-[11px] text-zinc-500 whitespace-nowrap">
          {filtradas.length} de {filas.length} filas
          {busqueda ? ' (filtrado)' : ''}
        </span>
        {busqueda || columnaFiltro ? (
          <button
            type="button"
            onClick={() => {
              setBusqueda('');
              setColumnaFiltro('');
            }}
            className="text-[11px] text-sky-400 hover:text-sky-300"
          >
            Limpiar filtros
          </button>
        ) : null}
      </div>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-white/10 max-h-[min(70vh,640px)] overflow-y-auto">
        <table className="w-full text-xs border-collapse">
          <thead className="sticky top-0 z-10 bg-zinc-900/95 backdrop-blur-sm">
            <tr className="text-zinc-500 border-b border-white/10">
              {columnas.map((c) => (
                <th
                  key={c.key}
                  className={`px-3 py-2 font-semibold whitespace-nowrap ${
                    c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left'
                  }`}
                >
                  {c.label}
                </th>
              ))}
              {renderFila ? <th className="px-3 py-2 w-16" /> : null}
            </tr>
          </thead>
          <tbody>
            {visibles.length === 0 ? (
              <tr>
                <td
                  colSpan={columnas.length + (renderFila ? 1 : 0)}
                  className="px-4 py-8 text-center text-sm text-zinc-500"
                >
                  {filas.length === 0 ? vacio : 'Ninguna fila coincide con el filtro.'}
                </td>
              </tr>
            ) : renderFila ? (
              visibles.map((row, i) => renderFila(row, i))
            ) : (
              visibles.map((row, i) => (
                <tr key={i} className="border-t border-white/5 hover:bg-white/[0.02]">
                  {columnas.map((c) => (
                    <td
                      key={c.key}
                      className={`px-3 py-2 ${
                        c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left'
                      } ${c.mono ? 'font-mono text-zinc-400' : ''}`}
                      style={c.maxWidth ? { maxWidth: c.maxWidth } : undefined}
                      title={valorCeldaLulo(row, c.key)}
                    >
                      <span className={c.maxWidth ? 'block truncate' : ''}>
                        {valorCeldaLulo(row, c.key) || '—'}
                      </span>
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {truncadas ? (
        <p className="text-[11px] text-zinc-600">
          Mostrando las primeras {maxFilasVisibles} de {filtradas.length} filas filtradas. Afina la búsqueda
          para ver menos resultados.
        </p>
      ) : null}
    </div>
  );
}
