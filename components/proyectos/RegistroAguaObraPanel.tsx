'use client';

import { useCallback, useEffect, useState } from 'react';
import { Droplets, ExternalLink, RefreshCw } from 'lucide-react';
import type { RegistroAguaRow } from '@/app/api/proyectos/[proyectoId]/registro-agua/route';
import { formatApiErrorBody, formatErrorMessage } from '@/lib/utils/formatErrorMessage';
import { parseFetchJson } from '@/lib/utils/parseFetchJson';

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

function fmtLitros(r: RegistroAguaRow): string {
  if (r.litros_entregados == null) return '—';
  return `${Number(r.litros_entregados).toLocaleString('es-VE')} L`;
}

function fmtPpm(r: RegistroAguaRow): string {
  const ppm = r.ppm_minerales ?? (r.unidad_medicion?.toLowerCase().includes('ppm') ? r.medicion_agua : null);
  if (ppm == null) return '—';
  return `${ppm} ppm`;
}

export default function RegistroAguaObraPanel({ proyectoId }: Props) {
  const [registros, setRegistros] = useState<RegistroAguaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/proyectos/${encodeURIComponent(proyectoId)}/registro-agua`,
      );
      const data = await parseFetchJson<{ error?: string; registros?: RegistroAguaRow[] }>(
        res,
      );
      if (!res.ok) throw new Error(formatApiErrorBody(data, 'Error al cargar registros'));
      setRegistros(data.registros ?? []);
    } catch (e) {
      setError(formatErrorMessage(e));
      setRegistros([]);
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
          <Droplets className="h-5 w-5 text-sky-400" />
          <h2 className="text-lg font-semibold text-zinc-100">Registro de agua</h2>
          <span className="text-xs text-zinc-500">({registros.length})</span>
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
        Entradas capturadas desde Telegram con comando <code className="text-sky-300">/agua</code>
        (camión con placa, prueba PPM con medidor azul y litros ingresados por el obrero).
      </p>

      {error ? (
        <p className="text-sm text-red-400" role="alert">
          {error}
        </p>
      ) : null}

      {loading && registros.length === 0 ? (
        <p className="text-sm text-zinc-500 py-8" role="status">
          Cargando registros…
        </p>
      ) : null}

      {!loading && !error && registros.length === 0 ? (
        <p className="rounded-xl border border-dashed border-white/10 bg-zinc-900/40 px-4 py-10 text-center text-sm text-zinc-500">
          Aún no hay registros de agua para esta obra.
        </p>
      ) : null}

      {registros.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-zinc-900/80 text-[11px] uppercase tracking-wide text-zinc-500">
                <th className="px-3 py-2 font-semibold">Fecha</th>
                <th className="px-3 py-2 font-semibold">Placa</th>
                <th className="px-3 py-2 font-semibold">Litros</th>
                <th className="px-3 py-2 font-semibold">PPM</th>
                <th className="px-3 py-2 font-semibold">Registró</th>
                <th className="px-3 py-2 font-semibold">Fotos</th>
              </tr>
            </thead>
            <tbody>
              {registros.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-white/5 hover:bg-white/[0.02]"
                >
                  <td className="px-3 py-2 text-zinc-300 whitespace-nowrap">
                    {fmtFecha(r.registrado_en || r.created_at)}
                  </td>
                  <td className="px-3 py-2 font-medium text-amber-200">
                    {r.placa_vehiculo?.trim() || '—'}
                  </td>
                  <td className="px-3 py-2 text-emerald-200 font-medium">{fmtLitros(r)}</td>
                  <td className="px-3 py-2 text-sky-200">{fmtPpm(r)}</td>
                  <td className="px-3 py-2 text-zinc-400">{r.creado_por}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-2">
                      <a
                        href={r.foto_tanque_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300"
                      >
                        Tanque
                        <ExternalLink className="h-3 w-3" />
                      </a>
                      <a
                        href={r.foto_prueba_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300"
                      >
                        Prueba
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
