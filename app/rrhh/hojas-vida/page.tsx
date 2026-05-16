'use client';

import Link from 'next/link';
import { ClipboardList, FileText, ScrollText, UserRound, Users } from 'lucide-react';
import { hrefListaContratosExpress } from '@/lib/talento/hrefListaContratosExpress';
import { useEffect, useMemo, useState } from 'react';
import ResumenObrerosProyectoModulo from '@/components/proyectos/ResumenObrerosProyectoModulo';
import { createClient } from '@/lib/supabase/client';

export default function RrhhHojasVidaPage() {
  const supabase = useMemo(() => createClient(), []);
  const [proyectoModuloIntegralId, setProyectoModuloIntegralId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const withTipo = await supabase
        .from('ci_proyectos')
        .select('id,tipo_proyecto')
        .order('created_at', { ascending: false })
        .limit(60);
      if (!alive) return;
      if (!withTipo.error && withTipo.data?.length) {
        const rows = withTipo.data as { id: string; tipo_proyecto?: string | null }[];
        const integral = rows.find((r) => (r.tipo_proyecto ?? 'integral') !== 'talento');
        if (integral?.id) {
          setProyectoModuloIntegralId(integral.id);
          return;
        }
      }
      const leg = await supabase.from('ci_proyectos').select('id').order('created_at', { ascending: false }).limit(1);
      if (!alive) return;
      const id0 = (leg.data?.[0] as { id?: string } | undefined)?.id;
      if (id0 && !leg.error) {
        setProyectoModuloIntegralId(id0);
      } else {
        setProyectoModuloIntegralId(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, [supabase]);

  return (
    <div className="mx-auto max-w-6xl px-4 pb-28 pt-8">
      <header className="mb-8">
        <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Casa Inteligente</p>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">RRHH</h1>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Link
              href="/rrhh/gestion-personal?solo=pendientes"
              className="inline-flex items-center gap-2 rounded-xl border border-violet-500/35 bg-violet-950/40 px-4 py-2.5 text-sm font-semibold text-violet-100 transition hover:bg-violet-900/55"
              title="Solicitudes de mano de obra pendientes en todos los proyectos"
            >
              <ClipboardList className="h-4 w-4" aria-hidden />
              Solicitudes personal
            </Link>
            <Link
              href="/rrhh/reclutamiento"
              className="inline-flex items-center gap-2 rounded-xl border border-violet-500/40 bg-violet-950/45 px-4 py-2.5 text-sm font-semibold text-violet-100 transition hover:bg-violet-900/55"
              title="Examen, evaluaciones y pendientes express"
            >
              <Users className="h-4 w-4 shrink-0" aria-hidden />
              Reclutamiento
            </Link>
            <Link
              href="/rrhh/hojas-vida/archivo"
              className="inline-flex items-center gap-2 rounded-xl border border-sky-500/40 bg-sky-950/45 px-4 py-2.5 text-sm font-semibold text-sky-100 transition hover:bg-sky-900/55"
              title="Archivo de todos los obreros que cargaron hoja de vida"
            >
              <UserRound className="h-4 w-4 shrink-0" aria-hidden />
              Hojas de vida
            </Link>
            <Link
              href={hrefListaContratosExpress()}
              className="inline-flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-950/45 px-4 py-2.5 text-sm font-semibold text-amber-100 transition hover:bg-amber-900/55"
              title="Lista de contratos express (fast-track)"
            >
              <FileText className="h-4 w-4 shrink-0" aria-hidden />
              Contratos Express
            </Link>
            <Link
              href="/rrhh/oficios-salarios"
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/20"
            >
              <ScrollText className="h-4 w-4" />
              Oficios y salarios
            </Link>
          </div>
        </div>
      </header>

      {proyectoModuloIntegralId ? (
        <section className="mb-10 space-y-8">
          <ResumenObrerosProyectoModulo
            proyectoModuloId={proyectoModuloIntegralId}
            tabUrl="rrhh"
            tituloSeccion="SMART RRHH"
            subtituloSeccion={null}
            ocultarEnlaceHojasVida
          />
        </section>
      ) : (
        <p className="mb-8 rounded-xl border border-amber-500/25 bg-amber-950/20 px-4 py-3 text-sm text-amber-100/90">
          No se encontró un proyecto módulo integral para mostrar los cuadros de obreros. Crea o abre un proyecto en{' '}
          <Link href="/proyectos/modulo" className="font-semibold text-amber-200 underline underline-offset-2 hover:text-amber-100">
            Proyectos
          </Link>
          .
        </p>
      )}

      <section className="rounded-2xl border border-sky-500/25 bg-sky-950/25 p-6">
        <h2 className="text-lg font-bold text-white">Archivo de hojas de vida</h2>
        <p className="mt-2 max-w-2xl text-sm text-zinc-400">
          Consulta el listado completo de obreros que cargaron su hoja de vida, estén activos o inactivos, aprobados o no.
          Desde allí puedes abrir PDF, evaluación, contrato y ficha de cada expediente.
        </p>
        <Link
          href="/rrhh/hojas-vida/archivo"
          className="mt-4 inline-flex items-center gap-2 rounded-xl border border-sky-400/45 bg-sky-500/15 px-5 py-2.5 text-sm font-bold text-sky-100 transition hover:bg-sky-500/25"
        >
          <UserRound className="h-4 w-4" aria-hidden />
          Abrir archivo de hojas de vida
        </Link>
      </section>
    </div>
  );
}
