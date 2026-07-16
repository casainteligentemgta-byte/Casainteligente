'use client';

import { useEffect } from 'react';

const CHUNK_RELOAD_KEY = 'ci-proyecto-chunk-reload';

function esErrorChunk(message: string): boolean {
  return /Loading chunk|ChunkLoadError|failed/i.test(message);
}

/**
 * Límite de error del segmento (ficha módulo integral).
 */
export default function ProyectoModuloDetalleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const chunkStale = esErrorChunk(error.message);

  useEffect(() => {
    if (!chunkStale || typeof window === 'undefined') return;
    if (sessionStorage.getItem(CHUNK_RELOAD_KEY)) return;
    sessionStorage.setItem(CHUNK_RELOAD_KEY, '1');
    window.location.reload();
  }, [chunkStale]);

  return (
    <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <div className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-5 py-6 backdrop-blur-sm">
        <h2 className="text-lg font-semibold text-white">No se pudo cargar el proyecto</h2>
        <p className="mt-2 text-sm text-zinc-400">
          {error.message || 'Error al mostrar la ficha del módulo. Puedes reintentar o volver al listado.'}
        </p>
        {chunkStale ? (
          <p className="mt-3 text-xs text-amber-400/90 leading-relaxed">
            Caché de desarrollo desactualizada. Si no se recarga solo, ejecuta{' '}
            <code className="text-amber-200">npm run dev:fresh</code> y pulsa Recargar página (Ctrl+Shift+R).
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={() => {
            if (typeof window !== 'undefined') sessionStorage.removeItem(CHUNK_RELOAD_KEY);
            if (chunkStale) window.location.reload();
            else reset();
          }}
          className="rounded-xl bg-[#007AFF] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0062CC]"
        >
          {chunkStale ? 'Recargar página' : 'Reintentar'}
        </button>
        <a
          href="/proyectos/modulo"
          className="rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold text-white/90 hover:bg-white/10"
        >
          Volver a proyectos
        </a>
      </div>
    </div>
  );
}
