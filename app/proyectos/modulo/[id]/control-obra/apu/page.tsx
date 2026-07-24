import { Suspense } from 'react';
import LuloWebErpClient from '@/components/proyectos/LuloWebErpClient';
import { normalizarProyectoIdCandidato } from '@/lib/proyectos/validarProyectoUuid';

/** Vista LuloWeb ERP: capítulos → partidas → APU con cálculo estilo LuloWin. */
export default function ControlObraApuPage({ params }: { params: { id: string } }) {
  const proyectoId = normalizarProyectoIdCandidato(params?.id);

  return (
    <Suspense
      fallback={
        <p className="text-sm text-zinc-500 py-8" role="status">
          Cargando análisis APU…
        </p>
      }
    >
      <LuloWebErpClient proyectoId={proyectoId} />
    </Suspense>
  );
}
