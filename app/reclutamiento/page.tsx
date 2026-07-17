'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import ReclutamientoEntrevistaClient from '@/components/reclutamiento/ReclutamientoEntrevistaClient';

/**
 * /reclutamiento
 * - Con ?need= / ?session= / ?empleado_id= → entrevista pública del candidato.
 * - Sin esos params → inicio CRM (el hub de staff vive en /rrhh/reclutamiento).
 */
function ReclutamientoEntry() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const need = searchParams.get('need')?.trim() || '';
  const session = searchParams.get('session')?.trim() || '';
  const empleadoId = searchParams.get('empleado_id')?.trim() || '';
  const esFlujoPublico = Boolean(need || session || empleadoId);

  useEffect(() => {
    if (!esFlujoPublico) {
      router.replace('/');
    }
  }, [esFlujoPublico, router]);

  if (!esFlujoPublico) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-zinc-400">
        Redirigiendo al inicio…
      </div>
    );
  }

  return <ReclutamientoEntrevistaClient />;
}

export default function ReclutamientoPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-sm text-zinc-400">
          Cargando…
        </div>
      }
    >
      <ReclutamientoEntry />
    </Suspense>
  );
}
