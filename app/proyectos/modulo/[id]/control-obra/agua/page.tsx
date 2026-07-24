import { Suspense } from 'react';
import RegistroAguaObraPanel from '@/components/proyectos/RegistroAguaObraPanel';
import { normalizarProyectoIdCandidato } from '@/lib/proyectos/validarProyectoUuid';

export default function RegistroAguaObraPage({ params }: { params: { id: string } }) {
  const proyectoId = normalizarProyectoIdCandidato(params?.id);

  return (
    <Suspense
      fallback={
        <p className="text-sm text-zinc-500 py-8" role="status">
          Cargando registro de agua…
        </p>
      }
    >
      <RegistroAguaObraPanel proyectoId={proyectoId} />
    </Suspense>
  );
}
