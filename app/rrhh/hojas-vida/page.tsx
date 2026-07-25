import { Suspense } from 'react';
import RrhhHojasVidaClient from './RrhhHojasVidaClient';

export default function RrhhHojasVidaPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-6xl px-4 pb-28 pt-6">
          <p className="text-sm text-zinc-500">Cargando RRHH…</p>
        </div>
      }
    >
      <RrhhHojasVidaClient />
    </Suspense>
  );
}
