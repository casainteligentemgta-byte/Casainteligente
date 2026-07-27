'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Construction, Package, ShoppingCart } from 'lucide-react';
import ControlObraSubnav from '@/components/proyectos/ControlObraSubnav';
import GenerarContratoDelegadoModal from '@/components/proyectos/GenerarContratoDelegadoModal';
import ProyectoAdLogisticaBanner from '@/components/proyectos/ProyectoAdLogisticaBanner';
import ModuloPageTitle from '@/components/ui/ModuloPageTitle';
import { useContratoAdProyecto } from '@/hooks/useContratoAdProyecto';

type Props = {
  proyectoId: string;
  children: React.ReactNode;
};

export default function ControlObraShell({ proyectoId, children }: Props) {
  const pathname = usePathname() ?? '';
  const esSeccionEquipo = pathname.includes('/control-obra/equipo');
  const pid = encodeURIComponent(proyectoId);
  const { autorizado, loading, refrescar } = useContratoAdProyecto(proyectoId);
  const [contratoAdModalOpen, setContratoAdModalOpen] = useState(false);

  return (
    <div className="max-w-[1600px] mx-auto space-y-5 text-white">
      <header className="space-y-1">
        <ModuloPageTitle
          title="Control de obra"
          icon={Construction}
          iconClassName="text-amber-400"
          uppercase
        />
        <p className="text-sm text-zinc-500 pl-[2.375rem]">
          Presupuesto, equipo, agua, maquinaria, informes, cronograma y tours 3D
        </p>
      </header>

      <ControlObraSubnav proyectoId={proyectoId} />

      {!esSeccionEquipo ? (
        <ProyectoAdLogisticaBanner
          proyectoId={proyectoId}
          autorizado={autorizado}
          loading={loading}
          onAbrirContratoAd={() => setContratoAdModalOpen(true)}
          className="mb-1"
        />
      ) : null}

      {children}

      <div className="flex flex-wrap gap-2 pt-2 border-t border-white/10">
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

      <GenerarContratoDelegadoModal
        open={contratoAdModalOpen}
        onClose={() => setContratoAdModalOpen(false)}
        proyectoId={proyectoId}
        onContratoGenerado={() => void refrescar()}
      />
    </div>
  );
}
