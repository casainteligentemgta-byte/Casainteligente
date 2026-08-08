'use client';

import Link from 'next/link';
import {
  RRHH_NAV_SECTIONS,
  hrefRrhhConProyecto,
  rrhhNavItemActivo,
} from '@/lib/rrhh/rrhhNav';
import { cn } from '@/lib/utils';
import { usePathname } from 'next/navigation';

type Props = {
  proyectoModuloId?: string | null;
  className?: string;
};

/**
 * @deprecated Preferir el shell en `app/rrhh/layout` (`RrhhShell`).
 * Se mantiene por compatibilidad si alguna vista embebida lo necesita.
 */
export default function RrhhSubnavEnlaces({ proyectoModuloId = null, className = '' }: Props) {
  const pathname = usePathname() ?? '';

  return (
    <nav
      className={cn('flex flex-col gap-3', className)}
      aria-label="Accesos RRHH"
    >
      {RRHH_NAV_SECTIONS.map((section) => (
        <div key={section.id} className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
          <span className="w-20 shrink-0 text-[10px] font-bold uppercase tracking-wider text-zinc-500 sm:w-24">
            {section.label}
          </span>
          <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
            {section.items.map((item) => {
              const active = rrhhNavItemActivo(pathname, item);
              return (
                <Link
                  key={item.href}
                  href={hrefRrhhConProyecto(item.href, proyectoModuloId)}
                  className={cn(
                    'rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition',
                    active
                      ? 'border-pink-400/50 bg-pink-500/20 text-pink-50'
                      : 'border-white/10 bg-white/[0.03] text-zinc-300 hover:border-white/20 hover:bg-white/[0.06]',
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
