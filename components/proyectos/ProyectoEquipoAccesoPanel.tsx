'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Loader2, Users } from 'lucide-react';
import EquipoEntidadPanel from '@/components/configuracion/EquipoEntidadPanel';
import { createClient } from '@/lib/supabase/client';

type Props = {
  proyectoId: string;
};

/** Acceso/roles del patrono de la obra, embebido en Equipo del proyecto. */
export default function ProyectoEquipoAccesoPanel({ proyectoId }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [cargando, setCargando] = useState(true);
  const [entidadId, setEntidadId] = useState<string | null>(null);
  const [entidadNombre, setEntidadNombre] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setCargando(true);
      setError(null);
      try {
        const { data, error: qErr } = await supabase
          .from('ci_proyectos')
          .select('entidad_id, ci_entidades(nombre)')
          .eq('id', proyectoId)
          .maybeSingle();
        if (cancelled) return;
        if (qErr) {
          setError(qErr.message);
          setEntidadId(null);
          setEntidadNombre(null);
          return;
        }
        const eid =
          data && typeof data === 'object' && 'entidad_id' in data
            ? String((data as { entidad_id?: string | null }).entidad_id ?? '').trim()
            : '';
        const rel = (data as { ci_entidades?: { nombre?: string } | { nombre?: string }[] | null })
          ?.ci_entidades;
        const nombreRel = Array.isArray(rel) ? rel[0]?.nombre : rel?.nombre;
        setEntidadId(eid || null);
        setEntidadNombre(nombreRel?.trim() || null);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'No se pudo cargar el patrono del proyecto');
          setEntidadId(null);
        }
      } finally {
        if (!cancelled) setCargando(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [proyectoId, supabase]);

  if (cargando) {
    return (
      <p className="flex items-center gap-2 text-sm text-zinc-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Cargando equipo del proyecto…
      </p>
    );
  }

  if (error) {
    return (
      <p className="rounded-xl border border-red-500/30 bg-red-950/25 px-3 py-2 text-sm text-red-200">
        {error}
      </p>
    );
  }

  if (!entidadId) {
    return (
      <div className="rounded-2xl border border-amber-500/30 bg-amber-950/20 p-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-amber-100">
          <Users className="h-4 w-4" />
          Equipo · acceso
        </p>
        <p className="mt-1 text-xs text-amber-100/80">
          Asigna un patrono (entidad) al proyecto para invitar usuarios y roles de acceso.
        </p>
        <Link
          href={`/proyectos/modulo/${encodeURIComponent(proyectoId)}?editar=1`}
          className="mt-3 inline-block text-xs font-bold text-amber-300 underline hover:text-amber-200"
        >
          Modificar proyecto →
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4 sm:p-5">
      <EquipoEntidadPanel entidadId={entidadId} entidadNombre={entidadNombre ?? undefined} />
    </div>
  );
}
