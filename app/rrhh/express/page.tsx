import { Suspense } from 'react';
import RrhhContratosExpressClient from '@/components/rrhh/express/RrhhContratosExpressClient';

export const metadata = {
  title: 'Contratos express · RRHH',
  description: 'Carga masiva de contratos express por obra y entidad patrono.',
};

export default function RrhhContratosExpressPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-6xl px-4 py-16 text-center text-sm text-zinc-500">
          Cargando contratos express…
        </div>
      }
    >
      <RrhhContratosExpressClient />
    </Suspense>
  );
}
