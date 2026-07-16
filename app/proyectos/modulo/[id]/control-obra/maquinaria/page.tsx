import { Suspense } from 'react';
import RegistroMaquinariaIntercompany from '@/components/almacen/RegistroMaquinariaIntercompany';
import { normalizarProyectoIdCandidato } from '@/lib/proyectos/validarProyectoUuid';

export default function ControlObraMaquinariaPage({ params }: { params: { id: string } }) {
  const proyectoId = normalizarProyectoIdCandidato(params?.id);

  return (
    <Suspense
      fallback={
        <p className="text-sm text-zinc-500 py-8" role="status">
          Cargando maquinaria intercompany…
        </p>
      }
    >
      <RegistroMaquinariaIntercompany proyectoId={proyectoId} />
    </Suspense>
  );
}
