'use client';

import Link from 'next/link';
import { Package, ArrowLeftRight, Route } from 'lucide-react';

export type CuadroAlmacen = 'inventario' | 'movimientos' | 'trazabilidad';

const TABS: { id: CuadroAlmacen; label: string; icon: typeof Package }[] = [
  { id: 'inventario', label: 'Stock', icon: Package },
  { id: 'movimientos', label: 'Entradas y salidas', icon: ArrowLeftRight },
  { id: 'trazabilidad', label: 'Trazabilidad', icon: Route },
];

function hrefCuadro(id: CuadroAlmacen, search: string): string {
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

export default function AlmacenCuadroNav({
  activo,
  search = '',
}: {
  activo: CuadroAlmacen;
  search?: string;
}) {
  return (
    <nav
      className="flex flex-wrap gap-2 mb-4 p-1.5 rounded-2xl border border-white/[0.06] bg-white/[0.04] backdrop-blur-xl"
      aria-label="Vistas de almacén"
    >
      {TABS.map(({ id, label, icon: Icon }) => {
        const active = activo === id;
        return (
          <Link
            key={id}
            href={hrefCuadro(id, search)}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all ${
              active
                ? 'bg-[#FF9500]/20 border border-[#FF9500]/40 text-[#FF9500] shadow-[0_0_20px_rgba(255,149,0,0.15)]'
                : 'border border-transparent text-zinc-400 hover:text-white hover:bg-white/[0.06]'
            }`}
          >
            <Icon size={14} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
