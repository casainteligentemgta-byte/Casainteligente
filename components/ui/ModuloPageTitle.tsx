'use client';

import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';

/**
 * Título de módulo con icono al estilo Control de obra:
 * icono Lucide coloreado + tipografía bold/tracking-tight.
 * El icono navega al menú de inicio.
 */
export default function ModuloPageTitle({
  title,
  icon: Icon,
  iconClassName = 'text-amber-400',
  hrefInicio = '/',
  uppercase = false,
  as = 'h1',
}: {
  title: string;
  icon: LucideIcon;
  /** Clase de color del icono (p. ej. text-amber-400, text-orange-400). */
  iconClassName?: string;
  hrefInicio?: string;
  uppercase?: boolean;
  as?: 'h1' | 'h2';
}) {
  const TitleTag = as;
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <Link
        href={hrefInicio}
        aria-label="Ir al menú de inicio"
        title="Menú de inicio"
        className="-m-0.5 shrink-0 rounded-lg p-0.5 transition hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
      >
        <Icon className={`h-7 w-7 ${iconClassName}`} aria-hidden strokeWidth={2} />
      </Link>
      <TitleTag
        className={`truncate text-xl font-bold tracking-tight text-white ${
          uppercase ? 'uppercase' : ''
        }`}
        style={{ lineHeight: 1.15 }}
      >
        {title}
      </TitleTag>
    </div>
  );
}
