'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Users } from 'lucide-react';
import ModuloPageTitle from '@/components/ui/ModuloPageTitle';
import {
  RRHH_HUB_HREF,
  RRHH_NAV_SECTIONS,
  hrefRrhhConProyecto,
  rrhhNavItemActivo,
  rrhhPathSinShell,
} from '@/lib/rrhh/rrhhNav';
import { cn } from '@/lib/utils';

type Props = {
  children: React.ReactNode;
  /** Obra en contexto (opcional; también se lee de la URL). */
  proyectoModuloId?: string | null;
};

/**
 * Shell del módulo RRHH: título + navegación por secciones.
 * Sustituye el cluster plano de pills por un mapa mental claro.
 */
export default function RrhhShell({ children, proyectoModuloId = null }: Props) {
  const pathname = usePathname() ?? '';
  const searchParams = useSearchParams();

  if (rrhhPathSinShell(pathname)) {
    return <>{children}</>;
  }

  const proyectoFromUrl =
    (searchParams.get('proyecto') ?? searchParams.get('proyecto_modulo') ?? '').trim() || null;
  const proyectoCtx = (proyectoModuloId ?? '').trim() || proyectoFromUrl;

  return (
    <div className="min-h-screen text-zinc-100">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-zinc-950/90 backdrop-blur-xl">
        <div className="mx-auto max-w-6xl px-4 py-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                Casa Inteligente
              </p>
              <ModuloPageTitle
                title="RRHH"
                icon={Users}
                iconClassName="text-pink-400"
                hrefInicio={RRHH_HUB_HREF}
              />
            </div>
          </div>

          <nav className="mt-4 flex flex-col gap-3" aria-label="Módulo RRHH">
            {RRHH_NAV_SECTIONS.map((section) => (
              <div
                key={section.id}
                className="flex flex-wrap items-center gap-x-2 gap-y-1.5"
              >
                <span className="w-20 shrink-0 text-[10px] font-bold uppercase tracking-wider text-zinc-500 sm:w-24">
                  {section.label}
                </span>
                <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                  {section.items.map((item) => {
                    const active = rrhhNavItemActivo(pathname, item);
                    const href = hrefRrhhConProyecto(item.href, proyectoCtx);
                    return (
                      <Link
                        key={item.href}
                        href={href}
                        className={cn(
                          'rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition',
                          active
                            ? 'border-pink-400/50 bg-pink-500/20 text-pink-50'
                            : 'border-white/10 bg-white/[0.03] text-zinc-300 hover:border-white/20 hover:bg-white/[0.06] hover:text-white',
                        )}
                        aria-current={active ? 'page' : undefined}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </div>
      </header>

      {/* El contenido de cada página mantiene su propio contenedor (max-w / padding). */}
      {children}
    </div>
  );
}
