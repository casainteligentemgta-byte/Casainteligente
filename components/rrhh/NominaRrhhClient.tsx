'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Wallet } from 'lucide-react';
import CuadroNominaContratados from '@/components/nomina/CuadroNominaContratados';
import {
  loadProyectosSmartRrhhHojasVida,
  type ProyectoModuloIntegral,
} from '@/lib/proyectos/proyectosUnificados';
import { hrefRrhhHub } from '@/lib/rrhh/hrefSolicitudPersonal';
import {
  esUuidProyectoModulo,
  guardarProyectoRrhhContexto,
  leerProyectoRrhhContexto,
} from '@/lib/rrhh/proyectoRrhhContexto';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';

export default function NominaRrhhClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);
  const urlProyecto = (searchParams.get('proyecto_modulo') ?? searchParams.get('proyecto') ?? '').trim();

  const [proyectos, setProyectos] = useState<ProyectoModuloIntegral[]>([]);
  const [proyectoId, setProyectoId] = useState(urlProyecto);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let alive = true;
    void (async () => {
      setCargando(true);
      const { proyectos: lista } = await loadProyectosSmartRrhhHojasVida(supabase);
      if (!alive) return;
      setProyectos(lista);
      setProyectoId((prev) => {
        if (urlProyecto && lista.some((p) => p.id === urlProyecto)) return urlProyecto;
        if (prev && lista.some((p) => p.id === prev)) return prev;
        const stored = leerProyectoRrhhContexto();
        if (stored && lista.some((p) => p.id === stored)) return stored;
        return lista[0]?.id ?? '';
      });
      setCargando(false);
    })();
    return () => {
      alive = false;
    };
  }, [supabase, urlProyecto]);

  useEffect(() => {
    if (cargando) return;
    const id = proyectoId.trim();
    if (esUuidProyectoModulo(id)) guardarProyectoRrhhContexto(id);
    const actual = (searchParams.get('proyecto_modulo') ?? '').trim();
    if (id === actual) return;
    const params = new URLSearchParams(searchParams.toString());
    if (id) params.set('proyecto_modulo', id);
    else params.delete('proyecto_modulo');
    params.delete('proyecto');
    const q = params.toString();
    router.replace(q ? `/rrhh/nomina?${q}` : '/rrhh/nomina', { scroll: false });
  }, [proyectoId, cargando, router, searchParams]);

  const obra = proyectos.find((p) => p.id === proyectoId) ?? null;
  const hrefVolver = hrefRrhhHub({ proyectoModuloId: proyectoId || null });

  return (
    <div className="mx-auto max-w-6xl px-4 pb-28 pt-6">
      <header className="mb-6">
        <div className="flex items-start gap-3">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0 border-white/15 bg-zinc-900/50 text-zinc-200 hover:bg-white/10"
            asChild
          >
            <Link href={hrefVolver} aria-label="Volver a RRHH">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">RRHH</p>
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-white">
              <Wallet className="h-6 w-6 shrink-0 text-emerald-400" aria-hidden />
              Nómina
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              Contratados activos del proyecto seleccionado.
            </p>
          </div>
        </div>

        <label className="mt-4 block max-w-md space-y-1.5">
          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
            Proyecto
          </span>
          <select
            className="w-full rounded-xl border border-white/15 bg-zinc-950 px-3 py-2.5 text-sm font-semibold text-white outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/30"
            value={proyectoId}
            onChange={(e) => setProyectoId(e.target.value)}
            disabled={cargando || proyectos.length === 0}
          >
            {proyectos.length === 0 ? <option value="">Sin proyectos</option> : null}
            {proyectos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </label>
      </header>

      {cargando ? (
        <p className="text-sm text-zinc-500">Cargando…</p>
      ) : proyectoId ? (
        <CuadroNominaContratados
          key={proyectoId}
          proyectoModuloId={proyectoId}
          titulo={
            obra?.nombre
              ? `Contratados activos — ${obra.nombre}`
              : 'Contratados activos'
          }
        />
      ) : (
        <p className="rounded-xl border border-amber-500/25 bg-amber-950/20 px-4 py-3 text-sm text-amber-100/90">
          No hay proyecto para mostrar nómina. Crea o selecciona una obra en RRHH.
        </p>
      )}
    </div>
  );
}
