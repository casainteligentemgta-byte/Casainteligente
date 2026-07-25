'use client';

import Link from 'next/link';
import { ArrowLeftRight, Package, Route } from 'lucide-react';

export type CuadroAlmacen = 'inventario' | 'movimientos' | 'trazabilidad';

const TABS: { id: Exclude<CuadroAlmacen, 'inventario'>; label: string; icon: typeof Route }[] = [
  { id: 'movimientos', label: 'Entradas y salidas', icon: ArrowLeftRight },
  { id: 'trazabilidad', label: 'Trazabilidad', icon: Route },
];

function hrefCuadro(id: Exclude<CuadroAlmacen, 'inventario'>, search: string): string {
  const qs = new URLSearchParams(search);
  qs.set('cuadro', id);
  if (id !== 'movimientos') {
    qs.delete('movVista');
    qs.delete('vista');
  }
  if (id !== 'trazabilidad') {
    qs.delete('material');
    qs.delete('tipo');
    qs.delete('page');
  }
  const q = qs.toString();
  return q ? `/almacen?${q}` : `/almacen?cuadro=${id}`;
}

const tabClass = (active: boolean, accent: 'orange' | 'emerald' = 'orange') => {
  if (!active) {
    return 'border border-transparent text-zinc-400 hover:text-white hover:bg-white/[0.06]';
  }
  if (accent === 'emerald') {
    return 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.15)]';
  }
  return 'bg-[#FF9500]/20 border border-[#FF9500]/40 text-[#FF9500] shadow-[0_0_20px_rgba(255,149,0,0.15)]';
};

const linkBase =
  'flex min-w-0 w-full flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-2 text-center text-[9px] font-black uppercase leading-[1.15] tracking-wide transition-all sm:flex-row sm:gap-1.5 sm:px-2 sm:py-2.5 sm:text-[10px] md:text-[11px] md:tracking-wider';

export default function AlmacenCuadroNav({
  activo,
  search = '',
  loCompradoActivo = false,
}: {
  activo: CuadroAlmacen;
  search?: string;
  /** Resalta el enlace a /almacen/lo-comprado cuando estamos en esa ruta. */
  loCompradoActivo?: boolean;
}) {
  return (
    <nav
      className="mb-4 box-border grid w-full max-w-full grid-cols-3 gap-1 rounded-2xl border border-white/[0.06] bg-white/[0.04] p-1.5 backdrop-blur-xl"
      aria-label="Vistas de almacén"
    >
      <Link
        href="/almacen/lo-comprado"
        className={`${linkBase} ${tabClass(loCompradoActivo, 'emerald')}`}
      >
        <Package size={14} className="shrink-0" aria-hidden />
        <span className="min-w-0 max-w-full break-words hyphens-auto">Lo comprado</span>
      </Link>
      {TABS.map(({ id, label, icon: Icon }) => {
        const active = !loCompradoActivo && activo === id;
        return (
          <Link
            key={id}
            href={hrefCuadro(id, search)}
            className={`${linkBase} ${tabClass(active)}`}
          >
            <Icon size={14} className="shrink-0" aria-hidden />
            <span className="min-w-0 max-w-full break-words hyphens-auto">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
