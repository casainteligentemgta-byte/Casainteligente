import Link from 'next/link';
import { ArrowLeft, Timer } from 'lucide-react';
import CuellosBotellaCentro from '@/components/compras/CuellosBotellaCentro';
import DiferenciasCompraPanel from '@/components/compras/DiferenciasCompraPanel';

export const metadata = { title: 'Cuellos de botella — Compras' };

export default function CuellosBotellaPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white">
      <div className="max-w-[100vw] overflow-x-hidden px-4 py-4 pb-28 sm:px-5 sm:pb-24 lg:px-6">
        <div className="mb-4 flex flex-wrap items-start gap-3">
          <Link
            href="/contabilidad/procuras"
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-zinc-400 hover:bg-white/[0.06] hover:text-white"
          >
            <ArrowLeft size={14} />
            Procuras
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Timer className="h-5 w-5 shrink-0 text-[#FF9500]" />
              <h1 className="text-lg font-black tracking-tight sm:text-xl">Cuellos de botella</h1>
            </div>
            <p className="mt-1 max-w-2xl text-[11px] leading-relaxed text-zinc-500">
              Dónde se está quedando la cadena procura → compra → retiro → almacén → salida: qué pasó su plazo,
              cuánto lleva y a quién le toca moverlo.
            </p>
          </div>
        </div>
        <DiferenciasCompraPanel />
        <CuellosBotellaCentro />
      </div>
    </div>
  );
}
