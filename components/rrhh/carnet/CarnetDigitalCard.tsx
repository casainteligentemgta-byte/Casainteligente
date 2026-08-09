'use client';

import type { DatosCarnetDigital } from '@/lib/rrhh/carnetDigital';
import { etiquetaVigenciaCarnet } from '@/lib/rrhh/carnetDigital';

type Props = {
  datos: DatosCarnetDigital;
  className?: string;
};

/** Tarjeta visual del carnet digital (pantalla / impresión). */
export default function CarnetDigitalCard({ datos, className = '' }: Props) {
  return (
    <article
      className={`relative overflow-hidden rounded-2xl border border-amber-400/40 bg-gradient-to-br from-zinc-950 via-zinc-900 to-amber-950/40 text-zinc-100 shadow-xl ${className}`.trim()}
      style={{ aspectRatio: '1.586 / 1', maxWidth: 420 }}
    >
      <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-amber-500/15 blur-2xl" />
      <div className="flex h-full flex-col p-4">
        <header className="flex items-start justify-between gap-2 border-b border-white/10 pb-2">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-amber-200/80">
              Casa Inteligente
            </p>
            <p className="text-sm font-extrabold tracking-tight text-white">Carnet de obra</p>
          </div>
          <p className="rounded-md border border-amber-400/30 bg-amber-500/10 px-2 py-1 font-mono text-[10px] font-bold text-amber-100">
            {datos.codigo}
          </p>
        </header>

        <div className="mt-3 flex min-h-0 flex-1 gap-3">
          <div className="h-[5.5rem] w-[4.4rem] shrink-0 overflow-hidden rounded-lg border border-white/15 bg-zinc-800">
            {datos.fotoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={datos.fotoUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-[10px] text-zinc-500">
                Sin foto
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="truncate text-base font-bold leading-tight text-white">{datos.nombre}</p>
            <p className="font-mono text-xs text-zinc-300">C.I. {datos.cedula || '—'}</p>
            <p className="truncate text-xs font-semibold text-amber-100/90">{datos.oficio || '—'}</p>
            {datos.obraNombre ? (
              <p className="truncate text-[11px] text-zinc-400">Obra: {datos.obraNombre}</p>
            ) : null}
            {datos.entidadNombre ? (
              <p className="truncate text-[11px] text-zinc-500">{datos.entidadNombre}</p>
            ) : null}
          </div>
        </div>

        <footer className="mt-2 flex items-end justify-between gap-2 border-t border-white/10 pt-2 text-[10px] text-zinc-400">
          <div>
            <p>{etiquetaVigenciaCarnet(datos.vigenteHasta)}</p>
            {datos.sangre ? <p>Tipo sanguíneo: {datos.sangre}</p> : null}
            {datos.telefono ? <p>Tel. {datos.telefono}</p> : null}
          </div>
          <p className="text-right font-mono text-[9px] text-zinc-600">
            Emitido{' '}
            {new Date(datos.emitidoAt).toLocaleDateString('es-VE', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })}
          </p>
        </footer>
      </div>
    </article>
  );
}
