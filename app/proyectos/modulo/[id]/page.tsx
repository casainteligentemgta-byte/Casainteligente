import { Suspense } from 'react';
import ProyectoModuloDetalleClient from './ProyectoModuloDetalleClient';

/**
 * Import estático del cliente con "use client": el servidor no ejecuta Supabase aquí
 * (evita errores webpack con dynamic().then(...) y vendor-chunks rotos).
 */
export default function ProyectoModuloDetallePage({ params }: { params: { id: string } }) {
  const id = String(params?.id ?? '').trim();
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
