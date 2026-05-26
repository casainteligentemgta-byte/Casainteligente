import { Suspense } from 'react';
import ControlObraClient from '@/components/proyectos/ControlObraClient';
import PresupuestosLuloPanel from '@/components/proyectos/PresupuestosLuloPanel';
import { normalizarProyectoIdCandidato } from '@/lib/proyectos/validarProyectoUuid';

/** Presupuesto Lulo y tablas de obra (layout compartido con agua, informes y cronograma). */
export default function ControlObraPage({ params }: { params: { id: string } }) {
  const proyectoId = normalizarProyectoIdCandidato(params?.id);

  return (
    <Suspense
      fallback={
        <p className="text-sm text-zinc-500 py-8" role="status">
          Cargando presupuesto de obra…
        </p>
      }
    >
      <PresupuestosLuloPanel proyectoId={proyectoId} />
      <ControlObraClient proyectoId={proyectoId} />
    </Suspense>
  );
}
