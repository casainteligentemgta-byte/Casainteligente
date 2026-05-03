import Link from 'next/link';
import { ConstructorRequisicion } from '@/components/reclutamiento/ConstructorRequisicion';

export const metadata = {
  title: 'Requisición de personal | Reclutamiento',
  description: 'Primer requerimiento de personal: obreros (oficios) o empleados administrativos, vinculado a proyecto.',
};

function firstString(v: string | string[] | undefined): string | null {
  if (v == null) return null;
  if (typeof v === 'string') return v.trim() || null;
  const s = v[0]?.trim();
  return s || null;
}

type PageProps = {
  searchParams: Record<string, string | string[] | undefined>;
};

export default function ReclutamientoRequisicionPage({ searchParams }: PageProps) {
  const initialProyectoModuloId = firstString(searchParams.proyecto_modulo_id);
  const initialProyectoObraId = firstString(searchParams.proyecto_id);

  return (
    <div className="min-h-screen app-root-bg pb-28 sm:pb-24">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 pt-6">
        <Link
          href="/reclutamiento/dashboard"
          className="text-sm font-medium text-zinc-400 transition hover:text-[#FFD60A]"
        >
          ← Volver al panel de reclutamiento
        </Link>
      </div>
      <ConstructorRequisicion
        initialProyectoModuloId={initialProyectoModuloId}
        initialProyectoObraId={initialProyectoObraId}
      />
    </div>
  );
}
