import MigrarProductosObraPanel from '@/components/almacen/MigrarProductosObraPanel';
import Link from 'next/link';
import { normalizarProyectoIdCandidato } from '@/lib/proyectos/validarProyectoUuid';

export default function ProyectoMigrarInventarioPage({ params }: { params: { id: string } }) {
  const proyectoId = normalizarProyectoIdCandidato(params?.id);

  return (
    <div className="min-h-screen bg-[#0A0A0F]">
      <div className="mx-auto max-w-4xl px-4 pt-6">
        <Link
          href={`/proyectos/modulo/${encodeURIComponent(proyectoId)}`}
          className="text-xs font-semibold text-violet-400 hover:text-violet-300"
        >
          ← Volver al módulo del proyecto
        </Link>
      </div>
      <MigrarProductosObraPanel proyectoIdInicial={proyectoId} />
    </div>
  );
}
