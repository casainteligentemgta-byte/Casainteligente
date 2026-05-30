import { Suspense } from 'react';
import RegistroMaquinariaIntercompany from '@/components/almacen/RegistroMaquinariaIntercompany';
import ProyectoEquipoAlertasPanel from '@/components/proyectos/ProyectoEquipoAlertasPanel';
import ProyectoDepositarioTelegramPanel from '@/components/proyectos/ProyectoDepositarioTelegramPanel';
import { normalizarProyectoIdCandidato } from '@/lib/proyectos/validarProyectoUuid';

type Props = {
  params: { id: string };
};

/** Equipo de campo: alertas RRHH + parte diario maquinaria intercompany. */
export default function ControlObraEquipoPage({ params }: Props) {
  const proyectoId = normalizarProyectoIdCandidato(params?.id);

  return (
    <div className="space-y-8">
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
