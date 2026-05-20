import { createClient } from '@/lib/supabase/server';
import LuloDatosManager from '@/components/proyectos/LuloDatosManager';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function ProyectoLuloPage({ params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data: proyecto } = await supabase
    .from('ci_proyectos')
    .select('id, nombre')
    .eq('id', params.id)
    .maybeSingle();

  if (!proyecto) notFound();

  return (
    <main className="min-h-screen bg-[#050508] px-4 py-8 md:px-8">
      <LuloDatosManager proyectoId={proyecto.id} proyectoNombre={proyecto.nombre} />
    </main>
  );
}
