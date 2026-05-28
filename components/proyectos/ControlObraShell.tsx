'use client';

import Link from 'next/link';
import { ArrowLeft, Construction } from 'lucide-react';
import ControlObraSubnav from '@/components/proyectos/ControlObraSubnav';

type Props = {
  proyectoId: string;
  children: React.ReactNode;
};

export default function ControlObraShell({ proyectoId, children }: Props) {
  const pid = encodeURIComponent(proyectoId);

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

      {children}
    </div>
  );
}
