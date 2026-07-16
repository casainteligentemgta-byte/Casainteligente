import { Suspense } from 'react';
import TrabajadoresTodosProyectosClient from '@/components/rrhh/trabajadores/TrabajadoresTodosProyectosClient';

export const metadata = {
  title: 'Trabajadores por proyecto | RRHH',
  description: 'Listado de todos los trabajadores con filtro por proyecto u obra.',
};

export default function RrhhTrabajadoresPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-6xl px-4 py-12 text-sm text-zinc-500">Cargando trabajadores…</div>
      }
    >
      <TrabajadoresTodosProyectosClient />
    </Suspense>
  );
}
