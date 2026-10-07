import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import RrhhGestionPersonalClient from '@/components/rrhh/gestion-personal/RrhhGestionPersonalClient';

export const metadata = {
  title: 'Gestión de personal | RRHH',
  description: 'Solicitudes de mano de obra y asignaciones a proyecto (personal en obra).',
};

function firstQueryValue(v: string | string[] | undefined): string | undefined {
  if (v === undefined) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

type PageProps = {
  searchParams: Record<string, string | string[] | undefined>;
};

export default function RrhhGestionPersonalPage({ searchParams }: PageProps) {
  const soloPendientesInitial = firstQueryValue(searchParams.solo) === 'pendientes';
  const vistaSolicitudInitial = firstQueryValue(searchParams.vista) === 'solicitud';
  const tabInitial = firstQueryValue(searchParams.tab);
  const proyectoModuloInitial = (firstQueryValue(searchParams.proyecto_modulo) ?? '').trim() || undefined;
  const proyectoObraInitial = (firstQueryValue(searchParams.proyecto) ?? '').trim() || undefined;

  // La solicitud de personal vive en una sola pantalla. Aquí solo queda el cuadro
  // «personal en obra» (?tab=obra); cualquier otra entrada va a la pantalla nueva.
  if (tabInitial !== 'obra') {
    redirect(
      proyectoModuloInitial
        ? `/rrhh/solicitud-personal?proyecto_modulo=${encodeURIComponent(proyectoModuloInitial)}`
        : '/rrhh/solicitud-personal',
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <Suspense fallback={<p className="p-8 text-sm text-zinc-500">Cargando panel…</p>}>
        <RrhhGestionPersonalClient
          soloPendientesInitial={soloPendientesInitial}
          vistaSolicitudInitial={vistaSolicitudInitial}
          tabInitial={tabInitial}
          proyectoModuloInitial={proyectoModuloInitial}
          proyectoObraInitial={proyectoObraInitial}
        />
      </Suspense>
    </div>
  );
}
