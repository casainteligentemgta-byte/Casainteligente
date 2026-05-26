'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { RefreshCw } from 'lucide-react';
import CronogramaGantt from '@/components/proyectos/CronogramaGantt';
import CronogramaTareaSlideOver from '@/components/proyectos/CronogramaTareaSlideOver';
import type { CronogramaTarea } from '@/types/cronograma';
import { formatApiErrorBody, formatErrorMessage } from '@/lib/utils/formatErrorMessage';
import { parseFetchJson } from '@/lib/utils/parseFetchJson';

type Props = {
  proyectoId: string;
  /** Muestra vista previa desde partidas si el cronograma está vacío. */
  vistaPreviaDesdePartidas?: boolean;
};

export default function CronogramaObraPanel({
  proyectoId,
  vistaPreviaDesdePartidas = true,
}: Props) {
  const [tareas, setTareas] = useState<CronogramaTarea[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [origen, setOrigen] = useState<string | null>(null);
  const [tareaActiva, setTareaActiva] = useState<CronogramaTarea | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setAviso(null);
    try {
      const q = vistaPreviaDesdePartidas ? '?borrador=1' : '';
      const res = await fetch(
        `/api/proyectos/${encodeURIComponent(proyectoId)}/cronograma${q}`,
      );
      const data = await parseFetchJson<{
        error?: string;
        tareas?: CronogramaTarea[];
        aviso?: string;
        origen?: string;
      }>(res);
      if (!res.ok) throw new Error(formatApiErrorBody(data, 'Error al cargar cronograma'));
      setTareas(data.tareas ?? []);
      setAviso(data.aviso ?? null);
      setOrigen(data.origen ?? null);
    } catch (e) {
      setError(formatErrorMessage(e));
      setTareas([]);
    } finally {
      setLoading(false);
    }
  }, [proyectoId, vistaPreviaDesdePartidas]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-zinc-500 max-w-xl">
          Diagrama de Gantt semanal/mensual. Barras grises/azul: planificado; verde/rojo/ámbar: avance
          según fecha y porcentaje. Clic en una actividad para ver partida, APU y evidencias Telegram.
        </p>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-800"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Actualizar
        </button>
      </div>

      {error ? (
        <p className="text-sm text-red-400 rounded-lg border border-red-500/30 bg-red-950/30 px-3 py-2">
          {error}
        </p>
      ) : null}

      {aviso ? (
        <p className="text-xs text-amber-200/90 rounded-lg border border-amber-500/30 bg-amber-950/25 px-3 py-2">
          {aviso}
          {origen === 'borrador_partidas' ? (
            <>
              {' '}
              <Link
                href={`/proyectos/modulo/${proyectoId}/lulo`}
                className="text-sky-400 hover:underline font-semibold"
              >
                Importar Lulo
              </Link>
            </>
          ) : null}
        </p>
      ) : null}

      <CronogramaGantt
        tareas={tareas}
        loading={loading}
        onTareaClick={setTareaActiva}
      />

      <CronogramaTareaSlideOver tarea={tareaActiva} onClose={() => setTareaActiva(null)} />
    </div>
  );
}
