import { Suspense } from 'react';
import ControlObraClient from '@/components/proyectos/ControlObraClient';
import PresupuestosLuloPanel from '@/components/proyectos/PresupuestosLuloPanel';
import RegistroMaquinariaIntercompany from '@/components/almacen/RegistroMaquinariaIntercompany';
import { normalizarProyectoIdCandidato } from '@/lib/proyectos/validarProyectoUuid';
import Link from 'next/link';

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
      <div className="mt-10 border-t border-white/10 pt-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">
            Maquinaria intercompany
          </p>
          <Link
            href={`/proyectos/modulo/${encodeURIComponent(proyectoId)}/control-obra/maquinaria`}
            className="text-xs font-semibold text-amber-400 hover:text-amber-300"
          >
            Vista dedicada →
          </Link>
        </div>
        <RegistroMaquinariaIntercompany proyectoId={proyectoId} />
      </div>
    </Suspense>
  );
}
