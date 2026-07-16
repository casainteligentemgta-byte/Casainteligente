export const WORKER_DOCS_BUCKET = 'worker-docs' as const;

export type PersonCandidateDocumentKind = 'cedula' | 'curso_seguridad' | 'otro';

export type PersonCandidateDocumentRow = {
  id: string;
  person_id: string;
  storage_bucket: string;
  storage_path: string;
  document_kind: PersonCandidateDocumentKind;
  mime_type: string | null;
  original_filename: string | null;
  validated_at: string | null;
  expiry_date: string | null;
  created_at: string;
  updated_at: string;
};

export const DOCUMENT_KIND_LABELS: Record<PersonCandidateDocumentKind, string> = {
  cedula: 'Cédula',
  curso_seguridad: 'Curso de Seguridad',
  otro: 'Otro',
};

export function hasCedulaUpload(docs: PersonCandidateDocumentRow[]): boolean {
  return docs.some((d) => d.document_kind === 'cedula');
}

/** Cédula cargada pero aún sin validación de RRHH. */
export function isCedulaDocumentationIncomplete(docs: PersonCandidateDocumentRow[]): boolean {
  return !hasCedulaUpload(docs);
}

export function hasValidatedCedula(docs: PersonCandidateDocumentRow[]): boolean {
  return docs.some((d) => d.document_kind === 'cedula' && d.validated_at);
}

export function hasValidatedCursoSeguridad(docs: PersonCandidateDocumentRow[]): boolean {
  return docs.some(
    (d) =>
      d.document_kind === 'curso_seguridad' &&
      d.validated_at &&
      d.expiry_date != null &&
      String(d.expiry_date).trim() !== '',
  );
}

/** Días hasta la fecha YYYY-MM-DD (UTC fecha civil). Negativo = vencido. */
function diasHastaVencimientoUtc(ymd: string | null): number {
  if (!ymd) return -9999;
  const clean = ymd.slice(0, 10);
  const parts = clean.split('-').map((x) => parseInt(x, 10));
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return -9999;
  const [yy, mm, dd] = parts;
  const end = Date.UTC(yy, mm - 1, dd);
  const now = new Date();
  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((end - start) / 86400000);
}

/**
 * Curso de seguridad validado con vigencia menor a `minDiasRestantes` días (o ya vencido).
 * Recomendación legal: minDíasRestantes = 7 antes de nueva asignación a obra.
 */
export function cursoSeguridadBloqueadoPorVencimientoProximo(
  docs: PersonCandidateDocumentRow[],
  minDiasRestantes = 7,
): boolean {
  for (const d of docs) {
    if (d.document_kind !== 'curso_seguridad' || !d.validated_at || !d.expiry_date) continue;
    if (diasHastaVencimientoUtc(d.expiry_date) < minDiasRestantes) return true;
  }
  return false;
}

export function canAssignToObra(docs: PersonCandidateDocumentRow[]): boolean {
  if (!hasValidatedCedula(docs) || !hasValidatedCursoSeguridad(docs)) return false;
  return !cursoSeguridadBloqueadoPorVencimientoProximo(docs, 7);
}
