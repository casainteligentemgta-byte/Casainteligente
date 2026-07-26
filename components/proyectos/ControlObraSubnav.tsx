'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Calculator,
  CalendarRange,
  Droplets,
  FileText,
  HardHat,
  Layers,
  Truck,
  Video,
} from 'lucide-react';

type Tab = {
  id: string;
  href: string;
  label: string;
  icon: typeof Layers;
};

function tabs(proyectoId: string): Tab[] {
  const base = `/proyectos/modulo/${encodeURIComponent(proyectoId)}/control-obra`;
  return [
    { id: 'presupuesto', href: base, label: 'Presupuesto Lulo', icon: Layers },
    { id: 'apu', href: `${base}/apu`, label: 'Análisis APU', icon: Calculator },
    { id: 'agua', href: `${base}/agua`, label: 'Registro de agua', icon: Droplets },
    { id: 'maquinaria', href: `${base}/maquinaria`, label: 'Maquinaria intercompany', icon: Truck },
    { id: 'informes', href: `${base}/informes`, label: 'Informes ingeniero', icon: FileText },
    { id: 'cronograma', href: `${base}/cronograma`, label: 'Cronograma', icon: CalendarRange },
    { id: 'equipo', href: `${base}/equipo`, label: 'Equipo', icon: HardHat },
    { id: 'tours', href: `${base}/tours`, label: 'Tours 3D', icon: Video },
  ];
}

function tabActivo(pathname: string, tab: Tab): boolean {
  if (tab.id === 'presupuesto') {
    return (
      pathname.endsWith('/control-obra') ||
      (pathname.includes('/control-obra') &&
        !pathname.includes('/agua') &&
        !pathname.includes('/apu') &&
        !pathname.includes('/informes') &&
        !pathname.includes('/cronograma') &&
        !pathname.includes('/equipo') &&
        !pathname.includes('/maquinaria') &&
        !pathname.includes('/tours'))
    );
  }
  return pathname.includes(`/control-obra/${tab.id}`);
}

type Props = {
  proyectoId: string;
};

export default function ControlObraSubnav({ proyectoId }: Props) {
  const pathname = usePathname() ?? '';
  const items = tabs(proyectoId);

  return (
    <nav
      className="grid grid-cols-2 gap-x-3 gap-y-2 justify-items-stretch max-md:landscape:flex max-md:landscape:flex-nowrap max-md:landscape:items-stretch max-md:landscape:justify-between max-md:landscape:gap-1.5 max-md:landscape:overflow-x-auto md:flex md:flex-nowrap md:items-stretch md:justify-between md:gap-1.5 lg:gap-2"
      aria-label="Secciones de control de obra"
    >
      {items.map((tab) => {
        const active = tabActivo(pathname, tab);
        const Icon = tab.icon;
        return (
          <Link
            key={tab.id}
            href={tab.href}
            className={
              (active
                ? 'inline-flex items-center justify-center gap-1.5 rounded-full border border-amber-500/50 bg-amber-950/50 px-2.5 py-1.5 text-[11px] font-semibold text-amber-100 '
                : 'inline-flex items-center justify-center gap-1.5 rounded-full border border-white/10 bg-zinc-900/60 px-2.5 py-1.5 text-[11px] font-semibold text-zinc-400 hover:border-white/20 hover:text-zinc-200 ') +
              'max-md:landscape:min-w-0 max-md:landscape:flex-1 max-md:landscape:px-2 max-md:landscape:text-[10px] md:min-w-0 md:flex-1 md:px-2 lg:px-2.5 lg:text-[11px]'
            }
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
