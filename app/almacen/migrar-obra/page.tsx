import MigrarProductosObraPanel from '@/components/almacen/MigrarProductosObraPanel';
import { normalizarProyectoIdCandidato } from '@/lib/proyectos/validarProyectoUuid';

type Props = {
  searchParams?: { proyecto?: string };
};

export default function MigrarProductosObraPage({ searchParams }: Props) {
  const proyectoId = normalizarProyectoIdCandidato(searchParams?.proyecto);
  return <MigrarProductosObraPanel proyectoIdInicial={proyectoId || undefined} />;
}
