'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { BookOpen, CheckCircle2, Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { apiUrl } from '@/lib/http/apiUrl';

type Fuente = {
  source: string;
  referencia: string | null;
  tipo: string | null;
  fecha_vigencia: string | null;
  fragmentos: number;
  ultimo_at: string | null;
};

type ClaseDoc = 'convencion_colectiva' | 'contratacion_colectiva_obrera';

type Props = {
  onRegimenCctSugerido?: () => void;
};

export default function CargarColectivoLegalPanel({ onRegimenCctSugerido }: Props) {
  const [clase, setClase] = useState<ClaseDoc>('convencion_colectiva');
  const [titulo, setTitulo] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [fuentes, setFuentes] = useState<Fuente[]>([]);
  const [loadingFuentes, setLoadingFuentes] = useState(true);

  const cargarFuentes = useCallback(async () => {
    setLoadingFuentes(true);
    try {
      const res = await fetch(apiUrl('/api/legal/knowledge/ingest'), {
        credentials: 'include',
        cache: 'no-store',
      });
      const data = (await res.json()) as { fuentes?: Fuente[]; error?: string };
      if (!res.ok) {
        setFuentes([]);
        return;
      }
      setFuentes(data.fuentes ?? []);
    } catch {
      setFuentes([]);
    } finally {
      setLoadingFuentes(false);
    }
  }, []);

  useEffect(() => {
    void cargarFuentes();
  }, [cargarFuentes]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      toast.error('Seleccione el archivo (PDF, DOCX, MD o TXT)');
      return;
    }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.set('file', file);
      fd.set('clase', clase);
      if (titulo.trim()) {
        fd.set('titulo', titulo.trim());
        fd.set('referencia', titulo.trim());
      }
      fd.set('reemplazar', '1');

      const res = await fetch(apiUrl('/api/legal/knowledge/ingest'), {
        method: 'POST',
        credentials: 'include',
        body: fd,
      });
      const data = (await res.json()) as {
        error?: string;
        hint?: string;
        chunks?: number;
        plantilla?: { id?: string } | null;
        regimen_sugerido?: { nota?: string } | null;
        hint_asesor?: string;
      };
      if (!res.ok) {
        toast.error([data.error, data.hint].filter(Boolean).join(' — ') || 'Error al cargar');
        return;
      }
      toast.success(
        `Documento indexado (${data.chunks ?? 0} fragmentos). El Asesor ya puede citarlo.`,
      );
      if (data.plantilla?.id) {
        toast.message('También se creó un formato en Documentos / Formatos.');
      }
      if (data.regimen_sugerido && clase === 'convencion_colectiva') {
        onRegimenCctSugerido?.();
        if (data.regimen_sugerido.nota) toast.message(data.regimen_sugerido.nota);
      }
      setFile(null);
      setTitulo('');
      void cargarFuentes();
    } catch {
      toast.error('Error de red');
    } finally {
      setSaving(false);
    }
  }

  const labelFuente = (s: string) => {
    if (s === 'convencion_colectiva') return 'Convención colectiva';
    if (s === 'contratacion_colectiva_obrera') return 'Contratación colectiva obrera';
    return s;
  };

  return (
    <section className="space-y-4">
      <div>
        <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-zinc-400">
          <BookOpen className="h-4 w-4" />
          Convención y contratación colectiva
        </h3>
        <p className="mt-1 max-w-2xl text-sm text-zinc-500">
          Suba la <strong className="font-medium text-zinc-400">convención colectiva del trabajo</strong>{' '}
          o el modelo de <strong className="font-medium text-zinc-400">contratación colectiva obrera</strong>.
          Se indexan en el Asesor legal; los días de utilidades/bono se confirman abajo (LOTTT o CCT).
        </p>
      </div>

      <form
        onSubmit={(e) => void onSubmit(e)}
        className="space-y-3 rounded-2xl border border-amber-500/20 bg-[#0c1018] p-4"
      >
        <div className="flex flex-wrap gap-2">
          {(
            [
              ['convencion_colectiva', 'Convención colectiva'],
              ['contratacion_colectiva_obrera', 'Contratación colectiva obrera'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setClase(id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                clase === id
                  ? 'bg-amber-500/20 text-amber-100'
                  : 'text-zinc-500 hover:bg-white/5'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Título / referencia
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder={
              clase === 'convencion_colectiva'
                ? 'Ej. CCT Construcción GOE 6.752 (2023)'
                : 'Ej. Contrato colectivo obrero — obra'
            }
            className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100"
          />
        </label>

        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-amber-500/30 bg-amber-500/5 px-4 py-6 text-center">
          <Upload className="h-7 w-7 text-amber-300/80" />
          <span className="text-sm font-semibold text-amber-100">
            {file ? file.name : 'Seleccionar archivo'}
          </span>
          <span className="text-xs text-zinc-500">PDF, DOCX, MD o TXT · máx. 15 MB</span>
          <input
            type="file"
            accept=".md,.txt,.html,.htm,.pdf,.doc,.docx,text/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>

        <button
          type="submit"
          disabled={saving || !file}
          className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-zinc-950 transition hover:bg-amber-400 disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {saving ? 'Indexando…' : 'Cargar e indexar'}
        </button>
      </form>

      <div className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
          Ya cargados en el asesor
        </p>
        {loadingFuentes ? (
          <p className="mt-2 flex items-center gap-2 text-xs text-zinc-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Cargando…
          </p>
        ) : fuentes.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">
            Aún no hay convención ni contratación colectiva indexadas.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {fuentes.map((f) => (
              <li
                key={`${f.source}-${f.referencia}`}
                className="flex flex-wrap items-start justify-between gap-2 text-sm"
              >
                <div>
                  <p className="font-medium text-zinc-200">
                    {f.referencia || labelFuente(f.source)}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {labelFuente(f.source)} · {f.fragmentos} fragmento(s)
                    {f.fecha_vigencia ? ` · vigencia ${f.fecha_vigencia}` : ''}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 text-[11px] text-emerald-300/90">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  En asesor
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-[11px] text-zinc-600">
          Consulte cláusulas en{' '}
          <Link href="/legal/asesor" className="text-amber-300 hover:underline">
            Asesor legal
          </Link>
          . La contratación colectiva también queda como formato usable en Documentos.
        </p>
      </div>
    </section>
  );
}
