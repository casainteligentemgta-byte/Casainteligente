'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Eye, FileText, Loader2, Plus, Send } from 'lucide-react';
import { apiUrl } from '@/lib/http/apiUrl';
import {
  LEGAL_ESTADOS_DOCUMENTO,
  LEGAL_TIPOS_DOCUMENTO,
} from '@/lib/legal/documentosCatalogo';
import { etiquetaDe } from '@/lib/legal/casosCatalogo';
import PrevisualizarDocumentoLegalModal from '@/components/legal/PrevisualizarDocumentoLegalModal';
import EnviarDocumentoLegalModal from '@/components/legal/EnviarDocumentoLegalModal';

type Doc = {
  id: string;
  titulo: string;
  tipo: string;
  estado: string;
  contraparte: string | null;
  updated_at: string;
};

export default function DocumentosLegalClient() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [previewTitulo, setPreviewTitulo] = useState('');
  const [enviarId, setEnviarId] = useState<string | null>(null);
  const [enviarTitulo, setEnviarTitulo] = useState('');

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiUrl('/api/legal/documentos?plantillas=0'), {
        credentials: 'include',
        cache: 'no-store',
      });
      const data = (await res.json()) as {
        documentos?: Doc[];
        error?: string;
        hint?: string;
      };
      if (!res.ok) {
        setError([data.error, data.hint].filter(Boolean).join(' — ') || 'Error');
        setDocs([]);
        return;
      }
      setDocs(data.documentos ?? []);
    } catch {
      setError('Error de red');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm text-amber-200/80">
            <FileText className="h-4 w-4" />
            Contratos y documentos
          </p>
          <h2 className="mt-2 text-2xl font-bold text-white">Documentos legales</h2>
          <p className="mt-1 max-w-xl text-sm text-zinc-500">
            Redacta contratos, finiquitos, poderes y cartas desde plantillas
            venezolanas. Previsualiza, aprueba y envía.
          </p>
        </div>
        <Link
          href="/legal/documentos/nuevo"
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-700 px-4 py-2.5 text-sm font-bold text-black"
        >
          <Plus className="h-4 w-4" />
          Nuevo documento
        </Link>
      </header>

      {error && (
        <p className="rounded-xl border border-red-500/30 bg-red-950/40 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      )}

      {loading ? (
        <p className="flex items-center gap-2 text-sm text-zinc-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
        </p>
      ) : docs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 px-6 py-10 text-center">
          <p className="text-sm text-zinc-400">Aún no hay documentos.</p>
          <Link
            href="/legal/documentos/nuevo"
            className="mt-3 inline-flex text-sm font-semibold text-amber-300 hover:underline"
          >
            Crear el primero desde una plantilla
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-white/5 rounded-2xl border border-white/10">
          {docs.map((d) => (
            <li
              key={d.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 transition hover:bg-white/[0.03]"
            >
              <Link href={`/legal/documentos/${d.id}`} className="min-w-0 flex-1">
                <p className="font-medium text-zinc-100">{d.titulo}</p>
                <p className="text-xs text-zinc-500">
                  {etiquetaDe(LEGAL_TIPOS_DOCUMENTO, d.tipo)}
                  {d.contraparte ? ` · ${d.contraparte}` : ''}
                </p>
              </Link>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-lg border border-white/10 px-2 py-1 text-[11px] text-zinc-400">
                  {etiquetaDe(LEGAL_ESTADOS_DOCUMENTO, d.estado)}
                </span>
                <button
                  type="button"
                  title="Previsualizar"
                  onClick={() => {
                    setPreviewId(d.id);
                    setPreviewTitulo(d.titulo);
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-xs font-medium text-amber-100 hover:bg-amber-500/20"
                >
                  <Eye className="h-3.5 w-3.5" />
                  Ver
                </button>
                <button
                  type="button"
                  title="Enviar"
                  onClick={() => {
                    setEnviarId(d.id);
                    setEnviarTitulo(d.titulo);
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/35 bg-emerald-950/30 px-2.5 py-1.5 text-xs font-medium text-emerald-100 hover:bg-emerald-900/40"
                >
                  <Send className="h-3.5 w-3.5" />
                  Enviar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <PrevisualizarDocumentoLegalModal
        open={Boolean(previewId)}
        onOpenChange={(o) => {
          if (!o) setPreviewId(null);
        }}
        kind="documento"
        id={previewId}
        titulo={previewTitulo}
      />
      <EnviarDocumentoLegalModal
        open={Boolean(enviarId)}
        onOpenChange={(o) => {
          if (!o) setEnviarId(null);
        }}
        documentId={enviarId}
        titulo={enviarTitulo}
      />
    </div>
  );
}
