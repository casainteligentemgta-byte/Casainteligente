import { Suspense } from 'react';

function AlmacenSectionFallback() {
  return (
    <div className="min-h-screen bg-black text-white p-6 flex items-center justify-center font-sans">
      <p className="text-zinc-500 text-sm font-bold uppercase tracking-widest">
        Cargando almacén…
      </p>
    </div>
  );
}

/** Evita hydration mismatch en páginas que usan useSearchParams (p. ej. /almacen). */
export default function AlmacenLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<AlmacenSectionFallback />}>{children}</Suspense>;
}
