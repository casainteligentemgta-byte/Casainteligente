'use client';

import type { ReactNode } from 'react';

export type SeccionTituloHoverProps = {
  titulo: string;
  hint: string;
  panelOculto: ReactNode;
  children: ReactNode;
  descripcion?: string;
  tituloClassName?: string;
  className?: string;
};

/** Oculta formularios/acciones hasta hover o foco sobre el título; el listado (`children`) queda visible. */
export default function SeccionTituloHover({
  titulo,
  hint,
  panelOculto,
  children,
  descripcion,
  tituloClassName = 'text-zinc-500',
  className = '',
}: SeccionTituloHoverProps) {
  return (
    <section
      tabIndex={0}
      className={`group outline-none focus-visible:ring-2 focus-visible:ring-white/20 rounded-2xl ${className}`.trim()}
    >
      <h2
        className={`inline-block text-sm font-bold uppercase cursor-default ${tituloClassName}`}
        title="Pasa el cursor aquí para ver el formulario"
      >
        {titulo}
      </h2>
      <p className="mt-1 text-[10px] text-zinc-600 transition-opacity group-hover:opacity-0 group-focus-within:opacity-0">
        {hint}
      </p>
      <div
        className="max-h-0 opacity-0 overflow-hidden transition-all duration-300 ease-out
          group-hover:max-h-[2400px] group-hover:opacity-100 group-hover:mt-3
          group-focus-within:max-h-[2400px] group-focus-within:opacity-100 group-focus-within:mt-3"
      >
        {descripcion ? <p className="text-xs text-zinc-500 mb-3">{descripcion}</p> : null}
        {panelOculto}
      </div>
      {children}
    </section>
  );
}
