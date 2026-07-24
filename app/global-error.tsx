'use client';

/**
 * Sustituye temporalmente el layout raíz cuando falla el árbol completo.
 * Debe incluir <html> y <body> (no hereda del layout principal).
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-slate-100 font-sans antialiased text-slate-900">
        <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-4 px-6 py-16 text-center">
          <h1 className="text-xl font-bold">Error en la aplicación</h1>
          <p className="text-sm text-slate-600">
            {error.message || 'No se pudo cargar la página. Intenta de nuevo.'}
          </p>
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Reintentar
          </button>
        </div>
      </body>
    </html>
  );
}
