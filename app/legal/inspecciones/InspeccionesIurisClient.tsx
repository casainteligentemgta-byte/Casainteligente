'use client';

import { useState } from 'react';
import { Camera, Loader2 } from 'lucide-react';
import { apiUrl } from '@/lib/http/apiUrl';
import type { IurisVigiaReport } from '@/lib/legal/iurisVigia';

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
    reader.readAsDataURL(file);
  });
}

export default function InspeccionesIurisClient() {
  const [context, setContext] = useState(
    'Inspección de seguridad en Local Jorge Coll',
  );
  const [imageUrl, setImageUrl] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<IurisVigiaReport | null>(null);

  async function onFile(file: File | null) {
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    setPreview(dataUrl);
    setImageUrl('');
  }

  async function analizar(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setReport(null);
    try {
      const payload: Record<string, string> = { context: context.trim() };
      if (preview?.startsWith('data:')) {
        const [meta, b64] = preview.split(',');
        const mime = meta.match(/data:([^;]+)/)?.[1] || 'image/jpeg';
        payload.image_base64 = b64;
        payload.mime_type = mime;
      } else if (imageUrl.trim()) {
        payload.image_url = imageUrl.trim();
      } else {
        setError('Sube una foto o indica una URL');
        setLoading(false);
        return;
      }

      const res = await fetch(apiUrl('/api/legal/inspecciones/analizar'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as {
        report?: IurisVigiaReport;
        error?: string;
        hint?: string;
      };
      if (!res.ok) {
        setError([data.error, data.hint].filter(Boolean).join(' — ') || 'Error');
        return;
      }
      setReport(data.report ?? null);
    } catch {
      setError('Error de red');
    } finally {
      setLoading(false);
    }
  }

  const estadoColor =
    report?.estado_cumplimiento === 'Conforme'
      ? 'text-emerald-300 border-emerald-500/30 bg-emerald-950/30'
      : report?.estado_cumplimiento === 'No Conforme'
        ? 'text-red-200 border-red-500/30 bg-red-950/30'
        : 'text-amber-200 border-amber-500/30 bg-amber-950/30';

  return (
    <div className="space-y-6">
      <header>
        <p className="flex items-center gap-2 text-sm text-amber-200/80">
          <Camera className="h-4 w-4" />
          IurisVigía · LOPCYMAT
        </p>
        <h2 className="mt-2 text-2xl font-bold text-white">
          Inspección fotográfica
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-zinc-500">
          Analiza fotos de campo y genera descripción técnica, nota legal,
          estado de cumplimiento y riesgo identificado.
        </p>
      </header>

      <form
        onSubmit={analizar}
        className="space-y-3 rounded-2xl border border-amber-500/20 bg-[#0c1018] p-4"
      >
        <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Contexto de la inspección
          <input
            value={context}
            onChange={(e) => setContext(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100"
          />
        </label>
        <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Foto (archivo)
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
            className="mt-1.5 block w-full text-sm text-zinc-400 file:mr-3 file:rounded-lg file:border-0 file:bg-amber-500/20 file:px-3 file:py-1.5 file:text-amber-100"
          />
        </label>
        <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">
          O URL de imagen (Supabase Storage)
          <input
            value={imageUrl}
            onChange={(e) => {
              setImageUrl(e.target.value);
              if (e.target.value) setPreview(null);
            }}
            placeholder="https://…/storage/v1/object/…"
            className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100"
          />
        </label>
        {(preview || imageUrl) && (
          <img
            src={preview || imageUrl}
            alt="Vista previa inspección"
            className="max-h-56 rounded-xl border border-white/10 object-contain"
          />
        )}
        <button
          type="submit"
          disabled={loading || !context.trim()}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-700 px-4 py-2.5 text-sm font-bold text-black disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
          Analizar con IurisVigía
        </button>
      </form>

      {error && (
        <p className="rounded-xl border border-red-500/30 bg-red-950/40 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      )}

      {report && (
        <article className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <p className={`inline-flex rounded-lg border px-3 py-1 text-sm font-semibold ${estadoColor}`}>
            {report.estado_cumplimiento}
          </p>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Descripción
            </h3>
            <p className="mt-1 text-sm text-zinc-200 whitespace-pre-wrap">{report.descripcion}</p>
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Nota legal
            </h3>
            <p className="mt-1 text-sm text-amber-100/90 whitespace-pre-wrap">{report.nota_legal}</p>
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Riesgo identificado
            </h3>
            <p className="mt-1 text-sm text-zinc-300 whitespace-pre-wrap">
              {report.riesgo_identificado}
            </p>
          </div>
        </article>
      )}
    </div>
  );
}
