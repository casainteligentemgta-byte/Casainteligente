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

const SUBTITULO_CUADRO: Record<CuadroAlmacen, string> = {
  inventario:
    'Existencias por obra y almacén. El catálogo de materiales (altas y SKU) está en Maestros.',
  movimientos: 'Historial de entradas y salidas que explican el stock actual.',
  trazabilidad: 'Kardex y ruta del material en obra.',
};

function AlmacenHubInner() {
  const searchParams = useSearchParams();
  const cuadro = parseCuadro(searchParams.get('cuadro'));
  const searchString = useMemo(() => searchParams.toString(), [searchParams]);

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white">
      <div className="px-4 py-4 pb-28 sm:px-5 sm:pb-24 lg:px-6 max-w-[100vw] overflow-x-hidden">
        <AlmacenCuadroNav activo={cuadro} search={searchString} />
        <p className="mb-4 text-[11px] leading-relaxed text-zinc-500 max-w-2xl">
          {SUBTITULO_CUADRO[cuadro]}
        </p>
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
