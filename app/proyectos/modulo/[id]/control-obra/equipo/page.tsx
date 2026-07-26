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
      <p className="text-sm text-zinc-500">Asigna roles.</p>

      <ProyectoEquipoAccesoPanel proyectoId={proyectoId} />
      <ProyectoNominaRolesPanel proyectoId={proyectoId} />
      <ProyectoEquipoAlertasPanel proyectoId={proyectoId} />
      <ProyectoDepositarioTelegramPanel proyectoId={proyectoId} />
    </div>
  );
}
