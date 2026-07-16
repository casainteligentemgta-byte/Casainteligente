/**
 * Empareja fotos/PDF de facturas individuales con filas del cuadro histórico
 * usando Gemini Vision (nº factura, RIF, proveedor, fecha, total).
 */

import { procurementModelCandidates } from '@/lib/almacen/geminiProcurementModels';
import { geminiGenerateWithDocument } from '@/lib/gemini/client';

export type FacturaCandidataEmpareje = {
  key: string;
  invoice_number: string;
  supplier_name: string;
  supplier_rif: string;
  fecha: string;
  total: number;
  moneda: string;
  lineas: number;
};

export type FotoEmparejarInput = {
  id: string;
  buffer: Buffer;
  mimeType: string;
  fileName?: string;
};

export type MatchFotoFactura = {
  fotoId: string;
  grupoKey: string | null;
  confianza: number;
  invoice_number_leido: string;
  supplier_name_leido: string;
  supplier_rif_leido: string;
  motivo: string;
  error?: string;
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

const MAX_BYTES = 8 * 1024 * 1024;
/** Evita timeout Vercel: procesar en lotes pequeños en el cliente si hay más. */
export const MAX_FOTOS_POR_REQUEST = 12;

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    grupo_key: {
      type: 'string',
      description: 'key exacta de la factura del cuadro que corresponde, o "" si ninguna',
    },
    confianza: {
      type: 'number',
      description: '0 a 100',
    },
    invoice_number_leido: { type: 'string' },
    supplier_name_leido: { type: 'string' },
    supplier_rif_leido: { type: 'string' },
    motivo: {
      type: 'string',
      description: 'Breve razón del emparejamiento (español)',
    },
  },
  required: [
    'grupo_key',
    'confianza',
    'invoice_number_leido',
    'supplier_name_leido',
    'supplier_rif_leido',
    'motivo',
  ],
};

function normToken(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

function scoreLocal(
  leido: {
    invoice_number: string;
    supplier_rif: string;
    supplier_name: string;
  },
  c: FacturaCandidataEmpareje,
): number {
  let score = 0;
  const invL = normToken(leido.invoice_number);
  const invC = normToken(c.invoice_number);
  if (invL && invC) {
    if (invL === invC) score += 70;
    else if (invL.includes(invC) || invC.includes(invL)) score += 45;
  }
  const rifL = normToken(leido.supplier_rif);
  const rifC = normToken(c.supplier_rif);
  if (rifL && rifC) {
    if (rifL === rifC) score += 25;
    else if (rifL.includes(rifC) || rifC.includes(rifL)) score += 12;
  }
  const nomL = normToken(leido.supplier_name);
  const nomC = normToken(c.supplier_name);
  if (nomL && nomC && (nomL.includes(nomC.slice(0, 6)) || nomC.includes(nomL.slice(0, 6)))) {
    score += 10;
  }
  return Math.min(100, score);
}

function parseJsonMatch(raw: string): {
  grupo_key: string;
  confianza: number;
  invoice_number_leido: string;
  supplier_name_leido: string;
  supplier_rif_leido: string;
  motivo: string;
} {
  const t = raw.trim();
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(t) as Record<string, unknown>;
  } catch {
    const start = t.indexOf('{');
    const end = t.lastIndexOf('}');
    if (start < 0 || end <= start) {
      throw new Error('La IA no devolvió JSON de emparejamiento.');
    }
    parsed = JSON.parse(t.slice(start, end + 1)) as Record<string, unknown>;
  }
  const confRaw = Number(parsed.confianza ?? 0);
  return {
    grupo_key: String(parsed.grupo_key ?? '').trim(),
    confianza: Number.isFinite(confRaw) ? Math.max(0, Math.min(100, confRaw)) : 0,
    invoice_number_leido: String(parsed.invoice_number_leido ?? '').trim(),
    supplier_name_leido: String(parsed.supplier_name_leido ?? '').trim(),
    supplier_rif_leido: String(parsed.supplier_rif_leido ?? '').trim(),
    motivo: String(parsed.motivo ?? '').trim() || 'Sin motivo',
  };
}

function buildPrompt(candidatas: FacturaCandidataEmpareje[]): string {
  const lista = candidatas.map((c) => ({
    key: c.key,
    invoice_number: c.invoice_number,
    supplier_name: c.supplier_name,
    supplier_rif: c.supplier_rif,
    fecha: c.fecha,
    total: c.total,
    moneda: c.moneda,
    lineas: c.lineas,
  }));
  return `Esta imagen es UNA factura individual (foto o página).

Debes emparejarla con UNA entrada del cuadro histórico de compras (JSON abajo).

REGLAS:
1. Lee nº de factura/control, RIF y nombre del EMISOR (proveedor), fecha y total.
2. Elige la entrada cuyo invoice_number / RIF / proveedor mejor coincidan.
3. Devuelve grupo_key EXACTAMENTE igual a "key" de esa entrada.
4. Si ninguna coincide con confianza razonable, grupo_key = "" y confianza baja.
5. No inventes keys. No elijas a ciegas.

CUADRO HISTÓRICO (candidatas):
${JSON.stringify(lista)}`;
}

async function emparejarUnaFoto(
  foto: FotoEmparejarInput,
  candidatas: FacturaCandidataEmpareje[],
): Promise<MatchFotoFactura> {
  if (!ALLOWED_MIME.has(foto.mimeType) && !foto.mimeType.startsWith('image/')) {
    return {
      fotoId: foto.id,
      grupoKey: null,
      confianza: 0,
      invoice_number_leido: '',
      supplier_name_leido: '',
      supplier_rif_leido: '',
      motivo: 'Formato no soportado',
      error: 'Use JPG, PNG, WEBP o PDF',
    };
  }
  if (foto.buffer.byteLength > MAX_BYTES) {
    return {
      fotoId: foto.id,
      grupoKey: null,
      confianza: 0,
      invoice_number_leido: '',
      supplier_name_leido: '',
      supplier_rif_leido: '',
      motivo: 'Archivo demasiado grande',
      error: 'Máximo 8 MB por foto',
    };
  }

  const keysValidas = new Set(candidatas.map((c) => c.key));
  const models = procurementModelCandidates().slice(0, 2);
  let lastError: Error | null = null;

  for (const model of models) {
    try {
      const text = await geminiGenerateWithDocument({
        model,
        prompt: buildPrompt(candidatas),
        mimeType: foto.mimeType,
        base64: foto.buffer.toString('base64'),
        systemInstruction:
          'Eres un conciliador de facturas. Responde SOLO JSON con grupo_key, confianza, campos leídos y motivo.',
        temperature: 0.1,
        maxOutputTokens: 1024,
        responseSchema: RESPONSE_SCHEMA,
      });
      const parsed = parseJsonMatch(text);
      let grupoKey =
        parsed.grupo_key && keysValidas.has(parsed.grupo_key) ? parsed.grupo_key : null;
      let confianza = parsed.confianza;

      // Refuerzo local si Gemini devolvió key inválida pero sí leyó datos
      if (!grupoKey && (parsed.invoice_number_leido || parsed.supplier_rif_leido)) {
        let best: FacturaCandidataEmpareje | null = null;
        let bestScore = 0;
        for (const c of candidatas) {
          const s = scoreLocal(
            {
              invoice_number: parsed.invoice_number_leido,
              supplier_rif: parsed.supplier_rif_leido,
              supplier_name: parsed.supplier_name_leido,
            },
            c,
          );
          if (s > bestScore) {
            bestScore = s;
            best = c;
          }
        }
        if (best && bestScore >= 45) {
          grupoKey = best.key;
          confianza = Math.max(confianza, bestScore);
        }
      }

      return {
        fotoId: foto.id,
        grupoKey,
        confianza,
        invoice_number_leido: parsed.invoice_number_leido,
        supplier_name_leido: parsed.supplier_name_leido,
        supplier_rif_leido: parsed.supplier_rif_leido,
        motivo: parsed.motivo,
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn('[emparejarFotosFacturas]', model, lastError.message);
    }
  }

  return {
    fotoId: foto.id,
    grupoKey: null,
    confianza: 0,
    invoice_number_leido: '',
    supplier_name_leido: '',
    supplier_rif_leido: '',
    motivo: 'No se pudo analizar la foto',
    error: lastError?.message?.slice(0, 200) || 'Error Gemini',
  };
}

/**
 * Empareja varias fotos contra el mismo set de candidatas.
 * Concurrencia limitada para no saturar cuota Gemini.
 */
export async function emparejarFotosConFacturas(params: {
  facturas: FacturaCandidataEmpareje[];
  fotos: FotoEmparejarInput[];
  concurrency?: number;
}): Promise<{ matches: MatchFotoFactura[]; modelHint: string }> {
  const { facturas, fotos } = params;
  if (facturas.length === 0) {
    throw new Error('No hay facturas del cuadro para emparejar.');
  }
  if (fotos.length === 0) {
    throw new Error('Envíe al menos una foto de factura.');
  }
  if (fotos.length > MAX_FOTOS_POR_REQUEST) {
    throw new Error(
      `Máximo ${MAX_FOTOS_POR_REQUEST} fotos por intento. Empareje por lotes.`,
    );
  }

  const concurrency = Math.max(1, Math.min(params.concurrency ?? 2, 3));
  const matches: MatchFotoFactura[] = [];
  let i = 0;

  async function worker() {
    while (i < fotos.length) {
      const idx = i++;
      const foto = fotos[idx]!;
      matches[idx] = await emparejarUnaFoto(foto, facturas);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, fotos.length) }, () => worker()));

  // Resolver colisiones: una factura ← foto con mayor confianza
  const porGrupo = new Map<string, MatchFotoFactura>();
  for (const m of matches) {
    if (!m.grupoKey) continue;
    const prev = porGrupo.get(m.grupoKey);
    if (!prev || m.confianza > prev.confianza) {
      porGrupo.set(m.grupoKey, m);
    }
  }
  const ganadores = new Set(
    Array.from(porGrupo.values()).map((m) => `${m.fotoId}::${m.grupoKey}`),
  );
  const resueltos = matches.map((m) => {
    if (!m.grupoKey) return m;
    if (ganadores.has(`${m.fotoId}::${m.grupoKey}`)) return m;
    return {
      ...m,
      grupoKey: null,
      motivo: `${m.motivo} · Descartada: otra foto encaja mejor con esa factura`,
      confianza: Math.min(m.confianza, 40),
    };
  });

  return {
    matches: resueltos,
    modelHint: procurementModelCandidates()[0] ?? 'gemini',
  };
}

export function mimeFromFotoFactura(file: File): string | null {
  const t = (file.type || '').toLowerCase();
  if (ALLOWED_MIME.has(t) || t.startsWith('image/')) return t || 'application/octet-stream';
  if (file.name.toLowerCase().endsWith('.pdf')) return 'application/pdf';
  return null;
}
