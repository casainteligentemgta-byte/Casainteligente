import { Suspense } from 'react';
import { normalizarProyectoIdCandidato } from '@/lib/proyectos/validarProyectoUuid';
import MaquinariaControlObraClient from './MaquinariaControlObraClient';

export default function ControlObraMaquinariaPage({ params }: { params: { id: string } }) {
  const proyectoId = normalizarProyectoIdCandidato(params?.id);

  return (
    <Suspense
      fallback={
        <p className="py-8 text-sm text-zinc-500" role="status">
          Cargando maquinaria…
        </p>
      }
    >
      <MaquinariaControlObraClient proyectoId={proyectoId} />
    </Suspense>
  );
}
