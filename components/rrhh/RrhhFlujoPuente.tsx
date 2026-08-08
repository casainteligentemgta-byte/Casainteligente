'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { RrhhAlcanceState } from '@/lib/rrhh/rrhhAlcance';
import {
  RRHH_FLUJO_PASOS,
  hrefRrhhConAlcance,
  itemVisibleEnAlcance,
} from '@/lib/rrhh/rrhhNav';

type Props = {
  alcance: RrhhAlcanceState;
  className?: string;
};

/**
 * Puente visual del flujo RRHH: Solicitud → Express → Expediente → Nómina.
 * Los pasos se muestran según el alcance (obra vs Dirección).
 */
export default function RrhhFlujoPuente({ alcance, className = '' }: Props) {
  const pasos = RRHH_FLUJO_PASOS.filter((p) => itemVisibleEnAlcance(p, alcance.mode));

  if (pasos.length === 0) return null;

  return (
    <section
      className={`mb-6 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 ${className}`.trim()}
      aria-label="Flujo RRHH"
    >
      <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
        Flujo
      </p>
      <ol className="flex flex-wrap items-center gap-1.5">
        {pasos.map((paso, i) => (
          <li key={paso.id} className="flex items-center gap-1.5">
            {i > 0 ? (
              <ChevronRight className="size-3.5 shrink-0 text-zinc-600" aria-hidden />
            ) : null}
            <Link
              href={hrefRrhhConAlcance(paso.href, alcance)}
              className="rounded-md border border-white/10 bg-zinc-950/60 px-2.5 py-1.5 text-xs font-semibold text-zinc-200 transition hover:border-pink-400/40 hover:text-white"
            >
              {paso.label}
            </Link>
          </li>
        ))}
      </ol>
      <p className="mt-2 text-[11px] text-zinc-500">
        {alcance.mode === 'obra'
          ? 'En obra: solicite plazas, genere contratos express y archive el expediente.'
          : 'En Dirección: revise expedientes y procese nómina / liquidaciones de la entidad.'}
      </p>
    </section>
  );
}
