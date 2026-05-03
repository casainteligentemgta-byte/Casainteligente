'use client';

import { useMemo, useState } from 'react';
import { CARGOS_OBREROS, cargosAgrupadosPorNivel } from '@/lib/constants/cargosObreros';
import {
  NOTAS_NIVEL_REQUISITOS_GACETA,
  fichaRequisitosPorCodigo,
  type FichaRequisitosOficio,
} from '@/lib/constants/requisitosOficiosGaceta';

function norm(s: string) {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function BloqueFicha({ ficha }: { ficha: FichaRequisitosOficio }) {
  if (ficha.estado === 'sin_descripcion_fuente') {
    return (
      <p className="text-xs text-zinc-500 leading-relaxed mt-2 pl-2 border-l-2 border-zinc-600">
        Sin descripción técnica (instrucción / experiencia / conocimientos / tareas) en el texto de referencia de
        gaceta aportado al proyecto. Consultar el tabulador o normativa oficial vigente.
      </p>
    );
  }
  if (ficha.estado === 'no_en_resumen') {
    return (
      <p className="text-xs text-zinc-500 leading-relaxed mt-2 pl-2 border-l-2 border-amber-700/50">
        Oficio listado en el tabulador de la convención cargado en el sistema; el resumen de requisitos de gaceta
        del proyecto no incluye ficha detallada para este código. Verificar en la G.O.E. / convención oficial.
      </p>
    );
  }
  const rows: { k: string; v: string }[] = [];
  if (ficha.instruccion) rows.push({ k: 'Instrucción', v: ficha.instruccion });
  if (ficha.experiencia) rows.push({ k: 'Experiencia', v: ficha.experiencia });
  if (ficha.conocimientos) rows.push({ k: 'Conocimientos', v: ficha.conocimientos });
  if (ficha.tareas) rows.push({ k: 'Tareas', v: ficha.tareas });
  return (
    <dl className="mt-2 space-y-2 text-xs pl-2 border-l-2 border-sky-800/60">
      {rows.map(({ k, v }) => (
        <div key={k}>
          <dt className="text-[10px] uppercase tracking-wide text-zinc-500">{k}</dt>
          <dd className="text-zinc-300 leading-relaxed">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function GacetaOficiosReferencia() {
  const [q, setQ] = useState('');
  const niveles = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

  const filtrados = useMemo(() => {
    const t = q.trim();
    if (!t) return [...CARGOS_OBREROS];
    const n = norm(t);
    return CARGOS_OBREROS.filter(
      (c) => norm(c.nombre).includes(n) || c.codigo.includes(t) || c.codigo.replace('.', ',').includes(t),
    );
  }, [q]);

  const grupos = useMemo(() => cargosAgrupadosPorNivel(filtrados), [filtrados]);

  const nivelesAbiertosPorBusqueda = useMemo(() => {
    if (!q.trim()) return null;
    return new Set(filtrados.map((c) => c.nivel));
  }, [q, filtrados]);

  const detalladas = useMemo(
    () => filtrados.filter((c) => fichaRequisitosPorCodigo(c.codigo).estado === 'detallada').length,
    [filtrados],
  );

  return (
    <section className="rounded-2xl border border-zinc-700 bg-zinc-900/40 p-4 mb-8 space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-white">Estructura de oficios y requisitos (referencia gaceta)</h2>
        <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
          Texto de referencia según la estructura de oficios y requisitos aportada (Gaceta Oficial / tabulador de
          construcción). Sirve para revisar instrucción, experiencia, conocimientos y tareas alineados al código del
          tabulador. Donde no hay ficha en el resumen, el oficio sigue existiendo en el tabulador del sistema.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-[11px] text-zinc-500">
        <span>
          Mostrando <span className="text-zinc-300">{filtrados.length}</span> de {CARGOS_OBREROS.length} oficios
          {q.trim() ? '' : ` · ${detalladas} con ficha detallada en el resumen`}.
        </span>
      </div>

      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar por código o nombre…"
        autoComplete="off"
        className="w-full rounded-xl bg-zinc-950 border border-zinc-600 px-3 py-2 text-sm text-white placeholder:text-zinc-600"
      />

      <div className="space-y-2 max-h-[min(70vh,520px)] overflow-y-auto pr-1">
        {niveles.map((nv) => {
          const lista = grupos.get(nv);
          if (!lista?.length) return null;
          const nota = NOTAS_NIVEL_REQUISITOS_GACETA[nv];
          return (
            <details
              key={nv}
              className="rounded-xl border border-zinc-800 bg-zinc-950/50 open:border-zinc-600"
              open={
                nivelesAbiertosPorBusqueda
                  ? nivelesAbiertosPorBusqueda.has(nv)
                  : nv <= 2
              }
            >
              <summary className="cursor-pointer select-none px-3 py-2.5 text-sm text-zinc-200 font-medium list-inside">
                Nivel {nv} <span className="text-zinc-500 font-normal">({lista.length})</span>
              </summary>
              <div className="px-3 pb-3 pt-0 space-y-2 border-t border-zinc-800/80">
                {nota ? (
                  <p className="text-[11px] text-amber-200/90 bg-amber-950/25 border border-amber-800/30 rounded-lg px-2 py-1.5 leading-relaxed">
                    {nota}
                  </p>
                ) : null}
                <ul className="space-y-1">
                  {lista.map((c) => {
                    const ficha = fichaRequisitosPorCodigo(c.codigo);
                    return (
                      <li key={c.codigo} className="rounded-lg border border-zinc-800/90 bg-black/20">
                        <details className="group">
                          <summary className="cursor-pointer px-2 py-1.5 text-xs text-zinc-200 list-inside marker:text-zinc-500">
                            <span className="font-mono text-sky-400/95">{c.codigo}</span>{' '}
                            <span className="text-zinc-300">{c.nombre}</span>
                            {ficha.estado === 'detallada' ? (
                              <span className="ml-1 text-[10px] text-emerald-500/90">· ficha</span>
                            ) : ficha.estado === 'sin_descripcion_fuente' ? (
                              <span className="ml-1 text-[10px] text-zinc-500">· sin texto en resumen</span>
                            ) : (
                              <span className="ml-1 text-[10px] text-zinc-600">· tabulador</span>
                            )}
                          </summary>
                          <div className="px-2 pb-2">
                            <BloqueFicha ficha={ficha} />
                          </div>
                        </details>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </details>
          );
        })}
      </div>
    </section>
  );
}
