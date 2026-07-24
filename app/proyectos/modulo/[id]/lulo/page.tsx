import Link from 'next/link';
import { Suspense } from 'react';
import LuloProyectoClient from '@/components/proyectos/lulo/LuloProyectoClient';
import {
  isValidProyectoUuid,
  mensajeProyectoIdInvalido,
  normalizarProyectoIdCandidato,
} from '@/lib/proyectos/validarProyectoUuid';
import { createClient } from '@/lib/supabase/server';

export default async function ProyectoLuloPage({ params }: { params: { id: string } }) {
  const proyectoId = normalizarProyectoIdCandidato(params?.id);

  if (!isValidProyectoUuid(proyectoId)) {
    return (
      <main className="min-h-screen bg-[#0A0A0F] px-4 py-8 md:px-8">
        <p className="text-sm text-red-400">{mensajeProyectoIdInvalido(proyectoId)}</p>
        <Link
          href="/proyectos/modulo"
          className="mt-4 inline-block text-xs font-semibold text-amber-400 hover:text-amber-300"
        >
          ← Volver a proyectos
        </Link>
      </main>
    );
  }

  const supabase = await createClient();
  const { data: proyecto } = await supabase
    .from('ci_proyectos')
    .select('nombre')
    .eq('id', proyectoId)
    .maybeSingle();

  return (
    <main className="min-h-screen bg-[#0A0A0F] px-4 py-8 md:px-8">
      <Suspense
        fallback={
          <p className="text-sm text-zinc-500 py-8" role="status">
            Cargando módulo Lulo…
          </p>
        }
      >
        <LuloProyectoClient
          proyectoId={proyectoId}
          proyectoNombre={proyecto?.nombre ?? undefined}
        />
      </Suspense>
    </main>
  );
}
