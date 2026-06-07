'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import TrazabilidadEstrategicaClient from './TrazabilidadEstrategicaClient';
import TrazabilidadMaterialClient from './TrazabilidadMaterialClient';
import { Loader2 } from 'lucide-react';

function TrazabilidadRouter() {
  const searchParams = useSearchParams();
  const materialId = searchParams.get('materialId')?.trim();

  if (materialId) {
    return <TrazabilidadMaterialClient />;
  }

  return <TrazabilidadEstrategicaClient />;
}

export default function TrazabilidadPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-black flex items-center justify-center text-zinc-500 gap-2">
          <Loader2 className="animate-spin text-[#FF9500]" size={22} />
          Cargando trazabilidad…
        </div>
      }
    >
      <TrazabilidadRouter />
    </Suspense>
  );
}
