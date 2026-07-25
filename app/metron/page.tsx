'use client';

import { Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import MetronPlanosClient from '@/components/metron/MetronPlanosClient';
import { METRON_NOMBRE, METRON_TAGLINE } from '@/lib/metron/identidad';

function MetronPageInner() {
  const sp = useSearchParams();
  const proyectoId = (sp.get('proyectoId') || sp.get('proyecto_id') || '').trim();
  const planoId = (sp.get('planoId') || sp.get('plano_archivo_id') || '').trim();
  const nombreObra = (sp.get('nombre') || '').trim();

  const hint = useMemo(() => {
    if (proyectoId) return null;
    return (
      <div className="rounded-xl border border-white/10 bg-zinc-900/80 p-5 text-sm text-zinc-300">
        <p className="font-semibold text-white">{METRON_NOMBRE}</p>
        <p className="mt-1 text-zinc-500">{METRON_TAGLINE}</p>
        <p className="mt-3 text-xs text-zinc-400">
          Abre Metron desde una obra (Planos → Metron) o pasa{' '}
          <code className="text-amber-400/90">?proyectoId=…</code> en la URL.
        </p>
        <Link
          href="/proyectos/modulo"
          className="mt-4 inline-block text-xs font-semibold text-sky-400 hover:text-sky-300"
        >
          Ir a proyectos →
        </Link>
      </div>
    );
  }, [proyectoId]);

  return (
    <main className="mx-auto max-w-4xl px-4 py-6 pb-28">
      <header className="mb-5">
        <p className="text-[10px] font-bold uppercase tracking-widest text-amber-500/80">Agente</p>
        <h1 className="text-2xl font-bold tracking-tight text-white">{METRON_NOMBRE}</h1>
        <p className="text-sm text-zinc-500">{METRON_TAGLINE}</p>
      </header>
      {hint}
      {proyectoId ? (
        <MetronPlanosClient
          proyectoId={proyectoId}
          nombreObra={nombreObra}
          planoArchivoIdInicial={planoId || null}
        />
      ) : null}
    </main>
  );
}

export default function MetronPage() {
  return (
    <Suspense
      fallback={
        <main className="px-4 py-8 text-sm text-zinc-500">Cargando Metron…</main>
      }
    >
      <MetronPageInner />
    </Suspense>
  );
}
