'use client';

import { useCallback, useMemo, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { friendlyStorageError } from '@/lib/supabase/friendlyStorageError';
import {
  DOCUMENT_KIND_LABELS,
  type PersonCandidateDocumentKind,
  WORKER_DOCS_BUCKET,
} from '@/lib/reclutamiento/personCandidateDocuments';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

const ACCEPT = { 'application/pdf': ['.pdf'], 'image/*': ['.png', '.jpg', '.jpeg', '.webp', '.gif'] };

function extFromFileName(name: string): string {
  const i = name.lastIndexOf('.');
  if (i < 0) return '';
  const e = name.slice(i, i + 16).toLowerCase();
  return /^\.[a-z0-9]+$/.test(e) ? e : '';
}

type Props = {
  personId: string;
  onUploaded: () => void;
  className?: string;
};

export default function FileUploader({ personId, onUploaded, className }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [kind, setKind] = useState<PersonCandidateDocumentKind>('cedula');
  const [uploading, setUploading] = useState(false);

  const onDrop = useCallback(
    async (accepted: File[]) => {
      const file = accepted[0];
      if (!file) return;
      setUploading(true);
      try {
        const ext = extFromFileName(file.name) || (file.type === 'application/pdf' ? '.pdf' : '.bin');
        const path = `candidates/${personId}/${crypto.randomUUID()}${ext}`;

        const { error: upErr } = await supabase.storage.from(WORKER_DOCS_BUCKET).upload(path, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type || undefined,
        });
        if (upErr) {
          throw new Error(friendlyStorageError(WORKER_DOCS_BUCKET, upErr.message));
        }

        const { error: insErr } = await supabase.from('person_candidate_documents').insert({
          person_id: personId,
          storage_bucket: WORKER_DOCS_BUCKET,
          storage_path: path,
          document_kind: kind,
          mime_type: file.type || null,
          original_filename: file.name.slice(0, 240),
        });
        if (insErr) {
          await supabase.storage.from(WORKER_DOCS_BUCKET).remove([path]);
          throw new Error(insErr.message);
        }

        toast.success('Documento subido');
        onUploaded();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'No se pudo subir el archivo');
      } finally {
        setUploading(false);
      }
    },
    [kind, onUploaded, personId, supabase],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (files) => void onDrop(files),
    accept: ACCEPT,
    maxFiles: 1,
    multiple: false,
    disabled: uploading,
    onDropRejected: (rej) => {
      const first = rej[0]?.errors[0]?.message;
      toast.error(first ?? 'Solo PDF o imágenes');
    },
  });

  return (
    <div className={cn('space-y-2', className)}>
      <div>
        <Label className="text-[10px] font-bold uppercase text-zinc-500">Tipo de documento</Label>
        <select
          className="mt-1 flex h-9 w-full rounded-md border border-white/15 bg-black/40 px-2 text-sm text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-sky-500"
          value={kind}
          onChange={(e) => setKind(e.target.value as PersonCandidateDocumentKind)}
          disabled={uploading}
        >
          {(Object.keys(DOCUMENT_KIND_LABELS) as PersonCandidateDocumentKind[]).map((k) => (
            <option key={k} value={k} className="bg-zinc-900">
              {DOCUMENT_KIND_LABELS[k]}
            </option>
          ))}
        </select>
      </div>

      <div
        {...getRootProps({
          className: cn(
            'flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-3 py-6 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-sky-500',
            isDragActive ? 'border-sky-400 bg-sky-500/10' : 'border-white/20 bg-black/20 hover:border-white/35',
            uploading && 'pointer-events-none opacity-60',
          ),
        })}
      >
        <input {...getInputProps()} />
        {uploading ? (
          <Loader2 className="h-8 w-8 animate-spin text-sky-400" aria-hidden />
        ) : (
          <Upload className="h-8 w-8 text-zinc-500" aria-hidden />
        )}
        <p className="mt-2 text-center text-[11px] text-zinc-400">
          Arrastra un PDF o una imagen, o haz clic para elegir
        </p>
      </div>
    </div>
  );
}
