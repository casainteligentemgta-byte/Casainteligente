'use client';

import { NexusSidebar } from '@/components/nexus/NexusSidebar';
import { Menu, PanelLeftClose } from 'lucide-react';
import Link from 'next/link';
import React, { useEffect, useState } from 'react';
import { NEXUS_MODULES } from '@/lib/nexus/modules';
import { cn } from '@/lib/utils';

export function NexusShell({ children }: { children: React.ReactNode }) {
  /** Menú izquierdo: cerrado en móvil; abierto en desktop por defecto. */
  const [menuOpen, setMenuOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const menuInicializadoRef = React.useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(min-width: 1024px)');
    const apply = () => {
      const desktop = mq.matches;
      setIsDesktop(desktop);
      if (!menuInicializadoRef.current) {
        menuInicializadoRef.current = true;
        setMenuOpen(desktop);
        return;
      }
      if (!desktop) setMenuOpen(false);
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    if (isDesktop || !menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isDesktop, menuOpen]);

  return (
    <div className="flex min-h-screen bg-[var(--nexus-bg-base)] text-white">
      {/* Desktop: sidebar colapsable */}
      <div
        className={cn(
          'hidden shrink-0 overflow-hidden transition-[width] duration-200 ease-out lg:block',
          menuOpen ? 'w-64' : 'w-0',
        )}
      >
        <NexusSidebar className="w-64" />
      </div>

      {/* Overlay móvil */}
      {!isDesktop && menuOpen ? (
        <button
          type="button"
          aria-label="Cerrar menú"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setMenuOpen(false)}
        />
      ) : null}

      {/* Drawer móvil */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-[51] w-[min(280px,88vw)] border-r border-[rgba(255,255,255,0.1)] bg-[#12141c]/95 backdrop-blur-[20px] transition-transform lg:hidden',
          menuOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <p className="font-[family-name:var(--font-nexus-mono)] text-xs text-[var(--nexus-cyan)]">
            Nexus Home
          </p>
          <button
            type="button"
            onClick={() => setMenuOpen(false)}
            className="rounded-lg p-1.5 text-[var(--nexus-text-muted)] hover:bg-white/10 hover:text-white"
            aria-label="Cerrar menú"
          >
            <PanelLeftClose className="h-5 w-5" />
          </button>
        </div>
        <div className="p-4">
          <ul className="space-y-1">
            {NEXUS_MODULES.map((m) => (
              <li key={m.href}>
                <Link
                  href={m.href}
                  onClick={() => setMenuOpen(false)}
                  className="block rounded-lg px-3 py-2 text-sm text-[var(--nexus-text-muted)] hover:bg-white/5 hover:text-white"
                >
                  {m.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-[rgba(255,255,255,0.08)] bg-[rgba(10,11,16,0.85)] px-4 py-3 backdrop-blur-[20px] lg:px-8">
          <button
            type="button"
            className="rounded-lg p-2 text-[var(--nexus-text-muted)] hover:bg-white/10 hover:text-[var(--nexus-cyan)]"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-label={menuOpen ? 'Ocultar menú' : 'Mostrar menú'}
            title={menuOpen ? 'Ocultar menú' : 'Mostrar menú'}
          >
            {menuOpen ? (
              <PanelLeftClose className="h-6 w-6 stroke-[2]" />
            ) : (
              <Menu className="h-6 w-6 stroke-[2]" />
            )}
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-[var(--nexus-text-dim)]">
              Escritorio optimizado · Campo en tablet
            </p>
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
