import { redirect } from 'next/navigation';
import {
  isValidProyectoUuid,
  normalizarProyectoIdCandidato,
} from '@/lib/proyectos/validarProyectoUuid';

/** Ruta legada: redirige al cronograma dentro de control de obra. */
export default function CronogramaObraRedirectPage({ params }: { params: { id: string } }) {
  const proyectoId = normalizarProyectoIdCandidato(params?.id);
  if (!isValidProyectoUuid(proyectoId)) {
    redirect('/proyectos/modulo');
  }
  redirect(`/proyectos/modulo/${encodeURIComponent(proyectoId)}/control-obra/cronograma`);
}
