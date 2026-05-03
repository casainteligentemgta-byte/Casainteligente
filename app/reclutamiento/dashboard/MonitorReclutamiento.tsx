'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

/** Fila tal como en el diseño del dashboard (datos ya calculados en el padre). */
export type MonitorCandidatoFila = {
  id: string;
  nombre: string;
  cargo: string;
  expirado: boolean;
  timer: string;
  progreso: number;
  /** Opcional: enlace «Ver examen» / respuestas. */
  token?: string;
  /** Opcional: para «Dar 2da Oportunidad» vía API. */
  empleadoId?: string;
};

export type CandidatoExamenMonitor = {
  id: string;
  empleadoId: string;
  nombre: string;
  cargo: string;
  token: string;
  expiraAt: string;
  creadoAt: string;
  usadoAt: string | null;
};

type MonitorReclutamientoProps = {
  /** Si se pasa, se usa solo esta lista (sin fetch). Si se omite, se cargan candidatos desde la API. */
  candidatos?: MonitorCandidatoFila[];
};

function formatMmSs(ms: number): string {
  if (ms <= 0) return '00:00';
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

function useCandidatoLive(c: CandidatoExamenMonitor, now: number) {
  return useMemo(() => {
    const exp = new Date(c.expiraAt).getTime();
    const ini = new Date(c.creadoAt).getTime();
    const ventana = Math.max(1, exp - ini);
    const restante = exp - now;
    const expirado = restante <= 0;
    const timer = expirado ? '00:00' : formatMmSs(restante);
    const transcurrido = Math.min(ventana, Math.max(0, now - ini));
    const progreso = Math.round((transcurrido / ventana) * 100);
    return { expirado, timer, progreso };
  }, [c.expiraAt, c.creadoAt, now]);
}

export default function MonitorReclutamiento({ candidatos: candidatosProp }: MonitorReclutamientoProps) {
  const modoControlado = candidatosProp !== undefined;

  const [candidatosApi, setCandidatosApi] = useState<CandidatoExamenMonitor[]>([]);
  const [cargando, setCargando] = useState(!modoControlado);
  const [error, setError] = useState<string | null>(null);
  const [ahora, setAhora] = useState(() => Date.now());
  const [accionId, setAccionId] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const res = await fetch('/api/recruitment/candidatos-examen', { credentials: 'include' });
      const data = (await res.json()) as { candidatos?: CandidatoExamenMonitor[]; error?: string };
      if (!res.ok) {
        setError(data.error ?? 'No se pudo cargar');
        setCandidatosApi([]);
        return;
      }
      setCandidatosApi(data.candidatos ?? []);
      setError(data.error ?? null);
    } catch {
      setError('Error de red');
      setCandidatosApi([]);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (modoControlado) return;
    void cargar();
    const id = window.setInterval(() => setAhora(Date.now()), 1000);
    const id2 = window.setInterval(() => void cargar(), 30_000);
    return () => {
      window.clearInterval(id);
      window.clearInterval(id2);
    };
  }, [cargar, modoControlado]);

  const segundaOportunidad = async (empleadoId: string) => {
    setAccionId(empleadoId);
    try {
      const res = await fetch('/api/recruitment/examen/nueva-invitacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ empleadoId }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok) {
        window.alert(data.error ?? 'Error');
        return;
      }
      if (data.url) {
        await navigator.clipboard.writeText(data.url).catch(() => {});
        window.alert(`Nuevo enlace generado (15 min). Copiado al portapapeles:\n${data.url}`);
      }
      void cargar();
    } finally {
      setAccionId(null);
    }
  };

  const vacioControlado = modoControlado && candidatosProp.length === 0;
  const vacioApi = !modoControlado && !cargando && !error && candidatosApi.length === 0;

  return (
    <div className="mt-8 max-w-full min-w-0 rounded-2xl border border-white/10 bg-zinc-900/50 shadow-lg backdrop-blur-xl">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 p-4">
        <h3 className="font-bold text-white">Candidatos en evaluación (15 min)</h3>
        {!modoControlado ? (
          <button
            type="button"
            onClick={() => void cargar()}
            className="text-xs font-bold text-sky-400 hover:text-sky-300"
          >
            Actualizar
          </button>
        ) : null}
      </div>

      {!modoControlado && cargando ? (
        <p className="p-4 text-sm text-zinc-400">Cargando…</p>
      ) : !modoControlado && error ? (
        <p className="p-4 text-sm text-red-400">{error}</p>
      ) : vacioControlado || vacioApi ? (
        <p className="p-4 text-sm text-zinc-500">No hay candidatos en evaluación.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="border-b border-white/10 bg-black/30">
              <tr>
                <th className="p-4 font-semibold text-zinc-400">Candidato / cargo</th>
                <th className="p-4 font-semibold text-zinc-400">Tiempo restante</th>
                <th className="p-4 text-center font-semibold text-zinc-400">Avance</th>
                <th className="p-4 text-right font-semibold text-zinc-400">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {modoControlado
                ? candidatosProp.map((c) => (
                    <FilaCandidatoControlado
                      key={c.id}
                      c={c}
                      accionId={accionId}
                      onSegundaOportunidad={
                        c.empleadoId ? () => void segundaOportunidad(c.empleadoId!) : undefined
                      }
                    />
                  ))
                : candidatosApi.map((c) => (
                    <FilaCandidatoApi
                      key={c.id}
                      c={c}
                      ahora={ahora}
                      accionId={accionId}
                      onSegundaOportunidad={() => void segundaOportunidad(c.empleadoId)}
                    />
                  ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FilaCandidatoControlado({
  c,
  accionId,
  onSegundaOportunidad,
}: {
  c: MonitorCandidatoFila;
  accionId: string | null;
  onSegundaOportunidad?: () => void;
}) {
  const busy = c.empleadoId != null && accionId === c.empleadoId;
  return (
    <tr className="border-b border-white/5 transition hover:bg-white/[0.03]">
      <td className="p-4">
        <div className="font-bold text-white">{c.nombre}</div>
        <div className="text-xs text-zinc-500">{c.cargo}</div>
      </td>
      <td className="p-4">
        <span className={c.expirado ? 'font-bold text-red-400' : 'font-medium text-sky-400'}>
          {c.expirado ? 'EXPIRADO' : c.timer}
        </span>
      </td>
      <td className="p-4">
        <div className="mx-auto h-1.5 w-full max-w-[160px] rounded-full bg-zinc-800">
          <div className="h-1.5 rounded-full bg-sky-500" style={{ width: `${c.progreso}%` }} />
        </div>
      </td>
      <td className="whitespace-nowrap p-4 text-right">
        {c.expirado && onSegundaOportunidad ? (
          <button
            type="button"
            disabled={busy}
            onClick={onSegundaOportunidad}
            className="rounded-lg bg-amber-500/20 px-3 py-1 text-xs font-bold text-amber-200 hover:bg-amber-500/30 disabled:opacity-50"
          >
            {busy ? '…' : 'Dar 2da oportunidad'}
          </button>
        ) : null}
        {c.token ? (
          <a
            href={`/talento/examen?token=${encodeURIComponent(c.token)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-2 inline-block text-xs font-bold text-sky-400 hover:underline"
          >
            Ver respuestas
          </a>
        ) : (
          <button type="button" className="ml-2 text-xs font-bold text-zinc-600">
            Ver respuestas
          </button>
        )}
      </td>
    </tr>
  );
}

function FilaCandidatoApi({
  c,
  ahora,
  accionId,
  onSegundaOportunidad,
}: {
  c: CandidatoExamenMonitor;
  ahora: number;
  accionId: string | null;
  onSegundaOportunidad: () => void;
}) {
  const { expirado, timer, progreso } = useCandidatoLive(c, ahora);
  const busy = accionId === c.empleadoId;

  return (
    <tr className="border-b border-white/5 transition hover:bg-white/[0.03]">
      <td className="p-4">
        <div className="font-bold text-white">{c.nombre}</div>
        <div className="text-xs text-zinc-500">{c.cargo}</div>
      </td>
      <td className="p-4">
        <span className={expirado ? 'font-bold text-red-400' : 'font-medium text-sky-400'}>
          {expirado ? 'EXPIRADO' : timer}
        </span>
      </td>
      <td className="p-4">
        <div className="mx-auto h-1.5 w-full max-w-[160px] rounded-full bg-zinc-800">
          <div
            className={`h-1.5 rounded-full ${expirado ? 'bg-red-500' : 'bg-sky-500'}`}
            style={{ width: `${progreso}%` }}
          />
        </div>
      </td>
      <td className="whitespace-nowrap p-4 text-right">
        {expirado ? (
          <button
            type="button"
            disabled={busy}
            onClick={onSegundaOportunidad}
            className="rounded-lg bg-amber-500/20 px-3 py-1 text-xs font-bold text-amber-200 hover:bg-amber-500/30 disabled:opacity-50"
          >
            {busy ? '…' : 'Dar 2da oportunidad'}
          </button>
        ) : null}
        <a
          href={`/talento/examen?token=${encodeURIComponent(c.token)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-2 inline-block text-xs font-bold text-sky-400 hover:underline"
        >
          Ver respuestas
        </a>
      </td>
    </tr>
  );
}
