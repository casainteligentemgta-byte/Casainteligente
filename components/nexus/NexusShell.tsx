'use client';

import { NexusSidebar } from '@/components/nexus/NexusSidebar';
import {
  NexusRightPanelProvider,
  useNexusRightPanelSlot,
} from '@/components/nexus/NexusRightPanelContext';
import { Menu, PanelRightClose, PanelRightOpen, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import { NEXUS_MODULES } from '@/lib/nexus/modules';
import { cn } from '@/lib/utils';

function NexusShellHeader({
  menuOpen,
  setMenuOpen,
}: {
  menuOpen: boolean;
  setMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const pathname = usePathname();
  const isPlanoPrint = pathname.startsWith('/nexus/vision/imprimir');
  const isNetVision =
    !isPlanoPrint &&
    (pathname === '/nexus/vision' || pathname.startsWith('/nexus/vision/'));
  const rightPanel = useNexusRightPanelSlot()?.panel ?? null;

  return (
    <header
      data-nv-shell-chrome
      className="sticky top-0 z-40 border-b border-[rgba(255,255,255,0.08)] bg-[rgba(10,11,16,0.85)] px-4 py-3 backdrop-blur-[20px] print:hidden lg:px-8"
    >
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              'truncate text-sm',
              isNetVision
                ? 'font-semibold tracking-wide text-white'
                : 'text-[var(--nexus-text-dim)]',
            )}
          >
            {isNetVision ? 'NetVision Pro' : 'Escritorio optimizado · Campo en tablet'}
          </p>
        </div>
        {isNetVision && rightPanel ? (
          <button
            type="button"
            className="rounded-lg p-2 text-[var(--nexus-text-muted)] hover:bg-white/10 hover:text-[var(--nexus-cyan)]"
            onClick={rightPanel.toggle}
            aria-expanded={rightPanel.open}
            aria-label={rightPanel.open ? 'Ocultar inspector' : 'Mostrar inspector'}
            title={rightPanel.open ? 'Ocultar inspector' : 'Mostrar inspector'}
          >
            {rightPanel.open ? (
              <PanelRightClose className="h-6 w-6 stroke-[2]" />
            ) : (
              <PanelRightOpen className="h-6 w-6 stroke-[2]" />
            )}
          </button>
        ) : null}
        <button
          type="button"
          className="rounded-lg p-2 text-[var(--nexus-text-muted)] hover:bg-white/10 hover:text-[var(--nexus-cyan)]"
          onClick={() => setMenuOpen((v) => !v)}
          aria-expanded={menuOpen}
          aria-label={menuOpen ? 'Ocultar menú' : 'Mostrar menú'}
          title={menuOpen ? 'Ocultar menú' : 'Mostrar menú'}
        >
          {menuOpen ? (
            <X className="h-6 w-6 stroke-[2]" />
          ) : (
            <Menu className="h-6 w-6 stroke-[2]" />
          )}
        </button>
      </div>
      {isNetVision ? (
        <div id="netvision-header-nav" className="relative z-50 mt-2 min-w-0 overflow-visible" />
      ) : null}
    </header>
  );
}

function NexusShellInner({ children }: { children: React.ReactNode }) {
  /** Menú de módulos: cerrado en móvil; abierto en desktop por defecto. */
  const pathname = usePathname();
  const isPlanoPrint = pathname.startsWith('/nexus/vision/imprimir');
  const isNetVision =
    !isPlanoPrint &&
    (pathname === '/nexus/vision' || pathname.startsWith('/nexus/vision/'));
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
        setMenuOpen(desktop && !isNetVision);
        return;
      }
      if (!desktop) setMenuOpen(false);
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [isNetVision]);

  useEffect(() => {
    if (isNetVision) setMenuOpen(false);
  }, [isNetVision]);

  /**
   * Vista del cliente abierta con un enlace compartido (?c=): va sin el marco
   * interno de la empresa. `null` = aún no se sabe (primer pintado): en esa
   * ruta el marco se oculta hasta saberlo, para que el cliente nunca lo vea.
   */
  const esRutaCliente = pathname === '/nexus/vision/cliente';
  const [esEnlaceCliente, setEsEnlaceCliente] = useState<boolean | null>(null);
  useEffect(() => {
    setEsEnlaceCliente(
      esRutaCliente && new URLSearchParams(window.location.search).has('c'),
    );
  }, [esRutaCliente, pathname]);
  const sinMarco = esRutaCliente && esEnlaceCliente !== false;

  useEffect(() => {
    if (isDesktop || !menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isDesktop, menuOpen]);

  if (isPlanoPrint) {
    return <div className="min-h-screen bg-slate-200 text-slate-900">{children}</div>
  }

  // Un solo árbol para las dos vistas: la página no se vuelve a montar cuando
  // se sabe si es el enlace del cliente (solo aparece o no el marco).
  return (
    <div
      data-nv-shell-cliente={sinMarco ? '' : undefined}
      className={cn(
        'flex min-h-screen text-white',
        sinMarco ? 'bg-[#07110d]' : 'bg-[var(--nexus-bg-base)]',
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col">
        {sinMarco ? null : <NexusShellHeader menuOpen={menuOpen} setMenuOpen={setMenuOpen} />}
        <main className={cn('flex-1', isNetVision ? 'p-2 lg:p-3' : 'p-4 lg:p-8')}>
          {children}
        </main>
      </div>

      {sinMarco ? null : (
        <>
      {/* Desktop: sidebar a la derecha */}
      <div
        data-nv-shell-chrome
        className={cn(
          'hidden shrink-0 overflow-hidden transition-[width] duration-200 ease-out print:hidden lg:block',
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

      {/* Drawer móvil: entra desde la derecha */}
      <aside
        data-nv-shell-chrome
        className={cn(
          'fixed inset-y-0 right-0 z-[51] w-[min(280px,88vw)] border-l border-[rgba(255,255,255,0.1)] bg-[#12141c]/95 backdrop-blur-[20px] transition-transform print:hidden lg:hidden',
          menuOpen ? 'translate-x-0' : 'translate-x-full',
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
            <X className="h-5 w-5" />
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
        </>
      )}
    </div>
  );
}

export function NexusShell({ children }: { children: React.ReactNode }) {
  return (
    <NexusRightPanelProvider>
      <NexusShellInner>{children}</NexusShellInner>
    </NexusRightPanelProvider>
  );
}
