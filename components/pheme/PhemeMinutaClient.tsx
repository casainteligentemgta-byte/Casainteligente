'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ClipboardCopy, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { apiUrl } from '@/lib/http/apiUrl';
import type { MinutaPheme } from '@/lib/pheme/types';

type ApiOk = {
  minuta: MinutaPheme;
  markdown: string;
  desdeGemini: boolean;
  modelo?: string;
  aviso?: string;
};

export default function PhemeMinutaClient() {
  const [texto, setTexto] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ApiOk | null>(null);
  const [error, setError] = useState<string | null>(null);

  const analizar = useCallback(async () => {
    const t = texto.trim();
    if (!t) {
      toast.error('Pega la transcripción de la reunión');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiUrl('/api/pheme/minuta'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcripcion: t }),
      });
      const j = (await res.json().catch(() => ({}))) as ApiOk & { error?: string };
      if (!res.ok) {
        const msg = j.error || 'No se pudo generar la minuta';
        setError(msg);
        toast.error(msg);
        return;
      }
      setResult(j);
      if (j.aviso) toast.message(j.aviso);
      else toast.success('Minuta Pheme lista');
    } catch {
      setError('Error de red');
      toast.error('Error de red');
    } finally {
      setLoading(false);
    }
  }, [texto]);

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
          Pega la transcripción. Pheme sintetiza resumen ejecutivo, puntos clave, acuerdos con
          responsables y alertas pendientes — tono objetivo, sin muletillas.
        </p>
        <p className="text-xs text-zinc-600">
          Relacionado:{' '}
          <Link href="/agenda" className="text-sky-400/80 underline hover:text-sky-300">
            Agenda
          </Link>
        </p>
      </header>

      <section className="space-y-3">
        <label htmlFor="pheme-transcripcion" className="block text-sm font-medium text-zinc-300">
          Transcripción
        </label>
        <textarea
          id="pheme-transcripcion"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={12}
          placeholder="Pegue aquí el texto de la reunión o sesión de trabajo…"
          className="w-full resize-y rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-sky-500/40 focus:outline-none focus:ring-1 focus:ring-sky-500/30"
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={loading}
            onClick={() => void analizar()}
            className="inline-flex items-center gap-2 rounded-xl border border-sky-500/40 bg-sky-500/15 px-4 py-2.5 text-sm font-bold text-sky-100 hover:bg-sky-500/25 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="h-4 w-4" aria-hidden />
            )}
            {loading ? 'Analizando…' : 'Generar minuta'}
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

      {result ? (
        <section className="space-y-5 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          {result.aviso ? (
            <p className="text-xs text-amber-300/90">{result.aviso}</p>
          ) : null}
          {result.modelo ? (
            <p className="text-[11px] uppercase tracking-wide text-zinc-600">
              Modelo: {result.modelo}
              {result.desdeGemini ? '' : ' · sin Gemini'}
            </p>
          ) : null}

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
                        <td className="py-2.5 text-zinc-400">{a.fecha_limite ?? '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
              4. Alertas o temas pendientes
            </h2>
            {result.minuta.alertas_pendientes.length === 0 ? (
              <p className="mt-2 text-sm text-zinc-500">Ninguna alerta crítica.</p>
            ) : (
              <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-amber-100/90">
                {result.minuta.alertas_pendientes.map((a) => (
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
