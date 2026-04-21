import Link from 'next/link';
import AnalisisCostosProyecto from '@/components/finanzas/AnalisisCostosProyecto';

type PageProps = { params: { proyectoId: string } };

export default function ProyectoFinanzasPage({ params }: PageProps) {
  const id = params.proyectoId?.trim() ?? '';
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-5xl">
        <Link href="/proyectos/nuevo" className="text-sm text-blue-600 hover:underline">
          ← Proyectos
        </Link>
        <h1 className="mt-4 text-2xl font-bold text-slate-900">Finanzas del proyecto</h1>
        <p className="mt-1 text-sm text-slate-600">Análisis de mano de obra y riesgo de liquidación (referencial).</p>
        {id ? (
          <div className="mt-8">
            <AnalisisCostosProyecto proyectoId={id} />
          </div>
        ) : (
          <p className="mt-8 text-sm text-red-600">ID de proyecto inválido.</p>
        )}
      </div>
    </div>
  );
}
