'use client';

import { useMemo, useState } from 'react';
import { Check, ExternalLink, FileText, Image as ImageIcon, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import {
  DOCUMENT_KIND_LABELS,
  type PersonCandidateDocumentRow,
  WORKER_DOCS_BUCKET,
} from '@/lib/reclutamiento/personCandidateDocuments';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type Props = {
  personId: string;
  documents: PersonCandidateDocumentRow[];
  onUpdated: () => void;
  className?: string;
};

function isPdf(mime: string | null): boolean {
  return (mime ?? '').includes('pdf');
}

export default function DocumentList({ personId, documents, onUpdated, className }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [expiryDraft, setExpiryDraft] = useState<Record<string, string>>({});

  async function openSignedUrl(doc: PersonCandidateDocumentRow) {
    setOpeningId(doc.id);
    try {
      const bucket = doc.storage_bucket || WORKER_DOCS_BUCKET;
      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(doc.storage_path, 3600);
      if (error || !data?.signedUrl) throw new Error(error?.message ?? 'Sin URL');
      window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo abrir el archivo');
    } finally {
      setOpeningId(null);
    }
  }

  async function validateDoc(doc: PersonCandidateDocumentRow) {
    const expiry =
      doc.document_kind === 'curso_seguridad' ? (expiryDraft[doc.id] ?? '').trim() : undefined;
    if (doc.document_kind === 'curso_seguridad' && !expiry) {
      toast.error('Indica la fecha de vencimiento del curso de seguridad');
      return;
    }

    setSavingId(doc.id);
    try {
      const { error } = await supabase
        .from('person_candidate_documents')
        .update({
          validated_at: new Date().toISOString(),
          expiry_date: doc.document_kind === 'curso_seguridad' ? expiry : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', doc.id)
        .eq('person_id', personId);
      if (error) throw new Error(error.message);
      toast.success('Documento validado');
      onUpdated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo validar');
    } finally {
      setSavingId(null);
    }
  }

  if (documents.length === 0) {
    return (
      <p className={cn('rounded-lg border border-white/10 bg-black/30 px-3 py-4 text-center text-[11px] text-zinc-500', className)}>
        Aún no hay documentos cargados.
      </p>
    );
  }

  return (
    <ul className={cn('space-y-2', className)}>
      {documents.map((doc) => {
        const validated = Boolean(doc.validated_at);
        const Icon = isPdf(doc.mime_type) ? FileText : ImageIcon;
        return (
          <li
            key={doc.id}
            className="rounded-lg border border-white/10 bg-black/30 p-2.5"
          >
            <div className="flex items-start gap-2">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-red-500/15 text-red-300">
                <Icon className="h-4 w-4" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold text-white">{DOCUMENT_KIND_LABELS[doc.document_kind]}</p>
                <p className="truncate text-[10px] text-zinc-500">{doc.original_filename ?? doc.storage_path}</p>
                {validated && doc.document_kind === 'curso_seguridad' && doc.expiry_date ? (
                  <p className="mt-0.5 text-[10px] text-emerald-400/90">
                    Vence: {doc.expiry_date}
                  </p>
                ) : null}
                {validated ? (
                  <p className="mt-1 text-[10px] font-medium text-emerald-400">Validado</p>
                ) : null}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 border-white/15 px-2 text-[10px]"
                  disabled={openingId === doc.id}
                  onClick={() => void openSignedUrl(doc)}
                >
                  {openingId === doc.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <>
                      <ExternalLink className="mr-1 inline h-3 w-3" />
                      Ver
                    </>
                  )}
                </Button>
              </div>
            </div>

            {!validated ? (
              <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-white/5 pt-2">
                {doc.document_kind === 'curso_seguridad' ? (
                  <div className="flex flex-1 flex-wrap items-center gap-2">
                    <label className="text-[10px] text-zinc-500">
                      Vigencia hasta
                      <Input
                        type="date"
                        className="mt-0.5 h-8 border-white/15 bg-black/40 text-xs text-white"
                        value={expiryDraft[doc.id] ?? ''}
                        onChange={(e) => setExpiryDraft((d) => ({ ...d, [doc.id]: e.target.value }))}
                      />
                    </label>
                  </div>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 border-emerald-500/40 bg-emerald-950/20 px-2 text-[10px] text-emerald-100"
                  disabled={savingId === doc.id}
                  onClick={() => void validateDoc(doc)}
                  title="Marcar como validado (RRHH)"
                >
                  {savingId === doc.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <>
                      <Check className="mr-1 inline h-3.5 w-3.5" />
                      Validar
                    </>
                  )}
                </Button>
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
