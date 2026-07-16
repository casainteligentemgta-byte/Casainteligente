'use client';

import Link from 'next/link';
import { ArrowLeft, Construction, Package, ShoppingCart } from 'lucide-react';
import ControlObraSubnav from '@/components/proyectos/ControlObraSubnav';
import ProyectoAdLogisticaBanner from '@/components/proyectos/ProyectoAdLogisticaBanner';
import { useContratoAdProyecto } from '@/hooks/useContratoAdProyecto';

type Props = {
  proyectoId: string;
  children: React.ReactNode;
};

export default function ControlObraShell({ proyectoId, children }: Props) {
  const pid = encodeURIComponent(proyectoId);
  const { autorizado, loading } = useContratoAdProyecto(proyectoId);

  return (
    <div className="max-w-[1600px] mx-auto space-y-5 text-white">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/proyectos/modulo"
          className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-400 hover:bg-white/5"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Proyectos
        </Link>
        <Link
          href={`/proyectos/modulo/${pid}`}
          className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-400 hover:bg-white/5"
        >
          Módulo del proyecto
        </Link>
      </div>

      <header className="flex flex-wrap items-center gap-3">
        <Construction className="h-7 w-7 text-amber-400 shrink-0" />
        <div>
          <h1 className="text-xl font-bold tracking-tight">Control de obra</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Presupuesto, agua, maquinaria intercompany, informes y cronograma
          </p>
        </div>
      </header>

      <ControlObraSubnav proyectoId={proyectoId} />

      <ProyectoAdLogisticaBanner
        proyectoId={proyectoId}
        autorizado={autorizado}
        loading={loading}
        className="mb-1"
      />

      <div className="flex flex-wrap gap-2">
        {autorizado ? (
          <>
            <Link
              href={`/almacen/procurement?proyectoId=${pid}&fromProject=1&bloquearProyecto=1`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/35 bg-emerald-950/30 px-3 py-2 text-xs font-bold text-emerald-200 hover:bg-emerald-900/40"
            >
              <ShoppingCart className="h-3.5 w-3.5" />
              Orden de compra
            </Link>
            <Link
              href={`/almacen/despacho?proyectoId=${pid}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-orange-500/35 bg-orange-950/30 px-3 py-2 text-xs font-bold text-orange-200 hover:bg-orange-900/40"
            >
              <Package className="h-3.5 w-3.5" />
              Registrar despacho
            </Link>
          </>
        ) : (
          <>
            <span className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900/50 px-3 py-2 text-xs font-bold text-zinc-500">
              <ShoppingCart className="h-3.5 w-3.5" />
              Orden de compra (bloqueada)
            </span>
            <span className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900/50 px-3 py-2 text-xs font-bold text-zinc-500">
              <Package className="h-3.5 w-3.5" />
              Despacho (bloqueado)
            </span>
          </>
        )}
      </div>

      {children}
    </div>
  );
}
