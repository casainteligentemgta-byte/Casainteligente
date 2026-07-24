'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import TrazabilidadEstrategicaClient from '@/app/almacen/trazabilidad/TrazabilidadEstrategicaClient';
import TrazabilidadMaterialClient from '@/app/almacen/trazabilidad/TrazabilidadMaterialClient';

function TrazabilidadKardexInner() {
  const searchParams = useSearchParams();
  const materialId = searchParams.get('materialId')?.trim();

  if (materialId) {
    return <TrazabilidadMaterialClient />;
  }

  return <TrazabilidadEstrategicaClient />;
}

export default function TrazabilidadKardex() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center gap-2 py-16 text-zinc-500 text-sm">
          <Loader2 className="animate-spin text-[#FF9500]" size={20} />
          Cargando trazabilidad…
        </div>
      }
    >
      <TrazabilidadKardexInner />
    </Suspense>
  );
}
