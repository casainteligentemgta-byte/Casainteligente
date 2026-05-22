import {
  GEMINI_PROCUREMENT_DEFAULT_MODEL,
  procurementModelCandidates,
} from '@/lib/almacen/geminiProcurementModels';
import { geminiGenerateWithDocument } from '@/lib/gemini/client';

export type ExtractedInvoiceItem = {
  description: string;
  item_code: string;
  unit: string;
  quantity: number;
  unit_price: number;
};

export type ExtractedPurchaseInvoice = {
  invoice_number: string;
  supplier_rif: string;
  supplier_name: string;
  date: string;
  total_amount: number | null;
  items: ExtractedInvoiceItem[];
};

const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
]);

const MAX_BYTES = 12 * 1024 * 1024;

const EXTRACTION_PROMPT = `Extrae datos de esta factura o nota de entrega venezolana.

MONEDA: Los montos de la factura están en BOLÍVARES (VES). quantity, unit_price y total_amount son siempre en Bs, sin convertir a dólares.

OBLIGATORIO — Tabla de detalle (cuerpo de la factura):
- Lee TODAS las filas de la tabla: Descripción/Concepto/Artículo, Cantidad, Precio unitario.
- Cada fila va en items[] con:
  - description: nombre o descripción del artículo tal como en la factura (sin inventar).
  - item_code: código o referencia del producto si hay columna Código/Ref ("" si no hay).
  - unit: unidad de medida (UND, KG, M, PZA, etc.; "UND" si no aparece).
  - quantity: cantidad numérica (usa 1 si no aparece).
  - unit_price: precio unitario sin IVA. Si solo hay subtotal de línea, divide subtotal/cantidad.
- NO omitas filas. NO incluyas subtotales, IVA, descuentos globales ni "Total" como ítem.
- Si la tabla tiene muchas filas, inclúyelas todas.

Encabezado:
- invoice_number, supplier_name, supplier_rif (emisor, no el cliente), date (YYYY-MM-DD), total_amount (total en Bs, con IVA si así figura en el documento).

El proveedor es quien EMITE la factura, no el comprador.`;

const ITEMS_ONLY_PROMPT = `Solo extrae la TABLA DE DETALLE / líneas de productos de esta factura venezolana.

Devuelve items[] con TODAS las filas:
- description, item_code (si hay), unit, quantity, unit_price.

No incluyas totales ni IVA como ítems.`;

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    invoice_number: {
      type: 'string',
      description: 'Número de factura o control fiscal exacto como en el documento',
    },
    supplier_rif: {
      type: 'string',
      description: 'RIF del emisor/proveedor, ej. J-12345678-9',
    },
    supplier_name: {
      type: 'string',
      description: 'Razón social o nombre del proveedor emisor',
    },
    date: {
      type: 'string',
      description: 'Fecha de emisión YYYY-MM-DD',
    },
    total_amount: {
      type: 'number',
      description: 'Monto total de la factura; 0 si no aparece',
    },
    items: {
      type: 'array',
      description:
        'Todas las líneas de la tabla de detalle de la factura; no puede estar vacía si hay tabla visible',
      items: {
        type: 'object',
        properties: {
          description: {
            type: 'string',
            description: 'Descripción o nombre del producto/servicio en esa fila',
          },
          item_code: {
            type: 'string',
            description: 'Código o referencia del artículo en la factura',
          },
          unit: { type: 'string', description: 'Unidad de medida: UND, KG, M, etc.' },
          quantity: { type: 'number', description: 'Cantidad' },
          unit_price: { type: 'number', description: 'Precio unitario' },
        },
        required: ['description', 'item_code', 'unit', 'quantity', 'unit_price'],
      },
    },
  },
  required: ['invoice_number', 'supplier_rif', 'supplier_name', 'date', 'items'],
};

const ITEMS_ONLY_SCHEMA = {
  type: 'object',
  properties: {
    items: RESPONSE_SCHEMA.properties.items,
  },
  required: ['items'],
};

export function mimeFromFile(file: { type: string; name: string }): string | null {
  const t = file.type?.trim().toLowerCase();
  if (t && ALLOWED_MIME.has(t)) return t;
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return 'application/pdf';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'gif') return 'image/gif';
  if (ext === 'heic') return 'image/heic';
  return null;
}

function normalizeDate(raw: unknown): string {
  const s = typeof raw === 'string' ? raw.trim() : '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (dmy) {
    const day = dmy[1].padStart(2, '0');
    const month = dmy[2].padStart(2, '0');
    let year = dmy[3];
    if (year.length === 2) year = `20${year}`;
    return `${year}-${month}-${day}`;
  }
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toISOString().split('T')[0];
  return new Date().toISOString().split('T')[0];
}

function toNumber(v: unknown, fallback = 0): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const normalized = v.trim().replace(/\s/g, '');
    const n = Number(
      normalized.includes(',') && normalized.includes('.')
        ? normalized.replace(/\./g, '').replace(',', '.')
        : normalized.replace(',', '.')
    );
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function pickString(source: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const v = source[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  }
  return '';
}

function asRecord(v: unknown): Record<string, unknown> | null {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
  return null;
}

/** Aplana respuestas anidadas o con claves en español que devuelve el modelo. */
export function flattenInvoicePayload(parsed: Record<string, unknown>): Record<string, unknown> {
  let flat: Record<string, unknown> = { ...parsed };

  const mergeBlock = (block: Record<string, unknown>) => {
    flat = { ...flat, ...block };
  };

  for (const key of [
    'header',
    'encabezado',
    'factura',
    'datos_factura',
    'invoice',
    'documento',
    'metadata',
    'emisor',
  ]) {
    const block = asRecord(parsed[key]);
    if (block) mergeBlock(block);
  }

  for (const key of ['proveedor', 'supplier', 'vendedor', 'emisor', 'issuer']) {
    const party = asRecord(parsed[key]) ?? asRecord(flat[key]);
    if (!party) continue;
    if (!pickString(flat, ['supplier_name'])) {
      flat.supplier_name =
        pickString(party, [
          'supplier_name',
          'nombre',
          'name',
          'razon_social',
          'razón_social',
          'razonSocial',
          'nombre_comercial',
          'empresa',
        ]) || flat.supplier_name;
    }
    if (!pickString(flat, ['supplier_rif'])) {
      flat.supplier_rif =
        pickString(party, [
          'supplier_rif',
          'rif',
          'documento',
          'nit',
          'identificacion',
          'identificación',
        ]) || flat.supplier_rif;
    }
  }

  if (!pickString(flat, ['invoice_number'])) {
    flat.invoice_number = pickString(flat, [
      'numero',
      'nro',
      'correlativo',
      'numero_control',
      'control',
    ]);
  }
  if (!pickString(flat, ['supplier_name'])) {
    flat.supplier_name = pickString(flat, ['razon_social', 'razón_social', 'emisor_nombre']);
  }
  if (!pickString(flat, ['supplier_rif'])) {
    flat.supplier_rif = pickString(flat, ['rif_emisor', 'documento_fiscal']);
  }

  return flat;
}

const ITEM_ARRAY_KEYS = [
  'items',
  'lineas',
  'line_items',
  'lineItems',
  'detalles',
  'detalle',
  'productos',
  'renglones',
  'articulos',
  'artículos',
  'rows',
  'conceptos',
  'partidas',
  'lista_items',
  'detalle_factura',
  'cuerpo',
];

function looksLikeLineItem(obj: unknown): boolean {
  const r = asRecord(obj);
  if (!r) return false;
  return Boolean(
    r.description ??
      r.descripcion ??
      r.descripción ??
      r.producto ??
      r.articulo ??
      r.artículo ??
      r.cantidad ??
      r.quantity ??
      r.precio ??
      r.unit_price ??
      r.subtotal
  );
}

/** Recolecta filas de ítems aunque vengan anidadas o con claves en español. */
export function collectInvoiceItemRows(root: Record<string, unknown>): unknown[] {
  const rows: unknown[] = [];
  const seen = new WeakSet<object>();

  const pushRows = (arr: unknown[]) => {
    for (const row of arr) {
      if (row && typeof row === 'object' && !seen.has(row as object)) {
        seen.add(row as object);
        rows.push(row);
      }
    }
  };

  const visit = (node: unknown, depth = 0) => {
    if (!node || depth > 4) return;
    if (Array.isArray(node)) {
      if (node.length > 0 && looksLikeLineItem(node[0])) pushRows(node);
      return;
    }
    const rec = asRecord(node);
    if (!rec) return;
    for (const key of ITEM_ARRAY_KEYS) {
      const val = rec[key];
      if (Array.isArray(val)) pushRows(val);
      else if (asRecord(val)) visit(val, depth + 1);
    }
  };

  visit(root);
  for (const key of ITEM_ARRAY_KEYS) {
    if (Array.isArray(root[key])) pushRows(root[key] as unknown[]);
  }

  return rows;
}

function parseRowToItem(row: unknown): ExtractedInvoiceItem | null {
  const r = row as Record<string, unknown>;
  const descParts = [
    pickString(r, [
      'description',
      'descripcion',
      'descripción',
      'detalle',
      'concepto',
      'producto',
      'articulo',
      'artículo',
      'name',
      'nombre',
      'material',
      'item',
      'servicio',
    ]),
  ].filter(Boolean);

  const item_code = pickString(r, [
    'item_code',
    'itemCode',
    'codigo',
    'código',
    'code',
    'sku',
    'referencia',
    'ref',
    'cod',
  ]);

  let description = descParts.join(' ').trim();
  if (!description && item_code) description = item_code;
  if (!description) return null;

  const unit =
    pickString(r, ['unit', 'unidad', 'um', 'uom', 'medida']) || 'UND';

  const quantity =
    Math.max(
      0,
      toNumber(
        r.quantity ?? r.cantidad ?? r.cant ?? r.qty ?? r.unidades ?? r.unidad ?? r.uds,
        1
      )
    ) || 1;

  let unitPrice = toNumber(
    r.unit_price ??
      r.unitPrice ??
      r.precio_unitario ??
      r.precioUnitario ??
      r.precio ??
      r.p_unitario ??
      r.p_unit ??
      r.pu,
    -1
  );

  if (unitPrice < 0) {
    const subtotal = toNumber(
      r.subtotal ?? r.monto ?? r.importe ?? r.total_linea ?? r.total ?? r.line_total,
      -1
    );
    unitPrice = subtotal >= 0 && quantity > 0 ? subtotal / quantity : 0;
  }

  return {
    description,
    item_code,
    unit: unit.toUpperCase().slice(0, 12) || 'UND',
    quantity,
    unit_price: Math.max(0, unitPrice),
  };
}

export function parseExtractedPurchaseInvoice(text: string): ExtractedPurchaseInvoice {
  let parsed: Record<string, unknown>;
  try {
    const cleaned = text
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();
    const jsonStart = cleaned.indexOf('{');
    const jsonEnd = cleaned.lastIndexOf('}');
    const slice =
      jsonStart >= 0 && jsonEnd > jsonStart ? cleaned.slice(jsonStart, jsonEnd + 1) : cleaned;
    parsed = JSON.parse(slice) as Record<string, unknown>;
  } catch {
    throw new Error('La IA devolvió un formato no válido. Intente con otra imagen o PDF más legible.');
  }

  const flat = flattenInvoicePayload(parsed);
  const fromRoot = collectInvoiceItemRows(parsed);
  const rawItems = fromRoot.length > 0 ? fromRoot : collectInvoiceItemRows(flat);

  const items: ExtractedInvoiceItem[] = rawItems
    .map(parseRowToItem)
    .filter((x): x is ExtractedInvoiceItem => x !== null);

  const invoice_number = pickString(flat, [
    'invoice_number',
    'invoiceNumber',
    'numero_factura',
    'número_factura',
    'numeroFactura',
    'nro_factura',
    'n_factura',
    'factura',
    'factura_numero',
    'numero_documento',
    'numero_control',
    'nro_control',
    'control_fiscal',
    'numero',
    'number',
  ]);

  const supplier_rif = pickString(flat, [
    'supplier_rif',
    'supplierRif',
    'rif',
    'rif_proveedor',
    'rif_emisor',
    'documento',
    'nit',
  ]);

  const supplier_name = pickString(flat, [
    'supplier_name',
    'supplierName',
    'proveedor',
    'nombre_proveedor',
    'razon_social',
    'razón_social',
    'razonSocial',
    'nombre_comercial',
    'emisor',
    'vendedor',
    'empresa',
    'nombre',
  ]);

  const dateRaw =
    flat.date ?? flat.fecha ?? flat.fecha_emision ?? flat.issue_date ?? flat.fechaEmision;

  const totalRaw =
    flat.total_amount ??
    flat.totalAmount ??
    flat.total ??
    flat.monto_total ??
    flat.gran_total ??
    flat.importe_total;

  return {
    invoice_number,
    supplier_rif,
    supplier_name,
    date: normalizeDate(dateRaw),
    total_amount:
      totalRaw != null && totalRaw !== '' ? toNumber(totalRaw, 0) : null,
    items,
  };
}

export async function extractPurchaseInvoiceFromFile(file: {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
}): Promise<{ data: ExtractedPurchaseInvoice; fromGemini: boolean; modelUsed: string }> {
  if (file.buffer.length > MAX_BYTES) {
    throw new Error('El archivo supera el límite de 12 MB.');
  }

  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) {
    throw new Error(
      'GEMINI_API_KEY no está configurada. Añádala en .env.local para usar el modo IA.'
    );
  }

  const base64 = file.buffer.toString('base64');
  const models = procurementModelCandidates();
  let text = '';
  let modelUsed = '';
  let lastError: Error | null = null;

  for (const model of models) {
    try {
      text = await callGeminiExtract(key, model, file.mimeType, base64);
      modelUsed = model;
      console.info('[extractPurchaseInvoiceGemini] OK con modelo', model);
      break;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const retryable = (err as { retryable?: boolean }).retryable === true;
      if (!retryable) break;
    }
  }

  if (!text) {
    throw (
      lastError ??
      new Error(
        `No se pudo conectar con Gemini. Pruebe GEMINI_PROCUREMENT_MODEL=${GEMINI_PROCUREMENT_DEFAULT_MODEL}.`
      )
    );
  }

  let extracted = parseExtractedPurchaseInvoice(text);

  if (extracted.items.length === 0) {
    console.info('[extractPurchaseInvoiceGemini] Sin ítems en 1.er pase; reintento solo detalle…');
    try {
      const itemsText = await callGeminiExtract(
        modelUsed || models[0],
        file.mimeType,
        base64,
        ITEMS_ONLY_PROMPT,
        ITEMS_ONLY_SCHEMA,
      );
      const itemsPass = parseExtractedPurchaseInvoice(itemsText);
      if (itemsPass.items.length > 0) {
        extracted = { ...extracted, items: itemsPass.items };
      }
    } catch (itemsErr) {
      console.warn('[extractPurchaseInvoiceGemini] 2.º pase ítems falló:', itemsErr);
    }
  }

  if (
    !extracted.invoice_number &&
    !extracted.supplier_name &&
    extracted.items.length === 0
  ) {
    console.warn('[extractPurchaseInvoiceGemini] respuesta vacía, raw:', text.slice(0, 500));
    throw new Error(
      'No se pudieron leer datos del documento. Use una foto más nítida o un PDF con texto seleccionable.'
    );
  }

  return { data: extracted, fromGemini: true, modelUsed };
}

async function callGeminiExtract(
  model: string,
  mimeType: string,
  base64: string,
  prompt: string = EXTRACTION_PROMPT,
  schema: object = RESPONSE_SCHEMA,
): Promise<string> {
  try {
    return await geminiGenerateWithDocument({
      model,
      prompt,
      mimeType,
      base64,
      systemInstruction:
        'Eres un OCR experto en facturas fiscales venezolanas. Extraes cada fila de la tabla de detalle sin omitir productos.',
      temperature: 0,
      maxOutputTokens: 16384,
      responseSchema: schema,
    });
  } catch (err) {
    const retryable = (err as { retryable?: boolean }).retryable === true;
    const status = (err as { status?: number }).status;
    console.error('[extractPurchaseInvoiceGemini]', model, status, err);
    throw Object.assign(err instanceof Error ? err : new Error(String(err)), {
      retryable,
      status,
    });
  }
}
