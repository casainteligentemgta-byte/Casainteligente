import { Suspense } from 'react';
import NominaRrhhClient from '@/components/rrhh/NominaRrhhClient';

export const metadata = {
  title: 'Nómina | RRHH',
  description: 'Contratados activos y cuadro de nómina del proyecto.',
};

export default function RrhhNominaPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-6xl px-4 py-12 text-sm text-zinc-500">Cargando nómina…</div>
      }
    >
      <NominaRrhhClient />
    </Suspense>
  );
}
