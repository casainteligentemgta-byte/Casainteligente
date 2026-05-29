'use client';

import { Suspense } from 'react';
import RecepcionCampoClient from '@/app/almacen/recepcion/RecepcionCampoClient';

function RecepcionFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0A0A0F] text-sm text-zinc-500">
      Cargando recepción de materiales…
    </div>
  );
}

export default function RecepcionAlmacenPage() {
  return (
    <Suspense fallback={<RecepcionFallback />}>
      <RecepcionCampoClient />
    </Suspense>
  );
}
