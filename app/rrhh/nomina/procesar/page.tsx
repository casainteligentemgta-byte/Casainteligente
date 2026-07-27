import { Suspense } from 'react';
import RrhhNominaProcesarClient from '@/components/rrhh/nomina/RrhhNominaProcesarClient';

export const metadata = {
  title: 'Procesar Nómina | RRHH',
  description: 'Detalle y cálculo de recibos de pago.',
};

export default function NominaProcesarPage() {
  return (
    <Suspense fallback={<div className="p-8 text-zinc-500">Cargando procesador...</div>}>
      <RrhhNominaProcesarClient />
    </Suspense>
  );
}