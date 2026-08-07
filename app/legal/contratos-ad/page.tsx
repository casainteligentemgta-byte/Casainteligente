import { Suspense } from 'react';
import ContratosAdLegalClient from './ContratosAdLegalClient';

export const metadata = {
  title: 'Legal de la entidad · Contratos AD',
  description: 'Generación de contratos de administración delegada por obra.',
};

export default function LegalContratosAdPage() {
  return (
    <Suspense
      fallback={
        <p className="text-sm text-zinc-500">Cargando Legal de la entidad…</p>
      }
    >
      <ContratosAdLegalClient />
    </Suspense>
  );
}
