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
  'SI',
  'NO',
  'OK',
  'YES',
  'EMG-SI',
  'EMG-NO',
  'NE-SI',
  'NE-NO',
  'ING-SI',
  'ING-NO',
]);

/** «Sí», «no hay», etc. que el bot tomaba como Nº de documento (EMG-Si / NE-Si). */
const RESPUESTAS_SI_NO = new Set([
  'SI',
  'NO',
  'OK',
  'YES',
  'SINO',
  'NOPE',
  'NOP',
  'NOHAY',
  'NOTIENE',
  'NINGUNO',
  'NINGUNA',
  'SINNUMERO',
  'SINNRO',
  'SINN',
  'NA',
]);

function sinAcentosUpper(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

export function normalizarNumeroDocumentoRecepcion(numDoc: string | null | undefined): string {
  return sinAcentosUpper(String(numDoc ?? ''))
    .trim()
    .replace(/^#+/, '')
    .replace(/\s+/g, '');
}

/**
 * «Si», «Sí», «No» y similares no son un número de factura.
 * Evita EMG-Si / NE-Si / duplicados al reutilizar compras provisionales.
 */
export function esRespuestaSiNoComoDocumento(numDoc: string | null | undefined): boolean {
  const compacto = normalizarNumeroDocumentoRecepcion(numDoc).replace(/[^A-Z0-9]/g, '');
  if (!compacto) return false;
  if (RESPUESTAS_SI_NO.has(compacto)) return true;
  if (/^(NE|EMG|ING)(SI|NO)$/.test(compacto)) return true;
  return false;
}

/** S/N, NE-S/N, NOTA-ENTREGA, Si/No, vacío y equivalentes. */
export function esNumeroDocumentoPlaceholder(numDoc: string | null | undefined): boolean {
  const n = normalizarNumeroDocumentoRecepcion(numDoc);
  if (!n) return true;
  if (PLACEHOLDERS.has(n)) return true;
  if (/^(NE|EMG|ING)[-_]?S\/?N$/.test(n)) return true;
  if (/^(NE[-_]?)?NOTA[-_]?ENTREGA$/.test(n)) return true;
  if (esRespuestaSiNoComoDocumento(numDoc)) return true;
  return false;
}

/**
 * Devuelve el número usable o null si es placeholder / «Si» / «No».
 * El caller decide el fallback (S/N en el wizard; ING-YYYYMMDD-id en formato fijo).
 */
export function sanitizarNumeroDocumentoMovimiento(
  numDoc: string | null | undefined,
): string | null {
  const raw = String(numDoc ?? '').trim();
  if (!raw) return null;
  if (esNumeroDocumentoPlaceholder(raw)) return null;
  return raw;
}

export function numeroDocumentoContabilidad(
  tipo: 'factura_canal' | 'nota_entrega' | 'emergencia',
  numDoc: string,
): string {
  const doc = sanitizarNumeroDocumentoMovimiento(numDoc) ?? 'S/N';
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
