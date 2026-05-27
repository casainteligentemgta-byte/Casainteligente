import ControlObraSubnav from '@/components/proyectos/ControlObraSubnav';
import ProyectoEquipoAlertasPanel from '@/components/proyectos/ProyectoEquipoAlertasPanel';

type Props = {
  params: { id: string };
};

export default function ControlObraEquipoPage({ params }: Props) {
  const proyectoId = params.id;

  return (
    <div className="space-y-6">
      <ControlObraSubnav proyectoId={proyectoId} />
      <ProyectoEquipoAlertasPanel proyectoId={proyectoId} />
    </div>
  );
}
