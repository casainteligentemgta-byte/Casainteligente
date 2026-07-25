'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import PhemeMinutaClient from '@/components/pheme/PhemeMinutaClient';
import PhemeReunionesClient from '@/components/pheme/PhemeReunionesClient';

type Tab = 'minuta' | 'reuniones';

function PhemeTabs() {
  const sp = useSearchParams();
  const initial: Tab = sp.get('tab') === 'reuniones' ? 'reuniones' : 'minuta';
  const [tab, setTab] = useState<Tab>(initial);

  return (
    <main className="pb-24">
      <div className="mx-auto max-w-4xl px-4 pt-4">
        <div className="mb-4 flex gap-2">
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
      </div>
      {tab === 'minuta' ? <PhemeMinutaClient /> : <PhemeReunionesClient />}
    </main>
  );
}

export default function PhemePage() {
  return (
    <Suspense fallback={<main className="px-4 py-8 text-sm text-zinc-500">Cargando Pheme…</main>}>
      <PhemeTabs />
    </Suspense>
  );
}
