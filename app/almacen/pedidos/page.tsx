import Link from 'next/link';
import { ArrowLeft, ClipboardList } from 'lucide-react';
import AlmacenCuadroNav from '@/components/almacen/AlmacenCuadroNav';
import PedidosMaterialCuadro from '@/components/almacen/PedidosMaterialCuadro';

export const metadata = { title: 'Pedidos de material — Almacén' };

export default function PedidosMaterialPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white">
      <div className="px-4 py-4 pb-28 sm:px-5 sm:pb-24 lg:px-6 max-w-[100vw] overflow-x-hidden">
        <AlmacenCuadroNav activo="movimientos" pedidosActivo />
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
              <ClipboardList className="h-5 w-5 text-[#FF9500] shrink-0" />
              <h1 className="text-lg sm:text-xl font-black tracking-tight">Pedidos de material</h1>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-zinc-500 max-w-2xl">
              Lo que la obra le pide al almacén: quién lo pidió y para qué, quién lo despachó y la
              foto de lo que salió. Se pide y se despacha desde el bot de Telegram.
            </p>
          </div>
        </div>

        <PedidosMaterialCuadro />
      </div>
    </div>
  );
}
