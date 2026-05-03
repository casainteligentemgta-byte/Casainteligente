import Link from 'next/link';
import AnalisisCostosProyecto from '@/components/finanzas/AnalisisCostosProyecto';
import {
  moduloProyectosPageShell,
  moduloProyectosStickyHeader,
} from '@/lib/ui/moduloProyectosTheme';

type PageProps = { params: { proyectoId: string } };

export default function ProyectoFinanzasPage({ params }: PageProps) {
  const id = params.proyectoId?.trim() ?? '';
  return (
    <div style={moduloProyectosPageShell}>
      <div style={moduloProyectosStickyHeader}>
        <div>
          <Link
            href="/proyectos/modulo"
            style={{ color: 'rgba(90,200,250,0.95)', fontSize: '13px', fontWeight: 600, textDecoration: 'none' }}
          >
            ← Proyectos
          </Link>
          <h1 style={{ color: 'white', fontSize: '22px', fontWeight: 800, margin: '8px 0 0' }}>Finanzas del proyecto</h1>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '12px', margin: '4px 0 0' }}>
            Análisis de mano de obra y riesgo de liquidación (referencial).
          </p>
        </div>
      </div>
      <div className="mx-auto max-w-5xl px-4 pb-10 pt-2">
        {id ? (
          <div className="mt-2">
            <AnalisisCostosProyecto proyectoId={id} />
          </div>
        ) : (
          <p className="mt-8 text-sm text-red-400">ID de proyecto inválido.</p>
        )}
      </div>
    </div>
  );
}
