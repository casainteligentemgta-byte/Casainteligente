'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Camera,
  Layers,
  Loader2,
  Package,
  X,
} from 'lucide-react';
import ApuAnalisisPanel from '@/components/proyectos/ApuAnalisisPanel';
import type { CronogramaTarea } from '@/types/cronograma';
import type { LineaApuInsumoLulo, MargenesProyectoApu, PartidaApuLulo } from '@/types/apu-lulo';
import { formatFechaCorta, parseFechaPlan } from '@/lib/proyectos/cronogramaGanttLayout';
import { formatApiErrorBody, formatErrorMessage } from '@/lib/utils/formatErrorMessage';
import { parseFetchJson } from '@/lib/utils/parseFetchJson';
type Props = {
  tarea: CronogramaTarea | null;
  onClose: () => void;
};

export default function CronogramaTareaSlideOver({ tarea, onClose }: Props) {
  const [loadingApu, setLoadingApu] = useState(false);
  const [partida, setPartida] = useState<PartidaApuLulo | null>(null);
  const [lineas, setLineas] = useState<LineaApuInsumoLulo[]>([]);
  const [margenes, setMargenes] = useState<MargenesProyectoApu | undefined>();
  const [errorApu, setErrorApu] = useState<string | null>(null);

  const loadApu = useCallback(async (partidaId: string) => {
    setLoadingApu(true);
    setErrorApu(null);
    try {
      const res = await fetch(`/api/proyectos/lulo/partidas/${encodeURIComponent(partidaId)}/apu`);
      const data = await parseFetchJson<{
        error?: string;
        partida?: PartidaApuLulo;
        lineas?: LineaApuInsumoLulo[];
        margenes?: MargenesProyectoApu;
      }>(res);
      if (!res.ok) throw new Error(formatApiErrorBody(data, 'No se pudo cargar el APU'));
      setPartida(data.partida ?? null);
      setLineas(data.lineas ?? []);
      setMargenes(data.margenes);
    } catch (e) {
      setErrorApu(formatErrorMessage(e));
      setPartida(null);
      setLineas([]);
    } finally {
      setLoadingApu(false);
    }
  }, []);

  useEffect(() => {
    if (!tarea?.partida_id) {
      setPartida(null);
      setLineas([]);
      setErrorApu(null);
      return;
    }
    void loadApu(tarea.partida_id);
  }, [tarea?.partida_id, loadApu]);

  useEffect(() => {
    if (!tarea) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tarea, onClose]);

  if (!tarea) return null;

  const fotos = tarea.evidencias_fotos ?? [];
  const videos = tarea.evidencias_videos ?? [];
  const inicio = parseFechaPlan(tarea.fecha_inicio_planificada);
  const fin = parseFechaPlan(tarea.fecha_fin_planificada);

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm"
        aria-label="Cerrar panel"
        onClick={onClose}
      />
      <aside
        className="fixed inset-y-0 right-0 z-[75] flex w-full max-w-md flex-col border-l border-zinc-800 bg-[#0A0A0F] shadow-2xl animate-in slide-in-from-right duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cronograma-slide-title"
      >
        <div className="flex items-start justify-between gap-3 border-b border-zinc-800 px-4 py-4 shrink-0">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-sky-400/90">
              Actividad · cronograma
            </p>
            <h2 id="cronograma-slide-title" className="text-base font-bold text-zinc-100 mt-0.5">
              {tarea.nombre_tarea}
            </h2>
            {tarea.codigo_partida ? (
              <p className="font-mono text-xs text-sky-400 mt-1">{tarea.codigo_partida}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
          <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
            <h3 className="text-xs font-bold text-zinc-300 mb-2">Planificación</h3>
            <dl className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <dt className="text-zinc-500">Inicio</dt>
                <dd className="text-zinc-200 font-medium">{formatFechaCorta(inicio)}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Fin</dt>
                <dd className="text-zinc-200 font-medium">{formatFechaCorta(fin)}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-zinc-500">Avance reportado</dt>
                <dd className="text-emerald-400 font-bold text-lg">
                  {Number(tarea.porcentaje_avance).toFixed(0)}%
                </dd>
                <div className="mt-2 h-2 rounded-full bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full bg-emerald-500/90 rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, Math.max(0, Number(tarea.porcentaje_avance)))}%`,
                    }}
                  />
                </div>
              </div>
            </dl>
          </section>

          <section>
            <h3 className="flex items-center gap-2 text-xs font-bold text-zinc-300 mb-2">
              <Package className="h-4 w-4 text-violet-400" />
              Partida física
            </h3>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-3 text-sm text-zinc-300">
              {tarea.descripcion_partida ? (
                <>
                  <p>{tarea.descripcion_partida}</p>
                  {tarea.unidad_partida ? (
                    <p className="mt-2 text-xs text-zinc-500">
                      Unidad: <span className="text-zinc-300">{tarea.unidad_partida}</span>
                      {tarea.cantidad_presupuestada != null ? (
                        <>
                          {' '}
                          · Cant. presup.:{' '}
                          <span className="text-zinc-300">
                            {tarea.cantidad_presupuestada}
                          </span>
                        </>
                      ) : null}
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="text-zinc-500 text-xs italic">
                  {tarea.partida_id
                    ? 'Cargando datos de partida…'
                    : 'Sin partida vinculada. Vincule codigo_partida en cronograma_tareas.'}
                </p>
              )}
            </div>
          </section>

          <section>
            <h3 className="flex items-center gap-2 text-xs font-bold text-zinc-300 mb-2">
              <Layers className="h-4 w-4 text-violet-400" />
              APU e insumos
            </h3>
            {loadingApu ? (
              <div className="flex items-center gap-2 text-sm text-zinc-500 py-6">
                <Loader2 className="h-4 w-4 animate-spin" />
                Cargando composición…
              </div>
            ) : errorApu ? (
              <p className="text-xs text-amber-400/90 rounded-lg border border-amber-500/30 bg-amber-950/30 p-3">
                {errorApu}
              </p>
            ) : tarea.partida_id && partida ? (
              <ApuAnalisisPanel partida={partida} lineas={lineas} margenes={margenes} />
            ) : (
              <p className="text-xs text-zinc-500 italic">
                Mock: al vincular partida_id se listan insumos, rendimientos y costos del APU Lulo.
              </p>
            )}
          </section>

          <section>
            <h3 className="flex items-center gap-2 text-xs font-bold text-zinc-300 mb-2">
              <Camera className="h-4 w-4 text-sky-400" />
              Evidencias (Telegram / obra)
            </h3>
            {fotos.length === 0 && videos.length === 0 ? (
              <p className="text-xs text-zinc-500 rounded-xl border border-dashed border-zinc-700 p-4 text-center">
                Sin fotos en la partida. Las enviadas con <code className="text-sky-400">/obra</code>{' '}
                aparecerán aquí cuando estén en evidencias_fotos.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {fotos.map((url) => (
                  <a
                    key={url}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block aspect-video rounded-lg overflow-hidden border border-zinc-700 bg-zinc-900 hover:border-sky-500/50"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt="Evidencia de obra"
                      className="h-full w-full object-cover"
                    />
                  </a>
                ))}
              </div>
            )}
          </section>
        </div>
      </aside>
    </>
  );
}
