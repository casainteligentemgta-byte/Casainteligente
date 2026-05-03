'use client';

/** Texto legible sobre el fondo oscuro del layout (antes: slate-900 sobre negro = invisible). */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <div className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-5 py-6 backdrop-blur-sm">
        <h2 className="text-lg font-semibold text-white">Algo salió mal</h2>
        <p className="mt-2 text-sm text-[var(--label-secondary)]">
          {error.message || 'Error inesperado. Puedes reintentar o volver al inicio.'}
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-xl bg-[#007AFF] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0062CC]"
        >
          Reintentar
        </button>
        <a
          href="/"
          className="rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold text-white/90 hover:bg-white/10"
        >
          Ir al inicio
        </a>
      </div>
    </div>
  );
}
