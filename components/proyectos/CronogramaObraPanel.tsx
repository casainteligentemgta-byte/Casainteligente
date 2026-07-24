'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { RefreshCw } from 'lucide-react';
import CronogramaAvanceDiarioPanel from '@/components/proyectos/CronogramaAvanceDiarioPanel';
import CronogramaGantt from '@/components/proyectos/CronogramaGantt';
import CronogramaTareaSlideOver from '@/components/proyectos/CronogramaTareaSlideOver';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { CronogramaCapitulo, CronogramaTarea } from '@/types/cronograma';
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
  const [capitulos, setCapitulos] = useState<CronogramaCapitulo[]>([]);
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
        capitulos?: CronogramaCapitulo[];
        aviso?: string;
        origen?: string;
      }>(res);
      if (!res.ok) throw new Error(formatApiErrorBody(data, 'Error al cargar cronograma'));
      setTareas(data.tareas ?? []);
      setCapitulos(data.capitulos ?? []);
      setAviso(data.aviso ?? null);
      setOrigen(data.origen ?? null);
    } catch (e) {
      setError(formatErrorMessage(e));
      setTareas([]);
      setCapitulos([]);
    } finally {
      setLoading(false);
    }
  }, [proyectoId, vistaPreviaDesdePartidas]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4 bg-[#0A0A0F]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-zinc-500 max-w-xl">
          Control diario de avance físico y planificación Gantt por capítulos Lulo.
        </p>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex select-none items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-white/[0.08] touch-manipulation"
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

      <Tabs defaultValue="avance" className="w-full">
        <TabsList className="grid h-12 w-full max-w-lg grid-cols-2 border border-white/10 bg-white/[0.04] p-1">
          <TabsTrigger
            value="avance"
            className="select-none rounded-lg text-xs font-bold uppercase tracking-wide data-[state=active]:bg-white/10 data-[state=active]:text-white"
          >
            Avance diario
          </TabsTrigger>
          <TabsTrigger
            value="gantt"
            className="select-none rounded-lg text-xs font-bold uppercase tracking-wide data-[state=active]:bg-white/10 data-[state=active]:text-white"
          >
            Gantt / planificación
          </TabsTrigger>
        </TabsList>

        <TabsContent value="avance" className="mt-4">
          <CronogramaAvanceDiarioPanel
            proyectoId={proyectoId}
            capitulos={capitulos}
            loading={loading}
            onSaved={() => void load()}
          />
        </TabsContent>

        <TabsContent value="gantt" className="mt-4">
          <CronogramaGantt
            tareas={tareas}
            capitulos={capitulos}
            loading={loading}
            onTareaClick={setTareaActiva}
          />
        </TabsContent>
      </Tabs>

      <CronogramaTareaSlideOver tarea={tareaActiva} onClose={() => setTareaActiva(null)} />
    </div>
  );
}
