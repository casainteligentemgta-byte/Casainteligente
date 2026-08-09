'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { RrhhAlcanceState } from '@/lib/rrhh/rrhhAlcance';
import { hrefRrhhConAlcance, itemVisibleEnAlcance } from '@/lib/rrhh/rrhhNav';
import { RRHH_PIPELINE_PASOS } from '@/lib/rrhh/rrhhPipeline';

type Props = {
  alcance: RrhhAlcanceState;
  className?: string;
};

/**
 * Puente del flujo RRHH unificado:
 * Plaza → Candidato (nuevo | banca) → Evaluación → Contrato → Expediente → Nómina → Egreso.
 */
export default function RrhhFlujoPuente({ alcance, className = '' }: Props) {
  const pasos = RRHH_PIPELINE_PASOS.filter((p) => itemVisibleEnAlcance(p, alcance.mode));

  if (pasos.length === 0) return null;

  return (
    <section
      className={`mb-6 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 ${className}`.trim()}
      aria-label="Flujo RRHH unificado"
    >
      <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
        Flujo unificado
      </p>

      {alcance.mode === 'obra' ? (
        <div className="mb-3 flex flex-wrap gap-2">
          <Link
            href={hrefRrhhConAlcance('/rrhh/gestion-personal', alcance)}
            className="rounded-md border border-amber-400/35 bg-amber-500/15 px-2.5 py-1.5 text-[11px] font-bold text-amber-50 transition hover:border-amber-300/50"
          >
            Puerta nuevo · HV / test
          </Link>
          <Link
            href={hrefRrhhConAlcance('/rrhh/banca', { ...alcance, mode: 'entidad' })}
            className="rounded-md border border-sky-400/35 bg-sky-500/15 px-2.5 py-1.5 text-[11px] font-bold text-sky-50 transition hover:border-sky-300/50"
          >
            Puerta banca · ofertar plaza
          </Link>
        </div>
      ) : null}

      <ol className="flex flex-wrap items-center gap-1.5">
        {pasos.map((paso, i) => (
          <li key={paso.id} className="flex items-center gap-1.5">
            {i > 0 ? (
              <ChevronRight className="size-3.5 shrink-0 text-zinc-600" aria-hidden />
            ) : null}
            <Link
              href={hrefRrhhConAlcance(paso.href, alcance)}
              title={paso.ayuda}
              className="rounded-md border border-white/10 bg-zinc-950/60 px-2.5 py-1.5 text-xs font-semibold text-zinc-200 transition hover:border-pink-400/40 hover:text-white"
            >
              {paso.label}
            </Link>
          </li>
        ))}
      </ol>
      <p className="mt-2 text-[11px] text-zinc-500">
        {alcance.mode === 'obra'
          ? 'Nuevo o banca → evaluación → contrato (firmar obrero + compañía → cargar escaneo → formalizar) → carnet → expediente → nómina.'
          : 'Dirección: banca y evaluación, expedientes, carnet, nómina semanal, parafiscales y egreso (liquidación / PS).'}
      </p>
    </section>
  );
}
