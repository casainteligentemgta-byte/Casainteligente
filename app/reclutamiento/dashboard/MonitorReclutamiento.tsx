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
      setError(null);
      setCandidatosApi(data.candidatos ?? []);
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
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 mt-8 max-w-full w-full min-w-0">
      <div className="p-4 border-b border-slate-100 flex justify-between items-center flex-wrap gap-2">
        <h3 className="font-bold text-slate-800">Candidatos en Evaluación (15 min)</h3>
        {!modoControlado ? (
          <button
            type="button"
            onClick={() => void cargar()}
            className="text-xs font-bold text-blue-600 hover:text-blue-700"
          >
            Actualizar
          </button>
        ) : null}
      </div>

      {!modoControlado && cargando ? (
        <p className="p-4 text-sm text-slate-500">Cargando…</p>
      ) : !modoControlado && error ? (
        <p className="p-4 text-sm text-red-600">{error}</p>
      ) : vacioControlado || vacioApi ? (
        <p className="p-4 text-sm text-slate-500">No hay candidatos en evaluación.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[520px]">
            <thead className="bg-slate-50">
              <tr>
                <th className="p-4">Candidato / Cargo</th>
                <th className="p-4">Tiempo Restante</th>
                <th className="p-4 text-center">Avance</th>
                <th className="p-4 text-right">Acciones</th>
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
    <tr className="border-b border-slate-50 hover:bg-slate-50">
      <td className="p-4">
        <div className="font-bold text-slate-900">{c.nombre}</div>
        <div className="text-xs text-slate-400">{c.cargo}</div>
      </td>
      <td className="p-4">
        <span className={c.expirado ? 'text-red-500 font-bold' : 'text-blue-600'}>
          {c.expirado ? 'EXPIRADO' : c.timer}
        </span>
      </td>
      <td className="p-4">
        <div className="w-full bg-slate-100 h-1.5 rounded-full max-w-[160px] mx-auto">
          <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${c.progreso}%` }} />
        </div>
      </td>
      <td className="p-4 text-right whitespace-nowrap">
        {c.expirado && onSegundaOportunidad ? (
          <button
            type="button"
            disabled={busy}
            onClick={onSegundaOportunidad}
            className="bg-yellow-100 text-yellow-700 px-3 py-1 rounded-lg text-xs font-bold hover:bg-yellow-200 disabled:opacity-50"
          >
            {busy ? '…' : 'Dar 2da Oportunidad'}
          </button>
        ) : null}
        {c.token ? (
          <a
            href={`/talento/examen?token=${encodeURIComponent(c.token)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-2 text-blue-600 font-bold text-xs hover:underline inline-block"
          >
            Ver Respuestas
          </a>
        ) : (
          <button type="button" className="ml-2 text-blue-600 font-bold text-xs">
            Ver Respuestas
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
    <tr className="border-b border-slate-50 hover:bg-slate-50">
      <td className="p-4">
        <div className="font-bold text-slate-900">{c.nombre}</div>
        <div className="text-xs text-slate-400">{c.cargo}</div>
      </td>
      <td className="p-4">
        <span className={expirado ? 'text-red-500 font-bold' : 'text-blue-600'}>
          {expirado ? 'EXPIRADO' : timer}
        </span>
      </td>
      <td className="p-4">
        <div className="w-full bg-slate-100 h-1.5 rounded-full max-w-[160px] mx-auto">
          <div
            className={`h-1.5 rounded-full ${expirado ? 'bg-red-500' : 'bg-blue-500'}`}
            style={{ width: `${progreso}%` }}
          />
        </div>
      </td>
      <td className="p-4 text-right whitespace-nowrap">
        {expirado ? (
          <button
            type="button"
            disabled={busy}
            onClick={onSegundaOportunidad}
            className="bg-yellow-100 text-yellow-700 px-3 py-1 rounded-lg text-xs font-bold hover:bg-yellow-200 disabled:opacity-50"
          >
            {busy ? '…' : 'Dar 2da Oportunidad'}
          </button>
        ) : null}
        <a
          href={`/talento/examen?token=${encodeURIComponent(c.token)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-2 text-blue-600 font-bold text-xs hover:underline inline-block"
        >
          Ver Respuestas
        </a>
      </td>
    </tr>
  );
}
