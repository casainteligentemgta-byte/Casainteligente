'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import {
  Scale,
  FolderOpen,
  LayoutDashboard,
  ArrowLeft,
  MessageSquareText,
  Calculator,
  Camera,
  FileText,
  FileUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAccesoLegal } from '@/lib/legal/AccesoLegalContext';

const NAV = [
  { href: '/legal', label: 'Resumen', icon: LayoutDashboard, exact: true },
  { href: '/legal/casos', label: 'Casos', icon: FolderOpen, exact: false },
  { href: '/legal/documentos', label: 'Documentos', icon: FileText, exact: false },
  { href: '/legal/formatos', label: 'Formatos', icon: FileUp, exact: false },
  { href: '/legal/asesor', label: 'Asesor', icon: MessageSquareText, exact: false },
  { href: '/legal/inspecciones', label: 'IurisVigía', icon: Camera, exact: false },
  { href: '/legal/calculos', label: 'Cálculos', icon: Calculator, exact: false },
];

export default function LegalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '';
  const acceso = useAccesoLegal();
  const standalone = acceso.standalone;

  useEffect(() => {
    if (acceso.unauthorized) {
      window.location.href = `/login?next=${encodeURIComponent('/legal')}`;
    }
  }, [acceso.unauthorized]);

  const titulo = standalone ? 'Módulo Abogado' : 'Departamento Legal';
  const eyebrow = standalone
    ? acceso.orgNombre || 'Legal · plan independiente'
    : 'Casa Inteligente';

  return (
    <div className="min-h-screen bg-[#07090f] text-zinc-100">
      <header className="sticky top-0 z-40 border-b border-amber-500/20 bg-[#0c1018]/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-500/35 bg-amber-500/10">
              <Scale className="h-5 w-5 text-amber-300" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-500/80">
                {eyebrow}
              </p>
              <h1 className="truncate text-base font-bold tracking-tight text-white sm:text-lg">
                {titulo}
              </h1>
            </div>
          </div>
          {!standalone ? (
            <Link
              href="/"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-zinc-400 transition hover:border-white/20 hover:text-zinc-200"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              CRM
            </Link>
          ) : (
            <span className="hidden rounded-lg border border-amber-500/25 bg-amber-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-200/90 sm:inline">
              Solo abogado
            </span>
          )}
        </div>
        <nav className="mx-auto flex max-w-5xl flex-wrap gap-1.5 px-4 pb-3">
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
                  'inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition sm:px-3 sm:py-2 sm:text-sm',
                  active
                    ? 'bg-amber-500/15 text-amber-200'
                    : 'text-zinc-500 hover:bg-white/5 hover:text-zinc-300',
                )}
              >
                <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
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
