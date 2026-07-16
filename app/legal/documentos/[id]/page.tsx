'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Loader2, Printer, Save } from 'lucide-react';
import { toast } from 'sonner';
import { apiUrl } from '@/lib/http/apiUrl';
import {
  LEGAL_ESTADOS_DOCUMENTO,
  LEGAL_TIPOS_DOCUMENTO,
} from '@/lib/legal/documentosCatalogo';
import {
  LEGAL_DOCUMENT_ESTRUCTURADO_EJEMPLO,
  estructuradoToMarkdown,
  parseDocumentoEstructurado,
  type LegalDocumentStructured,
} from '@/lib/legal/documentoEstructurado';
import DocumentBlocksView from '@/components/legal/DocumentBlocksView';

const campo =
  'mt-1.5 w-full rounded-lg border border-white/10 bg-zinc-900/80 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-amber-500/40';

type Doc = {
  id: string;
  titulo: string;
  tipo: string;
  estado: string;
  contraparte: string | null;
  cuerpo_markdown: string;
  cuerpo_estructurado?: unknown;
};

type Modo = 'vista' | 'markdown' | 'json';

export default function DocumentoDetallePage() {
  const params = useParams();
  const id = String(params?.id ?? '');
  const [doc, setDoc] = useState<Doc | null>(null);
  const [titulo, setTitulo] = useState('');
  const [tipo, setTipo] = useState('contrato');
  const [estado, setEstado] = useState('borrador');
  const [contraparte, setContraparte] = useState('');
  const [cuerpo, setCuerpo] = useState('');
  const [jsonEstructurado, setJsonEstructurado] = useState('');
  const [estructurado, setEstructurado] = useState<LegalDocumentStructured | null>(
    null,
  );
  const [modo, setModo] = useState<Modo>('vista');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const cargar = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await fetch(apiUrl(`/api/legal/documentos/${id}`), {
        credentials: 'include',
        cache: 'no-store',
      });
      const data = (await res.json()) as {
        documento?: Doc;
        error?: string;
        hint?: string;
      };
      if (!res.ok) {
        toast.error([data.error, data.hint].filter(Boolean).join(' — ') || 'Error');
        return;
      }
      const d = data.documento!;
      setDoc(d);
      setTitulo(d.titulo);
      setTipo(d.tipo);
      setEstado(d.estado);
      setContraparte(d.contraparte ?? '');
      setCuerpo(d.cuerpo_markdown ?? '');
      const parsed =
        parseDocumentoEstructurado(d.cuerpo_estructurado) ??
        (d.cuerpo_markdown
          ? null
          : LEGAL_DOCUMENT_ESTRUCTURADO_EJEMPLO);
      setEstructurado(parsed);
      setJsonEstructurado(
        JSON.stringify(parsed ?? LEGAL_DOCUMENT_ESTRUCTURADO_EJEMPLO, null, 2),
      );
      setModo(parsed ? 'vista' : 'markdown');
    } catch {
      toast.error('Error de red');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const docVista = useMemo(() => {
    if (estructurado) return estructurado;
    try {
      return parseDocumentoEstructurado(JSON.parse(jsonEstructurado));
    } catch {
      return null;
    }
  }, [estructurado, jsonEstructurado]);

  function syncFromVista(next: LegalDocumentStructured) {
    setEstructurado(next);
    setJsonEstructurado(JSON.stringify(next, null, 2));
    setTitulo(next.document_title);
    setCuerpo(estructuradoToMarkdown(next));
  }

  function syncFromJsonText(text: string) {
    setJsonEstructurado(text);
    try {
      const parsed = parseDocumentoEstructurado(JSON.parse(text));
      if (parsed) {
        setEstructurado(parsed);
        setTitulo(parsed.document_title);
        setCuerpo(estructuradoToMarkdown(parsed));
      }
    } catch {
      /* typing */
    }
  }

  async function guardar() {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        titulo,
        tipo,
        estado,
        contraparte: contraparte || null,
      };

      if (modo === 'vista' || modo === 'json') {
        let docStruct = estructurado;
        if (modo === 'json') {
          try {
            docStruct = parseDocumentoEstructurado(JSON.parse(jsonEstructurado));
          } catch {
            toast.error('JSON estructurado inválido');
            setSaving(false);
            return;
          }
        }
        if (!docStruct) {
          toast.error('Se requiere document_title y blocks[]');
          setSaving(false);
          return;
        }
        payload.cuerpo_estructurado = docStruct;
        payload.cuerpo_markdown = estructuradoToMarkdown(docStruct);
        payload.titulo = docStruct.document_title;
      } else {
        payload.cuerpo_markdown = cuerpo;
      }

      const res = await fetch(apiUrl(`/api/legal/documentos/${id}`), {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { error?: string; hint?: string };
      if (!res.ok) {
        toast.error([data.error, data.hint].filter(Boolean).join(' — ') || 'Error');
        return;
      }
      toast.success('Guardado');
      void cargar();
    } catch {
      toast.error('Error de red');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <p className="flex items-center gap-2 text-sm text-zinc-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
      </p>
    );
  }

  if (!doc) {
    return (
      <p className="text-sm text-zinc-500">
        Documento no encontrado.{' '}
        <Link href="/legal/documentos" className="text-amber-300 hover:underline">
          Volver
        </Link>
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/legal/documentos" className="text-sm text-zinc-500 hover:text-zinc-300">
          ← Documentos
        </Link>
        <div className="flex flex-wrap gap-2">
          <a
            href={apiUrl(`/api/legal/documentos/${id}?format=print`)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-3 py-2 text-sm text-zinc-200 hover:bg-white/5"
          >
            <Printer className="h-4 w-4" />
            Imprimir / PDF
          </a>
          <button
            type="button"
            onClick={() => void guardar()}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-700 px-4 py-2 text-sm font-bold text-black disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Guardar
          </button>
        </div>
      </div>

      <div className="grid gap-3 rounded-2xl border border-white/10 bg-[#0c1018] p-4 sm:grid-cols-2">
        <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500 sm:col-span-2">
          Título
          <input className={campo} value={titulo} onChange={(e) => setTitulo(e.target.value)} />
        </label>
        <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Tipo
          <select className={campo} value={tipo} onChange={(e) => setTipo(e.target.value)}>
            {LEGAL_TIPOS_DOCUMENTO.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Estado
          <select className={campo} value={estado} onChange={(e) => setEstado(e.target.value)}>
            {LEGAL_ESTADOS_DOCUMENTO.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500 sm:col-span-2">
          Contraparte
          <input
            className={campo}
            value={contraparte}
            onChange={(e) => setContraparte(e.target.value)}
          />
        </label>

        <div className="flex flex-wrap gap-2 sm:col-span-2">
          {(
            [
              ['vista', 'Vista bloques'],
              ['json', 'JSON'],
              ['markdown', 'Markdown'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setModo(key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                modo === key
                  ? 'bg-amber-500/20 text-amber-100'
                  : 'text-zinc-500 hover:bg-white/5'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {modo === 'vista' && (
          <div className="sm:col-span-2">
            {docVista ? (
              <DocumentBlocksView
                document={docVista}
                editable
                onChange={syncFromVista}
              />
            ) : (
              <p className="text-sm text-zinc-500">
                No hay bloques. Pega un JSON en la pestaña JSON o carga el ejemplo.
              </p>
            )}
          </div>
        )}

        {modo === 'markdown' && (
          <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500 sm:col-span-2">
            Cuerpo (markdown)
            <textarea
              className={`${campo} min-h-[420px] font-mono text-[13px] leading-relaxed`}
              value={cuerpo}
              onChange={(e) => setCuerpo(e.target.value)}
            />
          </label>
        )}

        {modo === 'json' && (
          <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500 sm:col-span-2">
            Cuerpo estructurado (document_title + blocks)
            <textarea
              className={`${campo} min-h-[420px] font-mono text-[12px] leading-relaxed`}
              value={jsonEstructurado}
              onChange={(e) => syncFromJsonText(e.target.value)}
              spellCheck={false}
            />
          </label>
        )}
      </div>

      <p className="text-xs text-zinc-600">
        Vista: <code className="text-zinc-400">title</code> → encabezado,{' '}
        <code className="text-zinc-400">paragraph</code> → párrafo,{' '}
        <code className="text-zinc-400">clause</code> → cláusula editable.
      </p>
    </div>
  );
}
