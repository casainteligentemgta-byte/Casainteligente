import { Suspense } from 'react';
import InformesIngenieroObraPanel from '@/components/proyectos/InformesIngenieroObraPanel';
import { normalizarProyectoIdCandidato } from '@/lib/proyectos/validarProyectoUuid';

export default function InformesIngenieroObraPage({ params }: { params: { id: string } }) {
  const proyectoId = normalizarProyectoIdCandidato(params?.id);

  return (
    <Suspense
      fallback={
        <p className="text-sm text-zinc-500 py-8" role="status">
          Cargando informes…
        </p>
      }
    >
      <InformesIngenieroObraPanel proyectoId={proyectoId} />
    </Suspense>
  );
}
