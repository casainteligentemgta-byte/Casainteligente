'use client';

import { Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import AlmacenCuadroNav, { type CuadroAlmacen } from '@/components/almacen/AlmacenCuadroNav';
import InventarioCuadro from '@/components/almacen/InventarioCuadro';
import MovimientosCuadro from '@/components/almacen/MovimientosCuadro';
import TrazabilidadKardex from '@/components/almacen/TrazabilidadKardex';

function parseCuadro(raw: string | null): CuadroAlmacen {
  if (raw === 'movimientos' || raw === 'trazabilidad' || raw === 'inventario') return raw;
  return 'inventario';
}

function AlmacenHubInner() {
  const searchParams = useSearchParams();
  const cuadro = parseCuadro(searchParams.get('cuadro'));
  const searchString = useMemo(() => searchParams.toString(), [searchParams]);

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white">
      <div className="px-3 py-4 sm:px-4 lg:px-5 max-w-[100vw] overflow-x-hidden">
        <AlmacenCuadroNav activo={cuadro} search={searchString} />
        {cuadro === 'inventario' ? <InventarioCuadro /> : null}
        {cuadro === 'movimientos' ? <MovimientosCuadro /> : null}
        {cuadro === 'trazabilidad' ? <TrazabilidadKardex /> : null}
      </div>
    </div>
  );
}

export default function AlmacenPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center text-zinc-500 gap-2">
          <Loader2 className="animate-spin text-[#FF9500]" size={22} />
          Cargando almacén…
        </div>
      }
    >
      <AlmacenHubInner />
    </Suspense>
  );
}
