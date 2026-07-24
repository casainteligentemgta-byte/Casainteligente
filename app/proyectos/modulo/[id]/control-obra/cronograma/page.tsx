import { Suspense } from 'react';
import CronogramaObraPanel from '@/components/proyectos/CronogramaObraPanel';
import { normalizarProyectoIdCandidato } from '@/lib/proyectos/validarProyectoUuid';

export default function CronogramaControlObraPage({ params }: { params: { id: string } }) {
  const proyectoId = normalizarProyectoIdCandidato(params?.id);

  return (
    <Suspense
      fallback={
        <p className="text-sm text-zinc-500 py-12" role="status">
          Cargando cronograma…
        </p>
      }
    >
      <CronogramaObraPanel proyectoId={proyectoId} />
    </Suspense>
  );
}
