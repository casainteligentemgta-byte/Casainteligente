import { Suspense } from 'react';

export default function ComprasLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#050508] text-zinc-500 flex items-center justify-center">
          Cargando compras…
        </div>
      }
    >
      {children}
    </Suspense>
  );
}
