import { redirect } from 'next/navigation';
import { RRHH_HUB_HREF } from '@/lib/rrhh/rrhhNav';

/**
 * Entrada única del módulo: el hub operativo es el cuadro por obra.
 * `?vista=reclutamiento` (enlaces legacy del dashboard) va a Reclutamiento.
 */
export default function RrhhIndexPage({
  searchParams,
}: {
  searchParams?: { vista?: string };
}) {
  if (searchParams?.vista === 'reclutamiento') {
    redirect('/rrhh/reclutamiento');
  }
  redirect(RRHH_HUB_HREF);
}
