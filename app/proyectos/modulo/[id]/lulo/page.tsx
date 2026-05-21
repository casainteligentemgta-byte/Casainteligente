import Link from 'next/link';
import {
  isValidProyectoUuid,
  mensajeProyectoIdInvalido,
  normalizarProyectoIdCandidato,
} from '@/lib/proyectos/validarProyectoUuid';
import { redirect } from 'next/navigation';

/** Ruta legada: redirige al módulo CONTROL DE OBRA */
export default function ProyectoLuloRedirectPage({ params }: { params: { id: string } }) {
  const id = normalizarProyectoIdCandidato(params?.id);
  if (!isValidProyectoUuid(id)) {
    return (
      <main className="min-h-screen bg-[#0A0A0F] px-4 py-8 md:px-8">
        <p className="text-sm text-red-400">{mensajeProyectoIdInvalido(id)}</p>
        <Link
          href="/proyectos/modulo"
          className="mt-4 inline-block text-xs font-semibold text-amber-400 hover:text-amber-300"
        >
          ← Volver a proyectos
        </Link>
      </main>
    );
  }
  redirect(`/proyectos/modulo/${id}/control-obra`);
}
