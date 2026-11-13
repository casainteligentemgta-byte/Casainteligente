/** Mismo kind que el flujo de depositario (`notaEntregaRegistro`). */
export const NOTA_ENTREGA_KIND = 'nota_entrega_telegram';

/** Texto exacto que ve Luis en la cola / cuadro cuando el documento es nota de entrega. */
export const MENSAJE_ERROR_NOTA_ENTREGA =
  'Atención: Nota de entrega. Cargar datos: proveedor, RIF, entidad, obra. No coloca precios.';

const KINDS_NOTA = new Set([
  'nota_entrega',
  'nota_entrega_telegram',
  'nota-entrega',
  'notaentrega',
]);

export type FilaDestinoNotaEntrega = {
  entidad_id?: string | null;
  proyecto_id?: string | null;
};

function texto(v: unknown): string {
  return String(v ?? '').trim();
}

function sinAcentos(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function numeroONull(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function preciosDeExtracted(extracted: Record<string, unknown> | null | undefined): number[] {
  const ex = extracted ?? {};
  const precios: number[] = [];
  const total = numeroONull(ex.total_amount);
  if (total != null) precios.push(total);
  const items = Array.isArray(ex.items) ? ex.items : [];
  for (const it of items) {
    if (!it || typeof it !== 'object') continue;
    const precio = numeroONull((it as { unit_price?: unknown }).unit_price);
    if (precio != null) precios.push(precio);
  }
  return precios;
}

/** Sin montos, o todos los precios/total en 0. */
export function preciosDocumentoEnCero(
  extracted: Record<string, unknown> | null | undefined,
): boolean {
  const precios = preciosDeExtracted(extracted);
  return precios.length === 0 || precios.every((p) => p === 0);
}

/** El encabezado (o el kind de la IA) dice que es nota de entrega. */
export function documentoDiceNotaEntrega(
  extracted: Record<string, unknown> | null | undefined,
): boolean {
  const ex = extracted ?? {};
  const blob = sinAcentos(
    [ex.document_kind, ex.tipo_documento, ex.document_title, ex.invoice_number, ex.tipo]
      .map((v) => texto(v))
      .join(' '),
  ).toLowerCase();
  if (KINDS_NOTA.has(blob.replace(/\s+/g, '_')) || KINDS_NOTA.has(blob.replace(/\s+/g, ''))) {
    return true;
  }
  return /\bnota\s*(de\s*)?entrega\b/.test(blob);
}

export function esNotaEntregaCanal(
  extracted: Record<string, unknown> | null | undefined,
): boolean {
  const kind = sinAcentos(texto(extracted?.document_kind)).toLowerCase().replace(/\s+/g, '_');
  if (KINDS_NOTA.has(kind)) return true;
  if (extracted?.es_nota_entrega === true || extracted?.es_nota_entrega === 'true') return true;
  if (documentoDiceNotaEntrega(extracted)) return true;
  return preciosDocumentoEnCero(extracted);
}

export function notaEntregaDatosCompletos(
  extracted: Record<string, unknown> | null | undefined,
  row?: FilaDestinoNotaEntrega | null,
): boolean {
  return Boolean(
    texto(extracted?.supplier_name ?? extracted?.proveedor) &&
      texto(extracted?.supplier_rif) &&
      texto(row?.entidad_id) &&
      texto(row?.proyecto_id),
  );
}

export function aplicarMarcaNotaEntrega(
  extracted: Record<string, unknown>,
): Record<string, unknown> {
  return {
    ...extracted,
    document_kind: NOTA_ENTREGA_KIND,
    factura_pendiente: true,
  };
}

/** Tras el OCR: si es nota de entrega, deja la fila en revisión para que Luis ponga precios. */
export function prepararExtractedNotaEntrega(extracted: Record<string, unknown>): {
  extracted: Record<string, unknown>;
  esNota: boolean;
  requiere_revision: boolean;
  mensaje_error: string | null;
} {
  if (!esNotaEntregaCanal(extracted)) {
    return {
      extracted,
      esNota: false,
      requiere_revision: false,
      mensaje_error: null,
    };
  }
  return {
    extracted: aplicarMarcaNotaEntrega(extracted),
    esNota: true,
    requiere_revision: true,
    mensaje_error: MENSAJE_ERROR_NOTA_ENTREGA,
  };
}
