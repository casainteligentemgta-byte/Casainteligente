import { Suspense } from 'react';
import ControlJornalesObraPanel from '@/components/proyectos/ControlJornalesObraPanel';
import { normalizarProyectoIdCandidato } from '@/lib/proyectos/validarProyectoUuid';

export default function JornalesControlObraPage({ params }: { params: { id: string } }) {
  const proyectoId = normalizarProyectoIdCandidato(params?.id);

  return (
    <Suspense
      fallback={
        <p className="py-12 text-sm text-zinc-500" role="status">
          Cargando jornales…
        </p>
      }
    >
      <ControlJornalesObraPanel proyectoId={proyectoId} />
    </Suspense>
  );
}
