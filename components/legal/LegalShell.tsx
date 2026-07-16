'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Scale,
  FolderOpen,
  LayoutDashboard,
  ArrowLeft,
  MessageSquareText,
  Calculator,
  FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/legal', label: 'Resumen', icon: LayoutDashboard, exact: true },
  { href: '/legal/casos', label: 'Casos', icon: FolderOpen, exact: false },
  { href: '/legal/documentos', label: 'Documentos', icon: FileText, exact: false },
  { href: '/legal/asesor', label: 'Asesor', icon: MessageSquareText, exact: false },
  { href: '/legal/calculos', label: 'Cálculos', icon: Calculator, exact: false },
];

export default function LegalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '';

  return (
    <div className="min-h-screen bg-[#07090f] text-zinc-100">
      <header className="sticky top-0 z-40 border-b border-amber-500/20 bg-[#0c1018]/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-500/35 bg-amber-500/10">
              <Scale className="h-5 w-5 text-amber-300" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-500/80">
                Casa Inteligente
              </p>
              <h1 className="text-base font-bold tracking-tight text-white sm:text-lg">
                Departamento Legal
              </h1>
            </div>
          </div>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-zinc-400 transition hover:border-white/20 hover:text-zinc-200"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            CRM
          </Link>
        </div>
        <nav className="mx-auto flex max-w-5xl gap-1 px-4 pb-2">
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
                  'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition',
                  active
                    ? 'bg-amber-500/15 text-amber-200'
                    : 'text-zinc-500 hover:bg-white/5 hover:text-zinc-300',
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6 pb-16">{children}</main>
    </div>
  );
}
