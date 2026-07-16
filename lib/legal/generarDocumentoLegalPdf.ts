import { createElement } from 'react';
import { pdf } from '@react-pdf/renderer';
import { DocumentoLegalPdfDocument } from '@/lib/legal/DocumentoLegalPdf';
import {
  parseDocumentoEstructurado,
  type LegalDocumentStructured,
} from '@/lib/legal/documentoEstructurado';

export async function generarDocumentoLegalPdfBlob(input: {
  titulo: string;
  cuerpo_estructurado?: unknown;
  cuerpo_markdown?: string | null;
}): Promise<{ blob: Blob; filename: string; document: LegalDocumentStructured }> {
  const parsed = parseDocumentoEstructurado(input.cuerpo_estructurado);
  const document: LegalDocumentStructured = parsed ?? {
    document_title: input.titulo || 'Documento',
    blocks: [],
  };

  const node = createElement(DocumentoLegalPdfDocument, {
    document,
    cuerpoFallback: input.cuerpo_markdown,
    pie: 'Documento generado por el Departamento Legal. Revisar antes de firmar.',
  });

  const blob = await pdf(node as Parameters<typeof pdf>[0]).toBlob();
  const safe = (document.document_title || 'documento')
    .replace(/[^\w\sáéíóúñÁÉÍÓÚÑ-]/gi, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 48);
  return {
    blob,
    filename: `${safe || 'documento-legal'}.pdf`,
    document,
  };
}
