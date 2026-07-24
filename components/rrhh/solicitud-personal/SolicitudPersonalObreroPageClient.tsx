'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import SolicitudPersonalObreroForm from '@/components/rrhh/gestion-personal/SolicitudPersonalObreroForm';
import { hrefGestionPersonalSolicitados } from '@/lib/rrhh/hrefSolicitudPersonal';
import { createClient } from '@/lib/supabase/client';

export default function SolicitudPersonalObreroPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);

  const proyectoModuloUrl = (searchParams.get('proyecto_modulo') ?? '').trim() || null;
  const proyectoObraUrl = (searchParams.get('proyecto') ?? '').trim() || null;

  const [proyectoModuloId, setProyectoModuloId] = useState<string | null>(proyectoModuloUrl);
  const [solicitudTick, setSolicitudTick] = useState(0);

  useEffect(() => {
    if (proyectoModuloUrl || proyectoObraUrl) {
      setProyectoModuloId(proyectoModuloUrl);
      return;
    }
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
          setProyectoModuloId(integral.id);
          return;
        }
      }
      const leg = await supabase.from('ci_proyectos').select('id').order('created_at', { ascending: false }).limit(1);
      if (!alive) return;
      const id0 = (leg.data?.[0] as { id?: string } | undefined)?.id;
      setProyectoModuloId(id0 && !leg.error ? id0 : null);
    })();
    return () => {
      alive = false;
    };
  }, [supabase, proyectoModuloUrl, proyectoObraUrl]);

  const onSolicitudCreada = useCallback(() => {
    setSolicitudTick((t) => t + 1);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ci-resumen-obreros-refresh'));
    }
    router.push(hrefGestionPersonalSolicitados({ proyectoModuloId: proyectoModuloId ?? proyectoModuloUrl }));
  }, [router, proyectoModuloId, proyectoModuloUrl]);

  return (
    <div className="mx-auto max-w-3xl px-4 pb-28 pt-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">RRHH</p>
          <h1 className="text-2xl font-bold tracking-tight text-white">Solicitud de personal obrero</h1>
          <p className="mt-1 max-w-xl text-sm text-zinc-400">
            Tabulador GOE 6.752 (convención colectiva de la construcción): elige{' '}
            <strong className="text-violet-200">oficio</strong> y <strong className="text-violet-200">cantidad</strong>{' '}
            en cada fila.
          </p>
        </div>
        <Link
          href="/rrhh/hojas-vida"
          className="shrink-0 rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-zinc-300 hover:bg-white/10"
        >
          ← RRHH / Hojas de vida
        </Link>
      </div>

      <section className="rounded-2xl border-2 border-violet-400/60 bg-gradient-to-b from-violet-950/50 to-zinc-950/80 p-5 shadow-xl shadow-violet-950/40 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-violet-500/25 pb-4">
          <p className="text-sm text-zinc-300">Paso 1: oficio y cantidad · Paso 2: proyecto destino</p>
          <Link
            href={hrefGestionPersonalSolicitados({ proyectoModuloId: proyectoModuloId ?? proyectoModuloUrl })}
            className="shrink-0 text-xs font-semibold text-violet-200 underline underline-offset-2 hover:text-white"
          >
            Ver solicitados →
          </Link>
        </div>

        <SolicitudPersonalObreroForm
          key={solicitudTick}
          initialProyectoModuloId={proyectoModuloId ?? proyectoModuloUrl}
          initialProyectoObraId={proyectoObraUrl}
          onCreada={onSolicitudCreada}
        />
      </section>
    </div>
  );
}
