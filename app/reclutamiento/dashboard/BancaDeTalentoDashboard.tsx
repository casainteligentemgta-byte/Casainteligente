'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiUrl } from '@/lib/http/apiUrl';

type KanbanColumnId = 'invitados' | 'evaluando' | 'banca' | 'asignados';

type FunnelCandidato = {
  id: string;
  nombre: string;
  cargo: string;
  nivel: string;
  columna: KanbanColumnId;
  perfil_color?: string | null;
  puntuacion_logica?: number | null;
};

type ProyectoOpt = { id: string; nombre: string };

function veredictoDesdePerfil(perfil: string | null | undefined): string {
  const p = (perfil ?? '').trim().toLowerCase();
  if (p.includes('verde')) return 'Verde';
  if (p.includes('amarillo') || p.includes('ambar') || p.includes('ámbar')) return 'Amarillo';
  if (p.includes('rojo')) return 'Rojo';
  if (p.includes('azul')) return 'Azul';
  return '—';
}

export default function BancaDeTalentoDashboard() {
  const [isAssigning, setIsAssigning] = useState<string | null>(null);
  const [banca, setBanca] = useState<FunnelCandidato[]>([]);
  const [proyectosActivos, setProyectosActivos] = useState<ProyectoOpt[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const res = await fetch(apiUrl('/api/recruitment/dashboard-funnel'), { credentials: 'include' });
      const data = (await res.json().catch(() => ({}))) as {
        candidatos?: FunnelCandidato[];
        proyectos?: ProyectoOpt[];
        error?: string;
      };
      if (res.status === 401) {
        setBanca([]);
        setProyectosActivos([]);
        setError('Autenticación requerida para ver la banca (mismo acceso que el panel RRHH).');
        return;
      }
      if (!res.ok) {
        setBanca([]);
        setProyectosActivos([]);
        setError(data.error ?? `Error ${res.status}`);
        return;
      }
      const todos = Array.isArray(data.candidatos) ? data.candidatos : [];
      setBanca(todos.filter((c) => c.columna === 'banca'));
      setProyectosActivos(Array.isArray(data.proyectos) ? data.proyectos : []);
    } catch {
      setError('Error de red');
      setBanca([]);
      setProyectosActivos([]);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const tarjetas = useMemo(
    () =>
      banca.map((emp) => ({
        ...emp,
        veredicto: veredictoDesdePerfil(emp.perfil_color),
        confianza: Math.min(100, Math.max(0, Math.round(Number(emp.puntuacion_logica ?? 0)))),
      })),
    [banca],
  );

  const handleAsignar = (proyectoId: string) => {
    if (typeof window !== 'undefined') {
      window.open(`/proyectos/modulo/${encodeURIComponent(proyectoId)}?tab=rrhh`, '_blank', 'noopener,noreferrer');
    }
    setIsAssigning(null);
  };

  return (
    <section className="mt-8 max-w-full min-w-0 rounded-2xl border border-white/10 bg-zinc-900/50 p-5 shadow-lg backdrop-blur-xl sm:p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-white sm:text-xl">Banca de talento</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Postulantes con <code className="text-zinc-500">examen_completado</code> en{' '}
            <code className="text-zinc-500">ci_empleados</code>, pendientes de aprobación RRHH (
            <code className="text-zinc-500">estado ≠ aprobado</code>).
          </p>
        </div>
        <button
          type="button"
          disabled={cargando}
          onClick={() => void cargar()}
          className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:bg-white/10 disabled:opacity-50"
        >
          {cargando ? '…' : 'Actualizar'}
        </button>
      </div>

      {error ? <p className="mb-4 text-sm text-amber-200/90">{error}</p> : null}
      {cargando && tarjetas.length === 0 && !error ? <p className="mb-4 text-sm text-zinc-500">Cargando…</p> : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {tarjetas.map((emp) => (
          <div
            key={emp.id}
            className="flex flex-col justify-between rounded-2xl border border-white/10 bg-black/30 p-5 shadow-md transition hover:border-white/15"
          >
            <div>
              <div className="mb-4 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate text-base font-bold text-white">{emp.nombre}</h3>
                  <span className="mt-1 inline-block rounded-lg border border-[#FF9500]/30 bg-[#FF9500]/10 px-2 py-1 text-xs font-medium text-[#FFD60A]">
                    {emp.cargo} · {emp.nivel}
                  </span>
                </div>
                <div
                  className={`mt-1 h-3 w-3 shrink-0 rounded-full shadow-md ${
                    emp.veredicto === 'Verde'
                      ? 'bg-emerald-400 shadow-emerald-500/40'
                      : emp.veredicto === 'Rojo'
                        ? 'bg-red-400 shadow-red-500/40'
                        : emp.veredicto === 'Amarillo' || emp.veredicto === 'Azul'
                          ? 'bg-amber-400 shadow-amber-500/40'
                          : 'bg-zinc-500'
                  }`}
                  title={`Perfil: ${emp.veredicto}`}
                />
              </div>

              <div className="mb-6 rounded-xl border border-white/10 bg-white/[0.04] p-3">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                  Puntuación lógica (referencia)
                </p>
                <div className="flex items-center gap-3">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-800">
                    <div
                      className={`h-full rounded-full ${
                        emp.veredicto === 'Verde' ? 'bg-gradient-to-r from-emerald-400 to-emerald-600' : 'bg-amber-400'
                      }`}
                      style={{ width: `${emp.confianza}%` }}
                    />
                  </div>
                  <span className="text-sm font-bold tabular-nums text-[#FFD60A]">{emp.confianza}%</span>
                </div>
              </div>

              <p className="mb-3 text-[11px] text-zinc-500">
                <Link href={`/rrhh/hojas-vida`} className="text-sky-400 hover:underline">
                  Hojas de vida RRHH
                </Link>{' '}
                · revisar y aprobar para contrato.
              </p>
            </div>

            {isAssigning === emp.id ? (
              <div className="rounded-xl border border-white/10 bg-zinc-950/60 p-3">
                <label className="mb-2 block text-[10px] font-bold uppercase tracking-wide text-zinc-500">
                  Abrir proyecto (gestión RRHH en módulo)
                </label>
                <select
                  className="mb-3 w-full rounded-lg border border-white/10 bg-black/40 p-2 text-sm text-white outline-none focus:ring-2 focus:ring-[#FF9500]/40"
                  defaultValue=""
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v) handleAsignar(v);
                  }}
                >
                  <option value="" disabled>
                    Elegir proyecto…
                  </option>
                  {proyectosActivos.map((p) => (
                    <option key={p.id} value={p.id} className="bg-zinc-900">
                      {p.nombre}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setIsAssigning(null)}
                  className="w-full text-center text-xs font-semibold text-zinc-500 transition hover:text-zinc-300"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsAssigning(emp.id)}
                className="w-full rounded-xl bg-gradient-to-r from-[#FFD60A] via-[#FFB020] to-[#FF9500] py-3 text-sm font-bold text-[#0A0A0F] shadow-[0_0_12px_rgba(249,115,22,0.25)] transition hover:brightness-105 active:scale-[0.99]"
              >
                Ir a proyecto (RRHH)
              </button>
            )}
          </div>
        ))}

        {tarjetas.length === 0 ? (
          <div className="col-span-full rounded-2xl border border-dashed border-white/15 bg-black/20 p-12 text-center">
            <span className="mb-3 block text-3xl opacity-60" aria-hidden>
              —
            </span>
            <h3 className="text-base font-bold text-zinc-200">La banca está vacía</h3>
            <p className="mt-2 text-sm text-zinc-500">
              Nadie en estado <code className="text-zinc-400">examen_completado</code> sin aprobación final. Los
              exámenes en curso aparecen en «Candidatos en evaluación» debajo.
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
