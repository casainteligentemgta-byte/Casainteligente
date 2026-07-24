/**
 * Agente de conciliación: factura (PDF/imagen) → egreso CCO sin soporte.
 * PDF multipágina: parte por página, OCR cabecera, agrupa misma factura, match local.
 */

import {
  extractPurchaseInvoiceFromFile,
  extractPurchaseInvoiceHeaderFromFile,
  mimeFromFile,
  type ExtractedPurchaseInvoice,
} from '@/lib/almacen/extractPurchaseInvoiceGemini';
import {
  agruparPaginasMismaFactura,
  type CabeceraPaginaFactura,
} from '@/lib/contabilidad/cco/agruparPaginasFacturaPdf';
import {
  decidirMatchFacturaEgresos,
  MAX_BYTES_SOPORTE,
  MAX_SOPORTES_POR_REQUEST,
  type CandidatoScore,
  type DecisionMatch,
  type EgresoCandidatoSoporte,
} from '@/lib/contabilidad/cco/emparejarSoportesEgresosScoring';
import {
  esPdfMime,
  partirPdfPorPaginas,
  unirPdfPaginas,
  MAX_PAGINAS_POR_PDF,
} from '@/lib/contabilidad/cco/partirPdfPorPaginas';

export {
  UMBRAL_AUTO,
  UMBRAL_DUDA,
  MARGEN_AUTO_VS_SEGUNDO,
  MAX_SOPORTES_POR_REQUEST,
  MAX_BYTES_SOPORTE,
  decidirMatchFacturaEgresos,
  puntuarEgresoContraFactura,
  type EgresoCandidatoSoporte,
  type CandidatoScore,
  type DecisionMatch,
  type DesgloseMatch,
  type FacturaCabeceraMatch,
} from '@/lib/contabilidad/cco/emparejarSoportesEgresosScoring';

/** Tope de unidades OCR (páginas/imágenes) por request para no saturar Vercel/Gemini. */
export const MAX_UNIDADES_OCR = 15;

export type SoporteArchivoInput = {
  id: string;
  buffer: Buffer;
  mimeType: string;
  fileName: string;
};

export type MatchSoporteEgreso = {
  archivoId: string;
  fileName: string;
  decision: DecisionMatch;
  egresoId: string | null;
  confianza: number;
  candidatos: CandidatoScore[];
  leido: {
    invoice_number: string;
    supplier_name: string;
    supplier_rif: string;
    fecha: string;
    total_amount: number | null;
  };
  motivo: string;
  error?: string;
  /** PDF multipágina: páginas 1-based del grupo. */
  paginas?: number[];
  /** PDF/imagen listo para adjuntar (base64). */
  adjuntoBase64?: string;
  adjuntoMime?: string;
  adjuntoFileName?: string;
};

const ALLOWED = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
]);

export function mimeFromSoporteFactura(file: File): string | null {
  const t = (file.type || '').toLowerCase();
  if (ALLOWED.has(t) || t.startsWith('image/')) return t || 'application/octet-stream';
  return mimeFromFile({ type: file.type, name: file.name });
}

type UnidadOcr = {
  /** Id estable para el match (archivo o archivo#páginas). */
  unidadId: string;
  origenId: string;
  fileName: string;
  mimeType: string;
  buffer: Buffer;
  paginas?: number[];
};

/**
 * Expande archivos: cada página de PDF → unidad OCR; imágenes se quedan 1:1.
 */
export async function expandirSoportesAUnidades(
  archivos: SoporteArchivoInput[],
): Promise<UnidadOcr[]> {
  const unidades: UnidadOcr[] = [];

  for (const archivo of archivos) {
    if (esPdfMime(archivo.mimeType, archivo.fileName)) {
      const paginas = await partirPdfPorPaginas(archivo.buffer, {
        maxPaginas: MAX_PAGINAS_POR_PDF,
      });
      if (paginas.length === 1) {
        unidades.push({
          unidadId: archivo.id,
          origenId: archivo.id,
          fileName: archivo.fileName,
          mimeType: 'application/pdf',
          buffer: paginas[0]!.buffer,
          paginas: [1],
        });
      } else {
        for (const p of paginas) {
          unidades.push({
            unidadId: `${archivo.id}#p${p.pageNumber}`,
            origenId: archivo.id,
            fileName: `${baseName(archivo.fileName)}_p${p.pageNumber}.pdf`,
            mimeType: 'application/pdf',
            buffer: p.buffer,
            paginas: [p.pageNumber],
          });
        }
      }
    } else {
      unidades.push({
        unidadId: archivo.id,
        origenId: archivo.id,
        fileName: archivo.fileName,
        mimeType: archivo.mimeType,
        buffer: archivo.buffer,
      });
    }
  }

  if (unidades.length > MAX_UNIDADES_OCR) {
    throw new Error(
      `Tras partir PDFs hay ${unidades.length} páginas/archivos (máx. ${MAX_UNIDADES_OCR} por lote). Suba menos archivos o PDFs más cortos.`,
    );
  }

  return unidades;
}

function baseName(name: string): string {
  return name.replace(/\.pdf$/i, '') || 'factura';
}

/**
 * OCR + matching. PDFs multipágina se parten, se agrupan por misma factura y se emparejan.
 */
export async function emparejarSoportesConEgresos(params: {
  egresos: EgresoCandidatoSoporte[];
  archivos: SoporteArchivoInput[];
  concurrency?: number;
}): Promise<{ matches: MatchSoporteEgreso[]; modelHint: string }> {
  const { egresos, archivos } = params;
  if (egresos.length === 0) {
    throw new Error('No hay egresos sin soporte para emparejar.');
  }
  if (archivos.length === 0) {
    throw new Error('Envíe al menos un PDF o imagen de factura.');
  }
  if (archivos.length > MAX_SOPORTES_POR_REQUEST) {
    throw new Error(
      `Máximo ${MAX_SOPORTES_POR_REQUEST} archivos por lote. Procese por lotes.`,
    );
  }

  for (const a of archivos) {
    if (a.buffer.byteLength > MAX_BYTES_SOPORTE) {
      throw new Error(`"${a.fileName}" supera 12 MB.`);
    }
  }

  const unidades = await expandirSoportesAUnidades(archivos);
  const concurrency = Math.max(1, Math.min(params.concurrency ?? 2, 3));

  type PaginaLeida = {
    unidad: UnidadOcr;
    cabecera: CabeceraPaginaFactura;
    modelUsed: string;
    error?: string;
  };

  const leidas: PaginaLeida[] = [];
  let i = 0;
  let modelHint = 'gemini';

  async function worker() {
    while (i < unidades.length) {
      const idx = i++;
      const u = unidades[idx]!;
      try {
        const { data, modelUsed } = await leerCabeceraUnidad(u);
        modelHint = modelUsed;
        const pageNumber = u.paginas?.[0] ?? 1;
        const pageIndex = pageNumber - 1;
        leidas[idx] = {
          unidad: u,
          modelUsed,
          cabecera: {
            pageIndex,
            pageNumber,
            invoice_number: data.invoice_number || '',
            supplier_name: data.supplier_name || '',
            supplier_rif: data.supplier_rif || '',
            date: data.date || '',
            total_amount: data.total_amount,
          },
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        leidas[idx] = {
          unidad: u,
          modelUsed: '',
          cabecera: {
            pageIndex: (u.paginas?.[0] ?? 1) - 1,
            pageNumber: u.paginas?.[0] ?? 1,
            invoice_number: '',
            supplier_name: '',
            supplier_rif: '',
            date: '',
            total_amount: null,
          },
          error: msg.slice(0, 220),
        };
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, unidades.length) }, () => worker()),
  );

  // Agrupar por archivo origen (PDF multipágina) o 1:1 imágenes
  const porOrigen = new Map<string, PaginaLeida[]>();
  for (const L of leidas) {
    const list = porOrigen.get(L.unidad.origenId) ?? [];
    list.push(L);
    porOrigen.set(L.unidad.origenId, list);
  }

  const matches: MatchSoporteEgreso[] = [];

  for (const archivo of archivos) {
    const paginasArchivo = (porOrigen.get(archivo.id) ?? []).sort(
      (a, b) => a.cabecera.pageIndex - b.cabecera.pageIndex,
    );

    if (paginasArchivo.length === 0) continue;

    const esPdfMulti =
      esPdfMime(archivo.mimeType, archivo.fileName) && paginasArchivo.length > 1;

    if (!esPdfMulti) {
      const L = paginasArchivo[0]!;
      matches.push(
        await matchDesdePagina({
          L,
          egresos,
          adjuntoBuffer: L.unidad.buffer,
          adjuntoMime: L.unidad.mimeType,
          adjuntoFileName: L.unidad.fileName,
          archivoId: archivo.id,
          fileName: archivo.fileName,
          paginas: L.unidad.paginas,
        }),
      );
      continue;
    }

    const okPages = paginasArchivo.filter((p) => !p.error);
    const errPages = paginasArchivo.filter((p) => p.error);

    for (const E of errPages) {
      matches.push({
        archivoId: `${archivo.id}#p${E.cabecera.pageNumber}`,
        fileName: `${archivo.fileName} · p.${E.cabecera.pageNumber}`,
        decision: 'sin_match',
        egresoId: null,
        confianza: 0,
        candidatos: [],
        leido: {
          invoice_number: '',
          supplier_name: '',
          supplier_rif: '',
          fecha: '',
          total_amount: null,
        },
        motivo: 'Error OCR en página',
        error: E.error,
        paginas: [E.cabecera.pageNumber],
      });
    }

    const grupos = agruparPaginasMismaFactura(okPages.map((p) => p.cabecera));

    for (const g of grupos) {
      const buffersGrupo = g.pageIndexes
        .map((idx) => okPages.find((p) => p.cabecera.pageIndex === idx)?.unidad.buffer)
        .filter((b): b is Buffer => Boolean(b));

      const adjuntoBuffer =
        buffersGrupo.length > 1 ? await unirPdfPaginas(buffersGrupo) : buffersGrupo[0]!;

      const etiquetaPaginas =
        g.pageNumbers.length === 1
          ? `p.${g.pageNumbers[0]}`
          : `p.${g.pageNumbers[0]}–${g.pageNumbers[g.pageNumbers.length - 1]}`;

      const Lref = okPages.find((p) => p.cabecera.pageIndex === g.cabecera.pageIndex)!;

      matches.push(
        await matchDesdePagina({
          L: {
            ...Lref,
            cabecera: g.cabecera,
          },
          egresos,
          adjuntoBuffer,
          adjuntoMime: 'application/pdf',
          adjuntoFileName: `${baseName(archivo.fileName)}_${etiquetaPaginas.replace(/[–.]/g, '_')}.pdf`,
          archivoId: `${archivo.id}#${etiquetaPaginas.replace(/\s/g, '')}`,
          fileName: `${archivo.fileName} · ${etiquetaPaginas}`,
          paginas: g.pageNumbers,
        }),
      );
    }
  }

  // Colisiones auto: un egreso solo recibe el soporte de mayor confianza
  const porEgreso = new Map<string, MatchSoporteEgreso>();
  for (const m of matches) {
    if (m.decision !== 'auto' || !m.egresoId) continue;
    const prev = porEgreso.get(m.egresoId);
    if (!prev || m.confianza > prev.confianza) {
      porEgreso.set(m.egresoId, m);
    }
  }
  const ganadores = new Set(
    Array.from(porEgreso.values()).map((m) => `${m.archivoId}::${m.egresoId}`),
  );

  const resueltos = matches.map((m) => {
    if (m.decision !== 'auto' || !m.egresoId) return m;
    if (ganadores.has(`${m.archivoId}::${m.egresoId}`)) return m;
    return {
      ...m,
      decision: 'duda' as const,
      motivo: `${m.motivo} · Otro archivo/página también apunta a este egreso; confirme manualmente.`,
    };
  });

  return { matches: resueltos, modelHint };
}

async function leerCabeceraUnidad(
  u: UnidadOcr,
): Promise<{ data: ExtractedPurchaseInvoice; modelUsed: string }> {
  // Imágenes: cabecera; PDF de 1 página: cabecera (barato)
  try {
    return await extractPurchaseInvoiceHeaderFromFile({
      buffer: u.buffer,
      mimeType: u.mimeType,
      fileName: u.fileName,
    });
  } catch (headerErr) {
    // Fallback al extractor completo si la cabecera falla
    console.warn(
      '[emparejarSoportes] cabecera falló, reintento full:',
      headerErr instanceof Error ? headerErr.message : headerErr,
    );
    return await extractPurchaseInvoiceFromFile({
      buffer: u.buffer,
      mimeType: u.mimeType,
      fileName: u.fileName,
    });
  }
}

async function matchDesdePagina(params: {
  L: {
    cabecera: CabeceraPaginaFactura;
    error?: string;
  };
  egresos: EgresoCandidatoSoporte[];
  adjuntoBuffer: Buffer;
  adjuntoMime: string;
  adjuntoFileName: string;
  archivoId: string;
  fileName: string;
  paginas?: number[];
}): Promise<MatchSoporteEgreso> {
  const { L, egresos, adjuntoBuffer, adjuntoMime, adjuntoFileName, archivoId, fileName, paginas } =
    params;

  if (L.error) {
    return {
      archivoId,
      fileName,
      decision: 'sin_match',
      egresoId: null,
      confianza: 0,
      candidatos: [],
      leido: {
        invoice_number: '',
        supplier_name: '',
        supplier_rif: '',
        fecha: '',
        total_amount: null,
      },
      motivo: 'Error OCR',
      error: L.error,
      paginas,
    };
  }

  const factura: ExtractedPurchaseInvoice = {
    invoice_number: L.cabecera.invoice_number,
    supplier_name: L.cabecera.supplier_name,
    supplier_rif: L.cabecera.supplier_rif,
    date: L.cabecera.date,
    total_amount: L.cabecera.total_amount,
    items: [],
  };

  const decided = decidirMatchFacturaEgresos(factura, egresos);
  const paginasNota =
    paginas && paginas.length > 0
      ? ` · pág. ${paginas.length === 1 ? paginas[0] : `${paginas[0]}–${paginas[paginas.length - 1]}`}`
      : '';

  return {
    archivoId,
    fileName,
    decision: decided.decision,
    egresoId: decided.egresoId,
    confianza: decided.confianza,
    candidatos: decided.candidatos,
    leido: {
      invoice_number: factura.invoice_number || '',
      supplier_name: factura.supplier_name || '',
      supplier_rif: factura.supplier_rif || '',
      fecha: factura.date || '',
      total_amount: factura.total_amount,
    },
    motivo: `${decided.motivo}${paginasNota}`,
    paginas,
    adjuntoBase64: adjuntoBuffer.toString('base64'),
    adjuntoMime,
    adjuntoFileName,
  };
}
