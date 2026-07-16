'use client';

import { NexusSidebar } from '@/components/nexus/NexusSidebar';
import { Menu } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { NEXUS_MODULES } from '@/lib/nexus/modules';
import { cn } from '@/lib/utils';

export function NexusShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-[var(--nexus-bg-base)] text-white">
      <NexusSidebar />
      {/* Drawer tablet / móvil */}
      <div
        className={cn(
          'fixed inset-0 z-50 bg-black/60 backdrop-blur-sm lg:hidden',
          open ? 'block' : 'hidden',
        )}
        onClick={() => setOpen(false)}
        aria-hidden
      />
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-[51] w-[min(280px,88vw)] border-r border-[rgba(255,255,255,0.1)] bg-[#12141c]/95 backdrop-blur-[20px] transition-transform lg:hidden',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="p-4">
          <p className="font-[family-name:var(--font-nexus-mono)] text-xs text-[var(--nexus-cyan)]">Nexus Home</p>
          <ul className="mt-4 space-y-1">
            {NEXUS_MODULES.map((m) => (
              <li key={m.href}>
                <Link
                  href={m.href}
                  onClick={() => setOpen(false)}
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
            className="rounded-lg p-2 text-[var(--nexus-text-muted)] hover:bg-white/10 hover:text-[var(--nexus-cyan)] lg:hidden"
            onClick={() => setOpen(true)}
            aria-label="Abrir menú"
          >
            <Menu className="h-6 w-6 stroke-[2]" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-[var(--nexus-text-dim)]">Escritorio optimizado · Campo en tablet</p>
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
