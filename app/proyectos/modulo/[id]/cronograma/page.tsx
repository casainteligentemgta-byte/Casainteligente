import Link from 'next/link';
import { Suspense } from 'react';
import CronogramaObraPanel from '@/components/proyectos/CronogramaObraPanel';
import {
  isValidProyectoUuid,
  mensajeProyectoIdInvalido,
  normalizarProyectoIdCandidato,
} from '@/lib/proyectos/validarProyectoUuid';
import { ArrowLeft, CalendarRange } from 'lucide-react';

export default function CronogramaObraPage({ params }: { params: { id: string } }) {
  const proyectoId = normalizarProyectoIdCandidato(params?.id);

  if (!isValidProyectoUuid(proyectoId)) {
    return (
      <main className="min-h-screen bg-[#0A0A0F] px-4 py-8">
        <p className="text-sm text-red-400">{mensajeProyectoIdInvalido(proyectoId)}</p>
        <Link href="/proyectos/modulo" className="mt-4 inline-block text-xs text-sky-400">
          ← Proyectos
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0A0A0F] px-4 py-6 md:px-8 md:py-8">
      <div className="max-w-[1600px] mx-auto space-y-6">
        <header className="flex flex-wrap items-center gap-4">
          <Link
            href={`/proyectos/modulo/${proyectoId}`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-400 hover:text-sky-400"
          >
            <ArrowLeft className="h-4 w-4" />
            Módulo proyecto
          </Link>
          <div className="flex items-center gap-2">
            <CalendarRange className="h-6 w-6 text-sky-400" />
            <h1 className="text-xl font-bold text-zinc-100">Cronograma de obra</h1>
          </div>
          <Link
            href={`/proyectos/modulo/${proyectoId}/control-obra`}
            className="ml-auto text-xs font-semibold text-violet-400 hover:text-violet-300"
          >
            Control de obra →
          </Link>
        </header>

        <Suspense
          fallback={
            <p className="text-sm text-zinc-500 py-12" role="status">
              Cargando cronograma…
            </p>
          }
        >
          <CronogramaObraPanel proyectoId={proyectoId} />
        </Suspense>
      </div>
    </main>
  );
}
