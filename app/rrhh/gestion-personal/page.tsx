import { Suspense } from 'react';
import RrhhGestionPersonalClient from '@/components/rrhh/gestion-personal/RrhhGestionPersonalClient';

export const metadata = {
  title: 'Gestión de personal | RRHH',
  description: 'Solicitudes de mano de obra, asignaciones a proyecto y maestro de obreros.',
};

export default function RrhhGestionPersonalPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <Suspense fallback={<p className="p-8 text-sm text-zinc-500">Cargando panel…</p>}>
        <RrhhGestionPersonalClient />
      </Suspense>
    </div>
  );
}
