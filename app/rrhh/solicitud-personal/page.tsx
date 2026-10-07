import { Suspense } from 'react';
import SolicitudPersonalClient from '@/components/rrhh/solicitud-personal/SolicitudPersonalClient';

export const metadata = {
  title: 'Solicitud de personal | RRHH',
  description: 'Pedir personal por obra y oficio, enviar los enlaces y ver quién respondió.',
};

export default function RrhhSolicitudPersonalPage() {
  return (
    <Suspense
      fallback={<div className="mx-auto max-w-3xl px-4 py-12 text-sm text-zinc-500">Cargando solicitudes…</div>}
    >
      <SolicitudPersonalClient />
    </Suspense>
  );
}
