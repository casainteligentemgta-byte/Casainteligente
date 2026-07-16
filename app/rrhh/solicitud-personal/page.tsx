import { Suspense } from 'react';
import SolicitudPersonalObreroPageClient from '@/components/rrhh/solicitud-personal/SolicitudPersonalObreroPageClient';

export const metadata = {
  title: 'Solicitud de personal obrero | RRHH',
  description: 'Registro de plazas por oficio (tabulador GOE 6.752) y cantidad de obreros.',
};

export default function RrhhSolicitudPersonalPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-3xl px-4 py-12 text-sm text-zinc-500">Cargando formulario…</div>
      }
    >
      <SolicitudPersonalObreroPageClient />
    </Suspense>
  );
}
