import { createElement } from 'react';
import { pdf } from '@react-pdf/renderer';
import { BudgetPDF } from '@/components/pdf/BudgetPDF';
import type { DocumentoPresupuestoCliente } from './documentoCliente';
import { budgetPdfDataDesdeDocumento } from './pdfDatos';

export { budgetPdfDataDesdeDocumento, logoPresupuestoAbsoluto } from './pdfDatos';

export async function blobPdfPresupuesto(
  doc: DocumentoPresupuestoCliente,
  opts?: { logoSrc?: string | null },
): Promise<Blob> {
  const data = budgetPdfDataDesdeDocumento(doc, opts);
  const node = createElement(BudgetPDF, { data });
  return pdf(node as Parameters<typeof pdf>[0]).toBlob();
}

export async function bufferPdfPresupuesto(
  doc: DocumentoPresupuestoCliente,
  opts?: { logoSrc?: string | null },
): Promise<Buffer> {
  const blob = await blobPdfPresupuesto(doc, opts);
  return Buffer.from(await blob.arrayBuffer());
}
