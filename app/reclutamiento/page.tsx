'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import ReclutamientoEntrevistaClient from '@/components/reclutamiento/ReclutamientoEntrevistaClient';
import ReclutamientoPipelineClient from '@/components/reclutamiento/ReclutamientoPipelineClient';

function ReclutamientoEntry() {
  const searchParams = useSearchParams();
  const need = searchParams.get('need')?.trim();
  const session = searchParams.get('session')?.trim();
  const empleadoId = searchParams.get('empleado_id')?.trim();
  const candidateMode = Boolean(need || session || empleadoId);

  if (candidateMode) {
    return <ReclutamientoEntrevistaClient />;
  }
  return <ReclutamientoPipelineClient />;
}

export default function ReclutamientoPage() {
  return (
    <Suspense
      fallback={
        <div
          className="flex min-h-screen items-center justify-center text-sm text-zinc-400"
          style={{ background: 'var(--bg-primary)' }}
        >
          Cargando reclutamiento…
        </div>
      }
    >
      <ReclutamientoEntry />
    </Suspense>
  );
}
