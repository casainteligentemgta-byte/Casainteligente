'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ClipboardCopy, Loader2, Mic, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { apiUrl } from '@/lib/http/apiUrl';
import type { MinutaPheme } from '@/lib/pheme/types';

type ApiOk = {
  titulo_reunion?: string;
  minuta: MinutaPheme;
  markdown: string;
  desdeGemini: boolean;
  modelo?: string;
  aviso?: string;
  reunion_id?: string | null;
  id_reunion?: number | null;
  transcripcion?: string;
};

type Modo = 'texto' | 'audio';

export default function PhemeMinutaClient() {
  const [modo, setModo] = useState<Modo>('texto');
  const [titulo, setTitulo] = useState('');
  const [texto, setTexto] = useState('');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [duracion, setDuracion] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ApiOk | null>(null);
  const [error, setError] = useState<string | null>(null);

  const analizar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let res: Response;
      if (modo === 'audio') {
        if (!audioFile) {
          toast.error('Selecciona un archivo de audio');
          setLoading(false);
          return;
        }
        const fd = new FormData();
        fd.set('titulo_reunion', titulo.trim() || 'Sin título');
        fd.set('audio', audioFile);
        if (duracion.trim()) fd.set('duracion_minutos', duracion.trim());
        res = await fetch(apiUrl('/api/pheme/minuta'), { method: 'POST', body: fd });
      } else {
        const t = texto.trim();
        if (!t) {
          toast.error('Pega la transcripción de la reunión');
          setLoading(false);
          return;
        }
        res = await fetch(apiUrl('/api/pheme/minuta'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            titulo_reunion: titulo.trim() || 'Sin título',
            transcripcion: t,
            duracion_minutos: duracion.trim() ? Number(duracion) : null,
          }),
        });
      }

      const j = (await res.json().catch(() => ({}))) as ApiOk & { error?: string };
      if (!res.ok) {
        const msg = j.error || 'No se pudo generar la minuta';
        setError(msg);
        toast.error(msg);
        return;
      }
      // Si la API no anida `minuta`, reconstruir desde campos planos del prototipo.
      if (!j.minuta && (j as unknown as MinutaPheme).resumen_ejecutivo) {
        const flat = j as unknown as MinutaPheme;
        j.minuta = {
          resumen_ejecutivo: flat.resumen_ejecutivo,
          puntos_clave: flat.puntos_clave ?? [],
          acuerdos: flat.acuerdos ?? [],
          pendientes_o_alertas: flat.pendientes_o_alertas ?? [],
        };
      }
      setResult(j);
      if (j.transcripcion) setTexto(j.transcripcion);
      if (j.aviso) toast.message(j.aviso);
      else toast.success(j.id_reunion != null ? `Reunión #${j.id_reunion} guardada` : 'Minuta lista');
    } catch {
      setError('Error de red');
      toast.error('Error de red');
    } finally {
      setLoading(false);
    }
  }, [audioFile, duracion, modo, texto, titulo]);

  const copiarMarkdown = useCallback(async () => {
    if (!result?.markdown) return;
    try {
      await navigator.clipboard.writeText(result.markdown);
      toast.success('Minuta copiada');
    } catch {
      toast.error('No se pudo copiar');
    }
  }, [result]);

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-400/90">
          Agente Pheme
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
          Minuta de reunión
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-zinc-400">
          Audio → transcripción con hablantes → minuta JSON → Postgres (
          <code className="text-zinc-500">reuniones_pheme</code>).
        </p>
        <p className="text-xs text-zinc-600">
          Relacionado:{' '}
          <Link href="/agenda" className="text-sky-400/80 underline hover:text-sky-300">
            Agenda
          </Link>
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ['texto', 'Transcripción'],
            ['audio', 'Audio'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setModo(id)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-bold uppercase tracking-wide ${
              modo === id
                ? 'border-sky-400/50 bg-sky-500/20 text-sky-100'
                : 'border-white/15 text-zinc-400 hover:bg-white/5'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <section className="space-y-3">
        <label htmlFor="pheme-titulo" className="block text-sm font-medium text-zinc-300">
          Título de la reunión
        </label>
        <input
          id="pheme-titulo"
          type="text"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="Ej. Instalación de Cámaras Almacén"
          className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-sky-500/40 focus:outline-none focus:ring-1 focus:ring-sky-500/30"
        />
        <label htmlFor="pheme-duracion" className="block text-sm font-medium text-zinc-300">
          Duración (minutos, opcional)
        </label>
        <input
          id="pheme-duracion"
          type="number"
          min={0}
          value={duracion}
          onChange={(e) => setDuracion(e.target.value)}
          placeholder="15"
          className="w-32 rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-sky-500/40 focus:outline-none focus:ring-1 focus:ring-sky-500/30"
        />

        {modo === 'audio' ? (
          <>
            <label htmlFor="pheme-audio" className="block text-sm font-medium text-zinc-300">
              Archivo de audio
            </label>
            <input
              id="pheme-audio"
              type="file"
              accept="audio/*,.mp3,.wav,.m4a,.ogg,.webm"
              onChange={(e) => setAudioFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-zinc-400 file:mr-3 file:rounded-lg file:border-0 file:bg-sky-500/20 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-sky-100"
            />
            {audioFile ? (
              <p className="text-xs text-zinc-500">
                {audioFile.name} · {(audioFile.size / 1024 / 1024).toFixed(2)} MB
              </p>
            ) : null}
          </>
        ) : (
          <>
            <label htmlFor="pheme-transcripcion" className="block text-sm font-medium text-zinc-300">
              Transcripción
            </label>
            <textarea
              id="pheme-transcripcion"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              rows={12}
              placeholder="Pegue aquí el texto de la reunión…"
              className="w-full resize-y rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-sky-500/40 focus:outline-none focus:ring-1 focus:ring-sky-500/30"
            />
          </>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={loading}
            onClick={() => void analizar()}
            className="inline-flex items-center gap-2 rounded-xl border border-sky-500/40 bg-sky-500/15 px-4 py-2.5 text-sm font-bold text-sky-100 hover:bg-sky-500/25 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : modo === 'audio' ? (
              <Mic className="h-4 w-4" aria-hidden />
            ) : (
              <Sparkles className="h-4 w-4" aria-hidden />
            )}
            {loading
              ? modo === 'audio'
                ? 'Transcribiendo y analizando…'
                : 'Procesando…'
              : 'Procesar con Pheme'}
          </button>
          {result?.markdown ? (
            <button
              type="button"
              onClick={() => void copiarMarkdown()}
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-sm font-semibold text-zinc-200 hover:bg-white/10"
            >
              <ClipboardCopy className="h-4 w-4" aria-hidden />
              Copiar markdown
            </button>
          ) : null}
        </div>
      </section>

      {error ? (
        <div className="flex gap-2 rounded-xl border border-rose-500/30 bg-rose-950/30 px-4 py-3 text-sm text-rose-100">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>{error}</p>
        </div>
      ) : null}

      {result?.transcripcion && modo === 'audio' ? (
        <section className="rounded-2xl border border-white/10 bg-black/30 p-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
            Transcripción (diarizada)
          </h2>
          <pre className="mt-2 max-h-64 overflow-y-auto whitespace-pre-wrap text-xs text-zinc-300">
            {result.transcripcion}
          </pre>
        </section>
      ) : null}

      {result?.minuta ? (
        <section className="space-y-5 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          {result.aviso ? (
            <p className="text-xs text-amber-300/90">{result.aviso}</p>
          ) : null}
          <p className="text-[11px] uppercase tracking-wide text-zinc-600">
            {result.titulo_reunion ? `${result.titulo_reunion} · ` : ''}
            {result.modelo ? `Modelo: ${result.modelo}` : null}
            {result.id_reunion != null ? ` · id_reunion ${result.id_reunion}` : ''}
          </p>

          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
              1. Resumen ejecutivo
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-100">
              {result.minuta.resumen_ejecutivo}
            </p>
          </div>

          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
              2. Puntos clave tratados
            </h2>
            {result.minuta.puntos_clave.length === 0 ? (
              <p className="mt-2 text-sm text-zinc-500">Sin puntos clave.</p>
            ) : (
              <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-zinc-200">
                {result.minuta.puntos_clave.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ol>
            )}
          </div>

          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
              3. Acuerdos y compromisos
            </h2>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full min-w-[480px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-zinc-500">
                    <th className="py-2 pr-3 font-semibold">Tarea / Compromiso</th>
                    <th className="py-2 pr-3 font-semibold">Responsable</th>
                    <th className="py-2 font-semibold">Fecha límite</th>
                  </tr>
                </thead>
                <tbody>
                  {result.minuta.acuerdos.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-3 text-zinc-500">
                        Sin acuerdos explícitos.
                      </td>
                    </tr>
                  ) : (
                    result.minuta.acuerdos.map((a) => (
                      <tr key={`${a.tarea}-${a.responsable}`} className="border-b border-white/5">
                        <td className="py-2.5 pr-3 text-zinc-100">{a.tarea}</td>
                        <td className="py-2.5 pr-3 text-zinc-300">{a.responsable}</td>
                        <td className="py-2.5 text-zinc-400">{a.fecha_limite ?? 'N/A'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
              4. Pendientes o alertas
            </h2>
            {result.minuta.pendientes_o_alertas.length === 0 ? (
              <p className="mt-2 text-sm text-zinc-500">Ninguna alerta crítica.</p>
            ) : (
              <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-amber-100/90">
                {result.minuta.pendientes_o_alertas.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}
