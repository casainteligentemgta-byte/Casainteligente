'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Bell,
  Fuel,
  LayoutDashboard,
  MessageSquareText,
  Truck,
  UserRound,
  Wrench,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/flota', label: 'Resumen', icon: LayoutDashboard, exact: true },
  { href: '/flota/conductores', label: 'Conductores', icon: UserRound, exact: false },
  { href: '/flota/gasolina', label: 'Gasolina', icon: Fuel, exact: false },
  { href: '/flota/mantenimiento', label: 'Taller', icon: Wrench, exact: false },
  { href: '/flota/alertas', label: 'Alertas', icon: Bell, exact: false },
  { href: '/flota/chatbot', label: 'Mecánico', icon: MessageSquareText, exact: false },
];

export default function FlotaShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '';

  return (
    <div className="min-h-screen bg-[#07090f] text-zinc-100">
      <header className="sticky top-0 z-40 border-b border-amber-500/20 bg-[#0c1018]/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/"
              aria-label="Volver al menú"
              title="Menú de inicio"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-500/35 bg-amber-500/10 transition hover:border-amber-400/50 hover:bg-amber-500/20"
            >
              <Truck className="h-5 w-5 text-amber-300" />
            </Link>
            <div className="min-w-0">
              <p className="truncate text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-500/80">
                Casa Inteligente
              </p>
              <h1 className="truncate text-base font-bold tracking-tight text-white sm:text-lg">
                Flota
              </h1>
            </div>
          </div>
        </div>
        <nav className="mx-auto max-w-5xl px-4 pb-3" aria-label="Secciones de flota">
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6 lg:flex lg:flex-wrap lg:gap-1">
            {NAV.map((item) => {
              const active = item.exact
                ? pathname === item.href
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'inline-flex min-w-0 items-center justify-center gap-1 rounded-lg px-1.5 py-2 text-[10px] font-medium leading-tight transition sm:px-2.5 sm:text-xs lg:justify-start lg:px-3 lg:py-2 lg:text-sm',
                    active
                      ? 'bg-amber-500/15 text-amber-200'
                      : 'bg-white/[0.03] text-zinc-500 hover:bg-white/5 hover:text-zinc-300 lg:bg-transparent',
                  )}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6 pb-24">{children}</main>
    </div>
  );
}

export const FLOTA_INPUT =
  'flex h-9 w-full rounded-md border border-white/15 bg-[#0c1018] px-3 text-sm text-white placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-400/60';

export const FLOTA_LABEL = 'mb-1 block text-[11px] font-semibold uppercase tracking-wide text-zinc-500';
