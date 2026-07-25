'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { uploadProjectAsset } from '@/lib/supabase/project-media';
import {
  etiquetaEstadoJob,
  jobPermiteExportDji,
  jobPermitePiloto,
  type FuenteCaptura,
  type CalidadReconstruccion,
  type ObraTour,
  type ObraTourJob,
} from '@/lib/proyectos/obraTours';
import TourPilotoViewer from '@/components/proyectos/tours/TourPilotoViewer';

type Props = { proyectoId: string };

export default function ObraToursClient({ proyectoId }: Props) {
  const [jobs, setJobs] = useState<ObraTourJob[]>([]);
  const [tours, setTours] = useState<ObraTour[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [fuente, setFuente] = useState<FuenteCaptura>('dron');
  const [calidad, setCalidad] = useState<CalidadReconstruccion>('rapida');
  const [file, setFile] = useState<File | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [panel, setPanel] = useState<'captura' | 'piloto' | 'dji'>('captura');

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`/api/proyectos/${encodeURIComponent(proyectoId)}/tours`, {
        cache: 'no-store',
      });
      const data = (await res.json()) as {
        jobs?: ObraTourJob[];
        tours?: ObraTour[];
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? 'No se pudieron cargar los tours');
        return;
      }
      setJobs(data.jobs ?? []);
      setTours(data.tours ?? []);
      setSelectedJobId((prev) => prev ?? data.jobs?.[0]?.id ?? null);
    } catch {
      setError('Error de red al cargar tours');
    } finally {
      setLoading(false);
    }
  }, [proyectoId]);

  useEffect(() => {
    void load();
    const t = window.setInterval(() => void load(), 12_000);
    return () => window.clearInterval(t);
  }, [load]);

  const selected = jobs.find((j) => j.id === selectedJobId) ?? jobs[0] ?? null;

  async function subirYEncolar() {
    if (!file) {
      setError('Selecciona un video (mp4/mov)');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      const up = await uploadProjectAsset(supabase, file, {
        proyectoId,
        category: 'tour',
        folderHint: 'tours/video',
      });
      if (up.error || !up.publicUrl) {
        setError(up.error ?? 'No se pudo subir el video');
        return;
      }

      const res = await fetch(`/api/proyectos/${encodeURIComponent(proyectoId)}/tours/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fuente_captura: fuente,
          calidad,
          video_storage_bucket: up.bucket,
          video_storage_path: up.path,
          video_public_url: up.publicUrl,
          video_bytes: file.size,
        }),
      });
      const data = (await res.json()) as { job?: ObraTourJob; error?: string };
      if (!res.ok) {
        setError(data.error ?? 'No se pudo crear el job');
        return;
      }
      if (data.job) setSelectedJobId(data.job.id);
      setFile(null);
      await load();
    } catch {
      setError('Error al subir / encolar');
    } finally {
      setBusy(false);
    }
  }

  async function simularModelo(jobId?: string) {
    const id = jobId ?? selected?.id;
    if (!id) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/proyectos/${encodeURIComponent(proyectoId)}/tours/jobs/${encodeURIComponent(id)}/simular-modelo`,
        { method: 'POST' },
      );
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? 'No se pudo simular');
        return;
      }
      setPanel('piloto');
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function exportDji() {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/proyectos/${encodeURIComponent(proyectoId)}/tours/export-dji`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            job_id: selected.id,
            export_layout: 'hsbs',
            nombre: `Tour DJI · ${fuente}`,
          }),
        },
      );
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? 'No se pudo exportar');
        return;
      }
      setPanel('dji');
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h2 className="text-lg font-bold text-white">Tours 3D de obra</h2>
        <p className="max-w-2xl text-sm text-zinc-400">
          Sube un video del celular o dron → reconstrucción 3D →{' '}
          <span className="text-zinc-200">modo piloto con joystick</span> o{' '}
          <span className="text-zinc-200">export MP4 para DJI Goggles</span>.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ['captura', '1. Captura'],
            ['piloto', '2. Modo piloto'],
            ['dji', '3. Paquete DJI'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setPanel(id)}
            className={
              panel === id
                ? 'rounded-full border border-amber-500/50 bg-amber-950/50 px-3 py-1.5 text-[11px] font-semibold text-amber-100'
                : 'rounded-full border border-white/10 bg-zinc-900/60 px-3 py-1.5 text-[11px] font-semibold text-zinc-400 hover:text-zinc-200'
            }
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? <p className="text-sm text-zinc-500">Cargando…</p> : null}
      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      {panel === 'captura' ? (
        <section className="space-y-4 rounded-2xl border border-white/10 bg-zinc-900/60 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs text-zinc-400">
              Fuente
              <select
                value={fuente}
                onChange={(e) => setFuente(e.target.value as FuenteCaptura)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
              >
                <option value="dron">Dron</option>
                <option value="celular">Celular</option>
              </select>
            </label>
            <label className="block text-xs text-zinc-400">
              Calidad reconstrucción
              <select
                value={calidad}
                onChange={(e) => setCalidad(e.target.value as CalidadReconstruccion)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
              >
                <option value="rapida">Rápida</option>
                <option value="detallada">Detallada</option>
              </select>
            </label>
          </div>
          <label className="block text-xs text-zinc-400">
            Video (mp4 / mov)
            <input
              type="file"
              accept="video/mp4,video/quicktime,.mp4,.mov"
              className="mt-1 block w-full text-sm text-zinc-300 file:mr-3 file:rounded-lg file:border-0 file:bg-amber-500/20 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-amber-100"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <p className="text-[11px] text-zinc-500">
            Tip: movimiento lento, buen solape y luz estable. El dron suele reconstruir mejor.
          </p>
          <button
            type="button"
            disabled={busy || !file}
            onClick={() => void subirYEncolar()}
            className="rounded-xl border border-amber-500/40 bg-amber-950/50 px-4 py-2 text-xs font-bold text-amber-100 disabled:opacity-40"
          >
            {busy ? 'Procesando…' : 'Subir video y encolar reconstrucción'}
          </button>
        </section>
      ) : null}

      {panel === 'piloto' ? (
        <TourPilotoViewer
          modeloUrl={selected?.modelo_public_url ?? null}
          titulo={
            selected
              ? `Modo piloto · ${etiquetaEstadoJob(selected.estado)}`
              : 'Modo piloto (práctica)'
          }
        />
      ) : null}

      {panel === 'dji' ? (
        <section className="space-y-3 rounded-2xl border border-white/10 bg-zinc-900/60 p-4">
          <h3 className="text-sm font-semibold text-zinc-100">Paquete para DJI Goggles</h3>
          <p className="text-xs text-zinc-400">
            Export recomendado: MP4 H.264, layout <strong className="text-zinc-200">HSBS</strong>{' '}
            (Half Side-by-Side). Copia a microSD → Álbum → modo 3D HSBS.
          </p>
          <button
            type="button"
            disabled={busy || !selected || !jobPermiteExportDji(selected)}
            onClick={() => void exportDji()}
            className="rounded-xl border border-sky-500/40 bg-sky-950/40 px-4 py-2 text-xs font-bold text-sky-100 disabled:opacity-40"
          >
            Generar / registrar export DJI
          </button>
          {tours.length === 0 ? (
            <p className="text-xs text-zinc-500">Aún no hay exports.</p>
          ) : (
            <ul className="divide-y divide-white/5 rounded-xl border border-white/10">
              {tours.map((t) => (
                <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs">
                  <div>
                    <p className="font-semibold text-zinc-200">{t.nombre}</p>
                    <p className="text-zinc-500">
                      {t.estado} · {t.export_layout ?? '—'} ·{' '}
                      {t.dji_ready ? 'listo para SD' : 'pendiente'}
                    </p>
                  </div>
                  {t.export_public_url ? (
                    <a
                      href={t.export_public_url}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-sky-300 hover:underline"
                    >
                      Descargar
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-zinc-200">Jobs de reconstrucción</h3>
        {jobs.length === 0 ? (
          <p className="text-xs text-zinc-500">Sin jobs todavía.</p>
        ) : (
          <ul className="space-y-2">
            {jobs.map((j) => {
              const active = selected?.id === j.id;
              return (
                <li
                  key={j.id}
                  className={
                    active
                      ? 'rounded-xl border border-amber-500/40 bg-amber-950/20 p-3'
                      : 'rounded-xl border border-white/10 bg-zinc-900/40 p-3'
                  }
                >
                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={() => setSelectedJobId(j.id)}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-zinc-100">
                        {etiquetaEstadoJob(j.estado)} · {j.fuente_captura} · {j.calidad}
                      </span>
                      <span className="text-[11px] text-zinc-500">
                        {Math.round(j.progreso_pct)}%
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-zinc-500">
                      {j.mensaje_estado ?? '—'}
                    </p>
                    {j.error_detalle ? (
                      <p className="mt-1 text-[11px] text-red-400">{j.error_detalle}</p>
                    ) : null}
                  </button>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(j.worker_payload as { stub?: boolean } | null)?.stub ||
                    j.estado === 'encolado' ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          setSelectedJobId(j.id);
                          void simularModelo(j.id);
                        }}
                        className="rounded-lg border border-white/15 px-2.5 py-1 text-[10px] font-semibold text-zinc-300 hover:bg-white/5"
                      >
                        Simular modelo
                      </button>
                    ) : null}
                    {jobPermitePiloto(j) ? (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedJobId(j.id);
                          setPanel('piloto');
                        }}
                        className="rounded-lg border border-emerald-500/35 px-2.5 py-1 text-[10px] font-semibold text-emerald-200"
                      >
                        Abrir piloto
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
