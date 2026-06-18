'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, HardHat, Loader2, UserCog } from 'lucide-react';
import IngenieroResidenteObraCard from '@/components/proyectos/IngenieroResidenteObraCard';
import { createClient } from '@/lib/supabase/client';
import { listarNominaProyecto, type FilaNominaProyecto } from '@/lib/proyectos/proyectoNomina';
import { ROLES_NOMINA_EMPLEADO } from '@/lib/proyectos/rolesProyectoNomina';
import { parseFetchJson } from '@/lib/utils/parseFetchJson';

type Props = {
  proyectoModuloId: string;
};

export default function ListaEmpleosHojasVida({ proyectoModuloId }: Props) {
  const [abierto, setAbierto] = useState<string | null>(null);
  const [nomina, setNomina] = useState<FilaNominaProyecto[]>([]);
  const [ingenieroNombre, setIngenieroNombre] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const pid = proyectoModuloId.trim();
    const [filas, resIng] = await Promise.all([
      listarNominaProyecto(supabase, pid, { categoria: 'empleado' }),
      fetch(`/api/proyectos/${encodeURIComponent(pid)}/campo/equipo`, { cache: 'no-store' }),
    ]);

    setNomina(filas.filter((f) => f.rol !== 'ingeniero_residente'));

    try {
      const json = await parseFetchJson<{
        ingenieroAsignado?: { nombre?: string } | null;
      }>(resIng);
      const nom = json.ingenieroAsignado?.nombre?.trim();
      setIngenieroNombre(nom || null);
    } catch {
      setIngenieroNombre(null);
    }

    setLoading(false);
  }, [proyectoModuloId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const filasPorRol = useMemo(() => {
    const m = new Map<string, FilaNominaProyecto[]>();
    for (const r of ROLES_NOMINA_EMPLEADO) {
      if (r.value === 'ingeniero_residente') continue;
      m.set(r.value, []);
    }
    for (const f of nomina) {
      const lista = m.get(f.rol);
      if (lista) lista.push(f);
      else m.set(f.rol, [f]);
    }
    return m;
  }, [nomina]);

  const toggle = (rol: string) => {
    setAbierto((prev) => (prev === rol ? null : rol));
  };

  if (loading) {
    return (
      <section className="mb-8 flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-6 text-sm text-zinc-500">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Cargando empleos…
      </section>
    );
  }

  return (
    <section className="mb-8 rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-xl">
      <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-zinc-500">Empleos</h2>
      <ul className="overflow-hidden rounded-xl border border-white/10 divide-y divide-white/10">
        <li>
          <button
            type="button"
            onClick={() => toggle('ingeniero_residente')}
            className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition hover:bg-white/5"
          >
            <span className="flex min-w-0 items-center gap-2.5 font-semibold text-white">
              {abierto === 'ingeniero_residente' ? (
                <ChevronDown className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden />
              ) : (
                <ChevronRight className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
              )}
              <HardHat className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden />
              <span className="truncate">Ingeniero residente</span>
            </span>
            <span className="shrink-0 text-xs text-zinc-500">
              {ingenieroNombre ? ingenieroNombre : 'Sin asignar'}
            </span>
          </button>
          {abierto === 'ingeniero_residente' ? (
            <div className="border-t border-white/10 bg-zinc-950/40 px-3 py-3">
              <IngenieroResidenteObraCard
                proyectoId={proyectoModuloId}
                embedded
                onGuardado={() => void cargar()}
              />
            </div>
          ) : null}
        </li>

        {ROLES_NOMINA_EMPLEADO.filter((r) => r.value !== 'ingeniero_residente').map((rol) => {
          const expandido = abierto === rol.value;
          const filas = filasPorRol.get(rol.value) ?? [];

          return (
            <li key={rol.value}>
              <button
                type="button"
                onClick={() => toggle(rol.value)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition hover:bg-white/5"
              >
                <span className="flex min-w-0 items-center gap-2.5 font-semibold text-white">
                  {expandido ? (
                    <ChevronDown className="h-4 w-4 shrink-0 text-sky-400" aria-hidden />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
                  )}
                  <UserCog className="h-4 w-4 shrink-0 text-sky-400/80" aria-hidden />
                  <span className="truncate">{rol.label}</span>
                </span>
                <span className="shrink-0 text-xs text-zinc-500">
                  {filas.length > 0 ? `${filas.length} asignado${filas.length === 1 ? '' : 's'}` : 'Sin asignar'}
                </span>
              </button>
              {expandido ? (
                <div className="border-t border-white/10 bg-zinc-950/40 px-4 py-3">
                  {filas.length === 0 ? (
                    <p className="text-sm text-zinc-500">Sin personal asignado a este empleo.</p>
                  ) : (
                    <ul className="space-y-2">
                      {filas.map((f) => (
                        <li
                          key={f.id}
                          className="grid gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm sm:grid-cols-[1fr_auto_auto]"
                        >
                          {f.empleado_id ? (
                            <Link
                              href={`/empleados/${encodeURIComponent(f.empleado_id)}`}
                              className="font-medium text-sky-300 underline decoration-sky-500/30 hover:text-sky-200"
                            >
                              {f.nombre_display}
                            </Link>
                          ) : (
                            <span className="font-medium text-zinc-100">{f.nombre_display}</span>
                          )}
                          <span className="tabular-nums text-zinc-400">{f.cedula || '—'}</span>
                          <span className="tabular-nums text-zinc-500">
                            {f.empleado_celular || f.telegram_telefono || '—'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
