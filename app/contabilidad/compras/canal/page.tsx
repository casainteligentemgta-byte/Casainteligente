import { Suspense } from 'react';
import FacturasCanalClient from '@/components/contabilidad/FacturasCanalClient';

export default function FacturasCanalPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#050508] text-zinc-500 flex items-center justify-center">
          Cargando…
        </div>
      }
    >
      <FacturasCanalClient />
    </Suspense>
  );
}
