/**
 * Números de documento de recepción / nota de entrega.
 * Los placeholders no identifican un papel real: no se reutiliza compra provisional.
 */

const PLACEHOLDERS = new Set([
  '',
  'S/N',
  'SN',
  'S-N',
  'NE-S/N',
  'NE-SN',
  'NE-S-N',
  'NOTA-ENTREGA',
  'NE-NOTA-ENTREGA',
  'NOTAENTREGA',
  'EMERGENCIA',
  'EMG-S/N',
  'EMG-SN',
  'EMG-S-N',
]);

export function normalizarNumeroDocumentoRecepcion(numDoc: string | null | undefined): string {
  return String(numDoc ?? '')
    .trim()
    .replace(/^#+/, '')
    .toUpperCase()
    .replace(/\s+/g, '');
}

/** S/N, NE-S/N, NOTA-ENTREGA, vacío y equivalentes. */
export function esNumeroDocumentoPlaceholder(numDoc: string | null | undefined): boolean {
  const n = normalizarNumeroDocumentoRecepcion(numDoc);
  if (!n) return true;
  if (PLACEHOLDERS.has(n)) return true;
  if (/^(NE|EMG)[-_]?S\/?N$/.test(n)) return true;
  if (/^(NE[-_]?)?NOTA[-_]?ENTREGA$/.test(n)) return true;
  return false;
}

export function numeroDocumentoContabilidad(
  tipo: 'factura_canal' | 'nota_entrega' | 'emergencia',
  numDoc: string,
): string {
  const doc = numDoc.trim() || 'S/N';
  if (tipo === 'nota_entrega') return doc.toUpperCase().startsWith('NE-') ? doc : `NE-${doc}`;
  if (tipo === 'emergencia') return doc.toUpperCase().startsWith('EMG-') ? doc : `EMG-${doc}`;
  return doc;
}

/**
 * ¿Se puede buscar/reutilizar una compra contable ya creada?
 * Notas de entrega: nunca ignorar proyecto. Placeholders: nunca reutilizar.
 */
export function puedeReutilizarCompraContable(params: {
  tipoRecepcion: 'factura_canal' | 'nota_entrega' | 'emergencia';
  invoiceNumber: string;
}): { buscar: boolean; ignorarProyecto: boolean } {
  if (esNumeroDocumentoPlaceholder(params.invoiceNumber)) {
    return { buscar: false, ignorarProyecto: false };
  }
  if (params.tipoRecepcion === 'nota_entrega' || params.tipoRecepcion === 'emergencia') {
    return { buscar: true, ignorarProyecto: false };
  }
  return { buscar: true, ignorarProyecto: true };
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function esUuid(v: string | null | undefined): boolean {
  return Boolean(v && UUID_RE.test(v.trim()));
}

/** Clave de idempotencia: token de borrador, clave ya guardada, o UUID nuevo. */
export function claveIdempotenciaRecepcionCampo(meta: {
  recepcion_campo_registrada_id?: string | null;
  recepcion_campo_idempotency_key?: string | null;
  recepcion_campo_token?: string | null;
}): { alreadyRegisteredId: string | null; key: string; generated: boolean } {
  const registered = String(meta.recepcion_campo_registrada_id ?? '').trim();
  if (esUuid(registered)) {
    return { alreadyRegisteredId: registered, key: registered, generated: false };
  }
  const existing = String(meta.recepcion_campo_idempotency_key ?? '').trim();
  if (esUuid(existing)) {
    return { alreadyRegisteredId: null, key: existing, generated: false };
  }
  const token = String(meta.recepcion_campo_token ?? '').trim();
  if (esUuid(token)) {
    return { alreadyRegisteredId: null, key: token, generated: false };
  }
  return { alreadyRegisteredId: null, key: crypto.randomUUID(), generated: true };
}
