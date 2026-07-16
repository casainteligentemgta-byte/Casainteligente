'use client';

import { useCallback, useEffect, useState } from 'react';
import { FileText, RefreshCw } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { BitacoraObraDatos } from '@/lib/telegram/bitacoraVoice';
import { formatErrorMessage } from '@/lib/utils/formatErrorMessage';

type BitacoraRow = {
  id: string;
  proyecto_id: string;
  transcripcion: string;
  datos_json: BitacoraObraDatos | Record<string, unknown>;
  duracion_segundos: number | null;
  created_at: string;
};

type Props = {
  proyectoId: string;
};

function fmtFecha(iso: string): string {
  try {
    return new Date(iso).toLocaleString('es-VE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function datosBitacora(raw: BitacoraRow['datos_json']): BitacoraObraDatos {
  const d = raw as BitacoraObraDatos;
  return {
    avances: Array.isArray(d?.avances) ? d.avances.filter(Boolean) : [],
    novedades_o_retrasos: Array.isArray(d?.novedades_o_retrasos)
      ? d.novedades_o_retrasos.filter(Boolean)
      : [],
    estimado_obreros_activos:
      typeof d?.estimado_obreros_activos === 'number' ? d.estimado_obreros_activos : 0,
  };
}

export default function InformesIngenieroObraPanel({ proyectoId }: Props) {
  const [informes, setInformes] = useState<BitacoraRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data, error: qErr } = await supabase
        .from('ci_bitacora_obras')
        .select('id, proyecto_id, transcripcion, datos_json, duracion_segundos, created_at')
        .eq('proyecto_id', proyectoId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (qErr) throw new Error(qErr.message);
      setInformes((data ?? []) as BitacoraRow[]);
    } catch (e) {
      setError(formatErrorMessage(e));
      setInformes([]);
    } finally {
      setLoading(false);
    }
  }, [proyectoId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-violet-400" />
          <h2 className="text-lg font-semibold text-zinc-100">Informes del ingeniero</h2>
          <span className="text-xs text-zinc-500">({informes.length})</span>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-white/5 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      <p className="text-sm text-zinc-500">
        Bitácoras de campo transcritas y estructuradas con IA desde Telegram (
        <code className="text-violet-300">/bitacora</code> tras vincular la obra).
      </p>

      {error ? (
        <p className="text-sm text-red-400" role="alert">
          {error}
        </p>
      ) : null}

      {loading && informes.length === 0 ? (
        <p className="text-sm text-zinc-500 py-8" role="status">
          Cargando informes…
        </p>
      ) : null}

      {!loading && !error && informes.length === 0 ? (
        <p className="rounded-xl border border-dashed border-white/10 bg-zinc-900/40 px-4 py-10 text-center text-sm text-zinc-500">
          Sin bitácoras registradas para esta obra.
        </p>
      ) : null}

      <ul className="space-y-4">
        {informes.map((inf) => {
          const datos = datosBitacora(inf.datos_json);
          return (
            <li
              key={inf.id}
              className="rounded-xl border border-white/10 bg-zinc-900/50 p-4 space-y-3"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <time className="text-xs font-semibold text-zinc-500">
                  {fmtFecha(inf.created_at)}
                  {inf.duracion_segundos != null ? (
                    <span className="ml-2 text-zinc-600">
                      · {inf.duracion_segundos}s audio
                    </span>
                  ) : null}
                </time>
                {datos.estimado_obreros_activos > 0 ? (
                  <span className="text-[11px] rounded-full border border-emerald-500/30 bg-emerald-950/40 px-2 py-0.5 text-emerald-200">
                    ~{datos.estimado_obreros_activos} obreros en frente
                  </span>
                ) : null}
              </div>
              <p className="text-sm text-zinc-200 leading-relaxed">{inf.transcripcion}</p>
              {datos.avances.length > 0 ? (
                <div>
                  <p className="text-[11px] uppercase font-semibold text-emerald-500/90 mb-1">
                    Avances
                  </p>
                  <ul className="list-disc list-inside text-sm text-zinc-400 space-y-0.5">
                    {datos.avances.map((a, i) => (
                      <li key={`a-${inf.id}-${i}`}>{a}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {datos.novedades_o_retrasos.length > 0 ? (
                <div>
                  <p className="text-[11px] uppercase font-semibold text-amber-500/90 mb-1">
                    Novedades o retrasos
                  </p>
                  <ul className="list-disc list-inside text-sm text-zinc-400 space-y-0.5">
                    {datos.novedades_o_retrasos.map((n, i) => (
                      <li key={`n-${inf.id}-${i}`}>{n}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
