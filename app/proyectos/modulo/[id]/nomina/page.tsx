import { Suspense } from 'react';
import NominaPeriodosClient from './components/NominaPeriodosClient';
import { createClient } from '@/lib/supabase/server';

export const metadata = {
  title: 'Nómina y Asistencia | Control de Obra',
  description: 'Gestión de asistencia, cálculo de nómina y recibos.',
};

type Props = {
  params: { id: string };
};

export default async function NominaObraPage({ params }: Props) {
  const supabase = await createClient();
  const { data: proyecto } = await supabase
    .from('projects')
    .select('id, name')
    .eq('id', params.id)
    .single();

  if (!proyecto) {
    return <div className="p-8 text-rose-500">Proyecto no encontrado.</div>;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <Suspense fallback={<div className="text-zinc-500">Cargando módulo de nómina...</div>}>
        <NominaPeriodosClient proyectoId={proyecto.id} proyectoNombre={proyecto.name} />
      </Suspense>
    </div>
  );
}
