import { Suspense } from 'react';
import EntidadesPatronoClient from './EntidadesPatronoClient';

export const metadata = {
  title: 'Entidades legales | Casa Inteligente',
  description: 'Patronos: razón social, RIF, representante, registro mercantil y permisología para contratos.',
};

export default function ConfiguracionEntidadesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center bg-[#0A0A0F] px-4 text-sm text-zinc-500">
          Cargando…
        </div>
      }
    >
      <EntidadesPatronoClient />
    </Suspense>
  );
}
