import Link from 'next/link';
import { ArrowLeft, Truck } from 'lucide-react';
import AlmacenCuadroNav from '@/components/almacen/AlmacenCuadroNav';
import RetirosCuadro from '@/components/almacen/RetirosCuadro';

export const metadata = { title: 'Retiros de mercancía — Almacén' };

export default function RetirosPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white">
      <div className="px-4 py-4 pb-28 sm:px-5 sm:pb-24 lg:px-6 max-w-[100vw] overflow-x-hidden">
        <AlmacenCuadroNav activo="movimientos" retirosActivo />
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
              <Truck className="h-5 w-5 text-[#FF9500] shrink-0" />
              <h1 className="text-lg sm:text-xl font-black tracking-tight">Retiros de mercancía</h1>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-zinc-500 max-w-2xl">
              Lo comprado que falta por llegar al almacén: quién lo retira, la foto que tomó al
              recogerlo y cuándo se recibió. Se registra desde el bot de Telegram.
            </p>
          </div>
        </div>

        <RetirosCuadro />
      </div>
    </div>
  );
}
