import { Suspense } from 'react';
import { normalizarProyectoIdCandidato } from '@/lib/proyectos/validarProyectoUuid';
import ObraToursClient from '@/components/proyectos/tours/ObraToursClient';

export default function ControlObraToursPage({ params }: { params: { id: string } }) {
  const proyectoId = normalizarProyectoIdCandidato(params?.id);

  return (
    <Suspense
      fallback={
        <p className="py-8 text-sm text-zinc-500" role="status">
          Cargando tours…
        </p>
      }
    >
      <ObraToursClient proyectoId={proyectoId} />
    </Suspense>
  );
}
