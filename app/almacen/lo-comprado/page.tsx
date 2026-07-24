'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, Package } from 'lucide-react';
import AlmacenCuadroNav from '@/components/almacen/AlmacenCuadroNav';
import LoCompradoCuadro from '@/components/almacen/LoCompradoCuadro';

function LoCompradoContent() {
  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white">
      <div className="px-4 py-4 pb-28 sm:px-5 sm:pb-24 lg:px-6 max-w-[100vw] overflow-x-hidden">
        <AlmacenCuadroNav activo="movimientos" loCompradoActivo />
        <div className="mb-4 flex flex-wrap items-start gap-3">
          <Link
            href="/almacen?cuadro=movimientos"
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-zinc-400 hover:text-white hover:bg-white/[0.06]"
          >
            <ArrowLeft size={14} />
            Almacén
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-emerald-400 shrink-0" />
              <h1 className="text-lg sm:text-xl font-black tracking-tight">Lo comprado</h1>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-zinc-500 max-w-2xl">
              Cantidades compradas por artículo y obra (desde el cuadro de compras). No modifica
              el CCO ni el stock en almacén; es el inventario de lo adquirido.
            </p>
          </div>
          <Link
            href="/contabilidad/compras"
            className="inline-flex items-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-emerald-300 hover:bg-emerald-500/20"
          >
            Cuadro compras
          </Link>
        </div>

        <LoCompradoCuadro />
      </div>
    </div>
  );
}

export default function LoCompradoPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center text-zinc-500 gap-2">
          <Loader2 className="animate-spin text-emerald-400" size={22} />
          Cargando lo comprado…
        </div>
      }
    >
      <LoCompradoContent />
    </Suspense>
  );
}
