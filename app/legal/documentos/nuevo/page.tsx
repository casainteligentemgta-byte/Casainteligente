'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { apiUrl } from '@/lib/http/apiUrl';
import {
  LEGAL_TIPOS_DOCUMENTO,
  aplicarVariablesPlantilla,
  type LegalPlantillaVariable,
} from '@/lib/legal/documentosCatalogo';
import {
  LEGAL_DOCUMENT_ESTRUCTURADO_EJEMPLO,
  parseDocumentoEstructurado,
} from '@/lib/legal/documentoEstructurado';

type Plantilla = {
  id: string;
  codigo: string;
  titulo: string;
  tipo: string;
  descripcion: string | null;
  variables: LegalPlantillaVariable[] | null;
  cuerpo_markdown: string | null;
};

const campo =
  'mt-1.5 w-full rounded-lg border border-white/10 bg-zinc-900/80 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-amber-500/40';

export default function DocumentoNuevoPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
        </div>
      }
    >
      <DocumentoNuevoForm />
    </Suspense>
  );
}

function DocumentoNuevoForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const plantillaQuery = searchParams.get('plantilla')?.trim() || '';
  const casoQuery = searchParams.get('caso')?.trim() || '';
  const [plantillas, setPlantillas] = useState<Plantilla[]>([]);
  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [plantillaId, setPlantillaId] = useState('');
  const [titulo, setTitulo] = useState('');
  const [tipo, setTipo] = useState('contrato');
  const [contraparte, setContraparte] = useState('');
  const [valores, setValores] = useState<Record<string, string>>({});
  const [jsonEstructurado, setJsonEstructurado] = useState('');

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const res = await fetch(apiUrl('/api/legal/documentos'), {
          credentials: 'include',
          cache: 'no-store',
        });
        const data = (await res.json()) as {
          plantillas?: Plantilla[];
          error?: string;
          hint?: string;
        };
        if (!res.ok) {
          toast.error([data.error, data.hint].filter(Boolean).join(' — ') || 'Error');
          return;
        }
        const list = data.plantillas ?? [];
        setPlantillas(list);
        if (plantillaQuery && list.some((p) => p.id === plantillaQuery)) {
          setPlantillaId(plantillaQuery);
        }
      } catch {
        toast.error('Error de red');
      } finally {
        setLoading(false);
      }
    })();
  }, [plantillaQuery]);

  const plantilla = useMemo(
    () => plantillas.find((p) => p.id === plantillaId) ?? null,
    [plantillas, plantillaId],
  );

  const variables = (plantilla?.variables ?? []) as LegalPlantillaVariable[];

  useEffect(() => {
    if (!plantilla) return;
    setTitulo((t) => t || plantilla.titulo);
    setTipo(plantilla.tipo || 'contrato');
  }, [plantilla]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!titulo.trim() && !jsonEstructurado.trim()) {
      toast.error('Indica el título o pega un JSON estructurado');
      return;
    }
    setEnviando(true);
    try {
      let cuerpo_estructurado: unknown = null;
      if (jsonEstructurado.trim()) {
        try {
          const raw = JSON.parse(jsonEstructurado) as unknown;
          cuerpo_estructurado = parseDocumentoEstructurado(raw);
          if (!cuerpo_estructurado) {
            toast.error('JSON inválido: document_title + blocks');
            setEnviando(false);
            return;
          }
        } catch {
          toast.error('JSON estructurado inválido');
          setEnviando(false);
          return;
        }
      }

      const cuerpo = plantilla?.cuerpo_markdown
        ? aplicarVariablesPlantilla(plantilla.cuerpo_markdown, valores)
        : '';
      const res = await fetch(apiUrl('/api/legal/documentos'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo: titulo.trim() || 'Documento',
          tipo,
          contraparte: contraparte.trim() || null,
          plantilla_id: plantillaId || null,
          caso_id: casoQuery || null,
          variables_valores: valores,
          cuerpo_markdown: cuerpo,
          ...(cuerpo_estructurado ? { cuerpo_estructurado } : {}),
        }),
      });
      const data = (await res.json()) as {
        documento?: { id: string };
        error?: string;
        hint?: string;
      };
      if (!res.ok) {
        toast.error([data.error, data.hint].filter(Boolean).join(' — ') || 'Error');
        return;
      }
      toast.success('Documento creado');
      router.push(`/legal/documentos/${data.documento!.id}`);
    } catch {
      toast.error('Error de red');
    } finally {
      setEnviando(false);
    }
  }

  if (loading) {
    return (
      <p className="flex items-center gap-2 text-sm text-zinc-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Cargando plantillas…
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h2 className="text-2xl font-bold text-white">Nuevo documento</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Elige una plantilla (contrato, finiquito, poder, carta) y completa las
          variables. Luego podrás editar el texto completo.
          {casoQuery ? (
            <>
              {' '}
              Se asociará al expediente{' '}
              <span className="font-mono text-amber-200/90">{casoQuery.slice(0, 8)}…</span>.
            </>
          ) : null}
        </p>
      </header>

      <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-white/10 bg-[#0c1018] p-5">
        <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Plantilla
          <select
            className={campo}
            value={plantillaId}
            onChange={(e) => {
              setPlantillaId(e.target.value);
              setValores({});
            }}
          >
            <option value="">En blanco</option>
            {plantillas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.titulo} ({p.tipo})
              </option>
            ))}
          </select>
        </label>
        {plantilla?.descripcion && (
          <p className="text-xs text-zinc-500">{plantilla.descripcion}</p>
        )}

        <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">
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
          Contraparte
          <input
            className={campo}
            value={contraparte}
            onChange={(e) => setContraparte(e.target.value)}
          />
        </label>

        {variables.length > 0 && (
          <div className="space-y-3 border-t border-white/10 pt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-200/70">
              Variables de la plantilla
            </p>
            {variables.map((v) => (
              <label
                key={v.key}
                className="block text-xs font-semibold uppercase tracking-wide text-zinc-500"
              >
                {v.label}
                <input
                  className={campo}
                  value={valores[v.key] ?? ''}
                  onChange={(e) =>
                    setValores((prev) => ({ ...prev, [v.key]: e.target.value }))
                  }
                />
              </label>
            ))}
          </div>
        )}

        <div className="space-y-2 border-t border-white/10 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-200/70">
              O JSON estructurado (bloques)
            </p>
            <button
              type="button"
              className="text-xs text-amber-300 hover:underline"
              onClick={() =>
                setJsonEstructurado(
                  JSON.stringify(LEGAL_DOCUMENT_ESTRUCTURADO_EJEMPLO, null, 2),
                )
              }
            >
              Cargar ejemplo
            </button>
          </div>
          <textarea
            className={`${campo} min-h-[180px] font-mono text-[12px]`}
            placeholder='{"document_title":"...","blocks":[{"type":"title","content":"..."}]}'
            value={jsonEstructurado}
            onChange={(e) => setJsonEstructurado(e.target.value)}
            spellCheck={false}
          />
        </div>

        <button
          type="submit"
          disabled={enviando}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-700 px-4 py-2.5 text-sm font-bold text-black disabled:opacity-50"
        >
          {enviando && <Loader2 className="h-4 w-4 animate-spin" />}
          Crear borrador
        </button>
      </form>
    </div>
  );
}
