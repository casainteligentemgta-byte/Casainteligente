'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import PhemeMinutaClient from '@/components/pheme/PhemeMinutaClient';
import PhemeReunionesClient from '@/components/pheme/PhemeReunionesClient';
import { PHEME_NOMBRE } from '@/lib/pheme/identidad';

type Tab = 'minuta' | 'reuniones';

type Props = {
  /** Enlace a la ruta standalone `/pheme`. */
  mostrarEnlaceStandalone?: boolean;
  className?: string;
};

function PhemeTabsInner({ mostrarEnlaceStandalone = false, className = '' }: Props) {
  const sp = useSearchParams();
  const initial: Tab = sp.get('tab') === 'reuniones' ? 'reuniones' : 'minuta';
  const [tab, setTab] = useState<Tab>(initial);

  return (
    <div className={className}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setTab('minuta')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              tab === 'minuta'
                ? 'bg-violet-500/20 text-violet-200 ring-1 ring-violet-500/40'
                : 'bg-white/5 text-zinc-400 hover:bg-white/10'
            }`}
          >
            Minuta rápida
          </button>
          <button
            type="button"
            onClick={() => setTab('reuniones')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              tab === 'reuniones'
                ? 'bg-violet-500/20 text-violet-200 ring-1 ring-violet-500/40'
                : 'bg-white/5 text-zinc-400 hover:bg-white/10'
            }`}
          >
            Reuniones + embeddings
          </button>
        </div>
        {mostrarEnlaceStandalone ? (
          <Link
            href="/pheme"
            className="inline-flex items-center gap-1 text-xs font-semibold text-violet-300 hover:text-violet-200"
          >
            Abrir {PHEME_NOMBRE} completo <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        ) : null}
      </div>
      {tab === 'minuta' ? <PhemeMinutaClient /> : <PhemeReunionesClient />}
    </div>
  );
}

export default function PhemeTabsClient(props: Props) {
  return (
    <Suspense
      fallback={<p className="py-8 text-sm text-zinc-500">Cargando {PHEME_NOMBRE}…</p>}
    >
      <PhemeTabsInner {...props} />
    </Suspense>
  );
}
