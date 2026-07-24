import { Suspense } from 'react';
import EquipoPermisosClient from './EquipoPermisosClient';

export const metadata = {
  title: 'Equipo y permisos | Casa Inteligente',
  description: 'Roles de empresa, Telegram y matriz de autorizaciones para procuras, compras y almacén.',
};

export default function ConfiguracionEquipoPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-sm text-zinc-500">
          Cargando…
        </div>
      }
    >
      <EquipoPermisosClient />
    </Suspense>
  );
}
