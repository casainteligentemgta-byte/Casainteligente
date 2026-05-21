import Link from 'next/link';
import { Suspense } from 'react';
import {
  isValidProyectoUuid,
  mensajeProyectoIdInvalido,
  normalizarProyectoIdCandidato,
} from '@/lib/proyectos/validarProyectoUuid';
import ProyectoModuloDetalleClient from './ProyectoModuloDetalleClient';

export default function ProyectoModuloDetallePage({ params }: { params: { id: string } }) {
  const id = normalizarProyectoIdCandidato(params?.id);
  if (!isValidProyectoUuid(id)) {
    return (
      <main className="min-h-screen bg-[var(--bg-primary)] px-4 py-8 md:px-8">
        <p className="text-sm text-red-400">{mensajeProyectoIdInvalido(id)}</p>
        <Link
          href="/proyectos/modulo"
          className="mt-4 inline-block text-xs font-semibold text-amber-400 hover:text-amber-300"
        >
          ← Volver a proyectos
        </Link>
      </main>
    );
  }
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[var(--bg-primary)] px-4 py-16 text-center text-sm text-zinc-500">
          Cargando…
        </div>
      }
    >
      <ProyectoModuloDetalleClient id={id} />
    </Suspense>
  );
}
