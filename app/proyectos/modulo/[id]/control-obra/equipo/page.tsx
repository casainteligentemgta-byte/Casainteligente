import { Suspense } from 'react';
import RegistroMaquinariaIntercompany from '@/components/almacen/RegistroMaquinariaIntercompany';
import ProyectoEquipoAlertasPanel from '@/components/proyectos/ProyectoEquipoAlertasPanel';
import ProyectoDepositarioTelegramPanel from '@/components/proyectos/ProyectoDepositarioTelegramPanel';
import ProyectoEquipoAccesoPanel from '@/components/proyectos/ProyectoEquipoAccesoPanel';
import ProyectoNominaRolesPanel from '@/components/proyectos/ProyectoNominaRolesPanel';
import { normalizarProyectoIdCandidato } from '@/lib/proyectos/validarProyectoUuid';

type Props = {
  params: { id: string };
};

/** Equipo del proyecto: acceso/roles, nómina de obra, alertas y depositario. */
export default function ControlObraEquipoPage({ params }: Props) {
  const proyectoId = normalizarProyectoIdCandidato(params?.id);

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h2 className="text-lg font-bold text-white">Equipo</h2>
        <p className="text-sm text-zinc-500">
          Acceso del patrono, roles de obra, alertas RRHH y depositario Telegram de este proyecto.
        </p>
      </header>

      <ProyectoEquipoAccesoPanel proyectoId={proyectoId} />
      <ProyectoNominaRolesPanel proyectoId={proyectoId} />
      <ProyectoEquipoAlertasPanel proyectoId={proyectoId} />
      <ProyectoDepositarioTelegramPanel proyectoId={proyectoId} />
      <Suspense
        fallback={
          <p className="text-sm text-zinc-500 py-8" role="status">
            Cargando maquinaria intercompany…
          </p>
        }
      >
        <RegistroMaquinariaIntercompany proyectoId={proyectoId} />
      </Suspense>
    </div>
  );
}
