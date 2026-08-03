import { Suspense } from 'react';
import ContratoTrabajoObreroClient from '@/components/rrhh/ContratoTrabajoObreroClient';

export const metadata = {
  title: 'Contrato de trabajo (obrero) | Casa Inteligente',
  description: 'Generación de contratos de trabajo para obreros, individual o en serie desde Excel.',
};

export default function ContratoTrabajoObreroPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0A0A0F] px-4 py-10 text-center text-sm text-zinc-500">
          Cargando…
        </div>
      }
    >
      <ContratoTrabajoObreroClient />
    </Suspense>
  );
}
