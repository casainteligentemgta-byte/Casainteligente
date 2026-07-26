'use client';

import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import PsiqueCargoPanel from '@/components/rrhh/reclutamiento/PsiqueCargoPanel';
import {
  PSIQUE_DESCRIPCION,
  PSIQUE_NOMBRE,
  PSIQUE_NOMBRE_MITOLOGICO,
} from '@/lib/talento/psique/identidad';

type Props = {
  mostrarEnlaceRrhh?: boolean;
  className?: string;
};

/** Panel Psique reutilizable (Legal / RRHH): listas de cargos + IA. */
export default function PsiqueRecomendarClient({
  mostrarEnlaceRrhh = true,
  className = '',
}: Props) {
  return (
    <div
      className={`rounded-2xl border border-violet-500/25 bg-violet-950/20 p-5 ${className}`.trim()}
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white">
            {PSIQUE_NOMBRE}{' '}
            <span className="text-sm font-semibold text-violet-300/80">
              ({PSIQUE_NOMBRE_MITOLOGICO})
            </span>
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-zinc-400">{PSIQUE_DESCRIPCION}</p>
        </div>
        {mostrarEnlaceRrhh ? (
          <Link
            href="/rrhh/reclutamiento"
            className="inline-flex items-center gap-1 text-xs font-semibold text-violet-300 hover:text-violet-200"
          >
            Abrir en RRHH <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        ) : null}
      </div>
      <PsiqueCargoPanel />
    </div>
  );
}
