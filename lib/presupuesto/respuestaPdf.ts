import { NextResponse } from 'next/server';
import { filenamePresupuestoPdf } from '@/lib/presupuesto/brand';
import { blobPdfPresupuesto } from '@/lib/presupuesto/generarPdf';
import { logoPresupuestoAbsoluto } from '@/lib/presupuesto/pdfDatos';
import type { DocumentoPresupuestoCliente } from '@/lib/presupuesto/documentoCliente';
import { origenPublicoPresupuesto } from '@/lib/presupuesto/tokenDocumento';

export async function respuestaPdfPresupuesto(
  doc: DocumentoPresupuestoCliente,
  req?: Request,
  disposicion: 'attachment' | 'inline' = 'attachment',
): Promise<NextResponse> {
  const base = origenPublicoPresupuesto(req);
  const blob = await blobPdfPresupuesto(doc, { logoSrc: logoPresupuestoAbsoluto(base) });
  const file = filenamePresupuestoPdf(doc.numero, 'pdf');
  const ascii = file.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, '');
  return new NextResponse(blob, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${disposicion}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(file)}`,
      'Cache-Control': 'private, no-store',
    },
  });
}
