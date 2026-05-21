import Link from 'next/link';
import ControlObraClient from '@/components/proyectos/ControlObraClient';
import {
  isValidProyectoUuid,
  mensajeProyectoIdInvalido,
  normalizarProyectoIdCandidato,
} from '@/lib/proyectos/validarProyectoUuid';

/** Server Component: `params.id` es estable en SSR e hidratación (evita mismatch con `useParams`). */
export default function ControlObraPage({ params }: { params: { id: string } }) {
  const proyectoId = normalizarProyectoIdCandidato(params?.id);

  if (!isValidProyectoUuid(proyectoId)) {
    return (
      <main className="min-h-screen bg-[#0A0A0F] px-4 py-8 md:px-8">
        <p className="text-sm text-red-400">{mensajeProyectoIdInvalido(proyectoId)}</p>
        <Link
          href="/proyectos/modulo"
          className="mt-4 inline-block text-xs font-semibold text-amber-400 hover:text-amber-300"
        >
          ← Volver a proyectos
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0A0A0F] px-4 py-8 md:px-8">
      <ControlObraClient proyectoId={proyectoId} />
    </main>
  );
}
