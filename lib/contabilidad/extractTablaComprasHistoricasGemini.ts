import {
  GEMINI_PROCUREMENT_DEFAULT_MODEL,
  procurementModelCandidates,
} from '@/lib/almacen/geminiProcurementModels';
import { geminiGenerateWithDocument } from '@/lib/gemini/client';

export type FilaTablaCompraHistorica = {
  invoice_number: string;
  supplier_name: string;
  supplier_rif: string;
  date: string;
  descripcion: string;
  item_code: string;
  unidad: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  moneda: 'VES' | 'USD';
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

const PROMPT = `Este documento NO es una factura individual: es una TABLA o cuadro
con datos YA extraídos de varias facturas (historial de compras).

Extrae TODAS las filas de datos de la tabla (ignora títulos, totales generales,
firmas y notas al pie).

Cada fila de la tabla → un objeto en filas[] con:
- invoice_number: número de factura / control ("" si no hay en esa fila)
- supplier_name: proveedor / razón social
- supplier_rif: RIF del proveedor ("" si no aparece)
- date: fecha YYYY-MM-DD (si viene DD/MM/YYYY o DD-MM-YYYY, conviértela)
- descripcion: artículo, concepto o descripción de la línea
- item_code: código/SKU si hay ("" si no)
- unidad: UND, KG, M, etc. ("UND" si no aparece)
- cantidad: número (≥ 0)
- precio_unitario: precio unitario en la moneda de la fila
- subtotal: total de la línea; si no hay, cantidad × precio_unitario
- moneda: "VES" si está en bolívares / Bs, "USD" si está en dólares. Si no se indica, usa "VES".

Si una fila es un resumen de factura sin desglose de artículos, pon la
descripción como "Compra factura {invoice_number}" y usa el total como
subtotal (cantidad 1, precio_unitario = total).

NO inventes filas. NO omitas filas visibles. NO trates esto como una sola factura.`;

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    filas: {
      type: 'array',
      description: 'Todas las filas de la tabla de compras históricas',
      items: {
        type: 'object',
        properties: {
          invoice_number: { type: 'string' },
          supplier_name: { type: 'string' },
          supplier_rif: { type: 'string' },
          date: { type: 'string' },
          descripcion: { type: 'string' },
          item_code: { type: 'string' },
          unidad: { type: 'string' },
          cantidad: { type: 'number' },
          precio_unitario: { type: 'number' },
          subtotal: { type: 'number' },
          moneda: { type: 'string', description: 'VES o USD' },
        },
        required: [
          'invoice_number',
          'supplier_name',
          'supplier_rif',
          'date',
          'descripcion',
          'item_code',
          'unidad',
          'cantidad',
          'precio_unitario',
          'subtotal',
          'moneda',
        ],
      },
    },
  },
  required: ['filas'],
};

function pickString(obj: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  }
  return '';
}

function pickNumber(obj: Record<string, unknown>, keys: string[]): number {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string') {
      const n = Number(v.trim().replace(/\s/g, '').replace(',', '.'));
      if (Number.isFinite(n)) return n;
    }
  }
  return 0;
}

function normalizarFecha(raw: string): string {
  const s = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (m) {
    const d = m[1]!.padStart(2, '0');
    const mo = m[2]!.padStart(2, '0');
    let y = m[3]!;
    if (y.length === 2) y = Number(y) > 50 ? `19${y}` : `20${y}`;
    return `${y}-${mo}-${d}`;
  }
  return s.slice(0, 10);
}

function normalizarMoneda(raw: string): 'VES' | 'USD' {
  const u = raw.trim().toUpperCase();
  if (u === 'USD' || u === 'DOLAR' || u === 'DÓLAR' || u === '$') return 'USD';
  return 'VES';
}

export function parseFilasTablaCompraHistorica(text: string): FilaTablaCompraHistorica[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start >= 0 && end > start) {
      parsed = JSON.parse(text.slice(start, end + 1));
    } else {
      throw new Error('La IA no devolvió JSON válido para la tabla.');
    }
  }

  const root = parsed as Record<string, unknown>;
  const rawList = (root.filas ?? root.rows ?? root.items ?? root.lineas) as unknown;
  if (!Array.isArray(rawList)) return [];

  return rawList
    .map((row): FilaTablaCompraHistorica | null => {
      if (!row || typeof row !== 'object') return null;
      const o = row as Record<string, unknown>;
      const cantidad = pickNumber(o, ['cantidad', 'quantity', 'qty']);
      const precio = pickNumber(o, ['precio_unitario', 'unit_price', 'precio', 'pu']);
      let subtotal = pickNumber(o, ['subtotal', 'total', 'monto', 'importe']);
      if (!(subtotal > 0) && cantidad > 0 && precio >= 0) {
        subtotal = Math.round(cantidad * precio * 100) / 100;
      }
      const descripcion = pickString(o, ['descripcion', 'description', 'articulo', 'concepto', 'producto']);
      const invoice = pickString(o, ['invoice_number', 'factura', 'nro_factura', 'numero']);
      if (!descripcion && !invoice && !(subtotal > 0)) return null;
      return {
        invoice_number: invoice,
        supplier_name: pickString(o, ['supplier_name', 'proveedor', 'razon_social']),
        supplier_rif: pickString(o, ['supplier_rif', 'rif']),
        date: normalizarFecha(pickString(o, ['date', 'fecha'])),
        descripcion: descripcion || (invoice ? `Compra factura ${invoice}` : 'Ítem'),
        item_code: pickString(o, ['item_code', 'codigo', 'sku']),
        unidad: pickString(o, ['unidad', 'unit']) || 'UND',
        cantidad: cantidad > 0 ? cantidad : 1,
        precio_unitario: precio > 0 ? precio : subtotal > 0 ? subtotal : 0,
        subtotal: subtotal > 0 ? subtotal : 0,
        moneda: normalizarMoneda(pickString(o, ['moneda', 'currency', 'divisa'])),
      };
    })
    .filter((x): x is FilaTablaCompraHistorica => x != null);
}

export async function extractTablaComprasHistoricasFromFile(file: {
  buffer: Buffer;
  mimeType: string;
  fileName?: string;
}): Promise<{ filas: FilaTablaCompraHistorica[]; modelUsed: string }> {
  if (!ALLOWED_MIME.has(file.mimeType) && !file.mimeType.startsWith('image/')) {
    throw new Error('Formato no soportado. Use PDF o imagen de la tabla.');
  }
  if (file.buffer.byteLength > MAX_BYTES) {
    throw new Error('El archivo supera el límite de 12 MB.');
  }

  const base64 = file.buffer.toString('base64');
  const models = procurementModelCandidates();
  let text = '';
  let modelUsed = '';
  let lastError: Error | null = null;

  for (const model of models) {
    try {
      text = await geminiGenerateWithDocument({
        model,
        prompt: PROMPT,
        mimeType: file.mimeType,
        base64,
        systemInstruction:
          'Eres un extractor de tablas de compras históricas. Solo JSON válido según el schema.',
        temperature: 0.1,
        maxOutputTokens: 8192,
        responseSchema: RESPONSE_SCHEMA,
      });
      modelUsed = model;
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
        `No se pudo leer la tabla con Gemini. Pruebe GEMINI_PROCUREMENT_MODEL=${GEMINI_PROCUREMENT_DEFAULT_MODEL}.`,
      )
    );
  }

  const filas = parseFilasTablaCompraHistorica(text);
  if (filas.length === 0) {
    throw new Error(
      'No se detectaron filas en la tabla. Verifique que el PDF muestre el cuadro de compras con columnas legibles.',
    );
  }

  return { filas, modelUsed };
}

export function mimeFromTablaFile(file: File): string | null {
  const t = (file.type || '').toLowerCase();
  if (ALLOWED_MIME.has(t) || t.startsWith('image/')) return t || 'application/octet-stream';
  if (file.name.toLowerCase().endsWith('.pdf')) return 'application/pdf';
  return null;
}
