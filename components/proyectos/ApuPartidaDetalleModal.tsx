'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, X, Layers } from 'lucide-react';
import ApuAnalisisPanel from '@/components/proyectos/ApuAnalisisPanel';
import type { LineaApuInsumoLulo, MargenesProyectoApu, PartidaApuLulo } from '@/types/apu-lulo';
import { formatApiErrorBody, formatErrorMessage } from '@/lib/utils/formatErrorMessage';
import { parseFetchJson } from '@/lib/utils/parseFetchJson';

type Props = {
  partidaId: string | null;
  onClose: () => void;
};

export default function ApuPartidaDetalleModal({ partidaId, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [partida, setPartida] = useState<PartidaApuLulo | null>(null);
  const [lineas, setLineas] = useState<LineaApuInsumoLulo[]>([]);
  const [margenes, setMargenes] = useState<MargenesProyectoApu | undefined>();

  const load = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    setHint(null);
    try {
      const res = await fetch(`/api/proyectos/lulo/partidas/${encodeURIComponent(id)}/apu`);
      const data = await parseFetchJson<{
        error?: string;
        hint?: string;
        partida?: PartidaApuLulo;
        lineas?: LineaApuInsumoLulo[];
        margenes?: MargenesProyectoApu;
      }>(res);
      if (!res.ok) throw new Error(formatApiErrorBody(data, 'No se pudo cargar el APU'));
      setPartida(data.partida ?? null);
      setLineas(data.lineas ?? []);
      setMargenes(data.margenes);
      setHint(typeof data.hint === 'string' ? data.hint : null);
    } catch (e) {
      setError(formatErrorMessage(e));
      setPartida(null);
      setLineas([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!partidaId) return;
    void load(partidaId);
  }, [partidaId, load]);

  useEffect(() => {
    if (!partidaId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [partidaId, onClose]);

  if (!partidaId) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="apu-modal-title"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-t-2xl sm:rounded-2xl border border-zinc-800 bg-[#0A0A0F] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Layers className="h-5 w-5 text-violet-400 shrink-0" aria-hidden />
            <h2 id="apu-modal-title" className="text-sm font-bold text-white truncate">
              Composición APU
              {partida ? (
                <span className="font-normal text-zinc-500">
                  {' '}
                  · {partida.codigo_partida}
                </span>
              ) : null}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zinc-700 p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-4 py-4 sm:px-6">
          {loading ? (
            <div className="flex flex-col items-center gap-2 py-16 text-zinc-500" role="status">
              <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
              <span className="text-sm">Cargando composición APU…</span>
            </div>
          ) : error ? (
            <p className="rounded-lg border border-red-500/30 bg-red-950/30 px-4 py-3 text-sm text-red-300">
              {error}
            </p>
          ) : partida ? (
            <>
              {hint ? (
                <p className="mb-4 rounded-lg border border-amber-500/25 bg-amber-950/25 px-3 py-2 text-xs text-amber-200/90">
                  {hint}
                </p>
              ) : null}
              {lineas.length === 0 && !hint ? (
                <p className="mb-4 text-sm text-zinc-500">
                  Esta partida no tiene líneas APU en Supabase. Importa el MDB con tablas nativas
                  (INSUMOS + COMPOSICION) o revisa el volcado en la pestaña Volcado Lulo.
                </p>
              ) : null}
              <ApuAnalisisPanel partida={partida} lineas={lineas} margenes={margenes} />
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
