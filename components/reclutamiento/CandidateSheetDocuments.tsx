'use client';

import FileUploader from '@/components/reclutamiento/FileUploader';
import DocumentList from '@/components/reclutamiento/DocumentList';
import { isCedulaDocumentationIncomplete, type PersonCandidateDocumentRow } from '@/lib/reclutamiento/personCandidateDocuments';

type Props = {
  personId: string;
  documents: PersonCandidateDocumentRow[];
  onDocumentsChange: () => void;
};

export default function CandidateSheetDocuments({ personId, documents, onDocumentsChange }: Props) {
  const incomplete = isCedulaDocumentationIncomplete(documents);

  return (
    <div className="space-y-3 border-t border-white/10 pt-4">
      <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">Documentación</p>

      {incomplete ? (
        <div className="rounded-lg border border-orange-500/50 bg-orange-950/40 px-3 py-2 text-[11px] text-orange-100">
          <span className="font-semibold">Documentación Incompleta</span>
          <span className="mt-0.5 block text-orange-200/90">Falta cargar la cédula.</span>
        </div>
      ) : null}

      <FileUploader personId={personId} onUploaded={onDocumentsChange} />

      <DocumentList personId={personId} documents={documents} onUpdated={onDocumentsChange} />
    </div>
  );
}
