import type {
  MetronAnalisisResultado,
  MetronComputoLinea,
  MetronDisciplina,
} from '@/types/metron';

const DISCIPLINAS = new Set<MetronDisciplina>([
  'arq',
  'est',
  'ele',
  'san',
  'red',
  'cctv',
  'mixta',
  'desconocida',
]);

function asDisciplina(raw: unknown, fallback: MetronDisciplina = 'desconocida'): MetronDisciplina {
  const s = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/^arquitectura$/, 'arq')
    .replace(/^estructura$/, 'est')
    .replace(/^electrico$|^eléctrico$/, 'ele')
    .replace(/^sanitario$|^sanitarios$/, 'san')
    .replace(/^redes?$|^datos$/, 'red')
    .replace(/^videovigilancia$/, 'cctv');
  return DISCIPLINAS.has(s as MetronDisciplina) ? (s as MetronDisciplina) : fallback;
}

function asNumber(raw: unknown, fallback = 0): number {
  const n = typeof raw === 'number' ? raw : Number(String(raw ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : fallback;
}

function asString(raw: unknown): string {
  return String(raw ?? '').trim();
}

function asStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => asString(x)).filter(Boolean);
}

function parseComputo(raw: unknown, idx: number): MetronComputoLinea | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const descripcion = asString(o.descripcion);
  if (!descripcion) return null;

  const cantidad = Math.max(0, asNumber(o.cantidad));
  let precio = Math.max(0, asNumber(o.precio_unitario_estimado));
  let monto = Math.max(0, asNumber(o.monto_estimado));
  if (monto <= 0 && cantidad > 0 && precio > 0) {
    monto = Math.round(cantidad * precio * 100) / 100;
  } else if (precio <= 0 && monto > 0 && cantidad > 0) {
    precio = Math.round((monto / cantidad) * 10000) / 10000;
  }

  let confianza = asNumber(o.confianza, 50);
  if (confianza > 0 && confianza <= 1) confianza *= 100;
  confianza = Math.min(100, Math.max(0, confianza));

  return {
    codigo_sugerido: asString(o.codigo_sugerido) || `MTR-${String(idx + 1).padStart(3, '0')}`,
    descripcion,
    unidad: asString(o.unidad).toUpperCase() || 'UND',
    cantidad,
    precio_unitario_estimado: precio,
    monto_estimado: monto,
    capitulo_sugerido: asString(o.capitulo_sugerido) || 'General',
    supuesto: asString(o.supuesto),
    confianza,
    disciplina: asDisciplina(o.disciplina, 'arq'),
  };
}

/** Extrae JSON de texto Gemini (puede venir con fences). */
export function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('Respuesta vacía de Metron.');

  try {
    return JSON.parse(trimmed);
  } catch {
    /* continue */
  }

  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) {
    return JSON.parse(fence[1].trim());
  }

  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) {
    return JSON.parse(trimmed.slice(start, end + 1));
  }

  throw new Error('No se pudo parsear el JSON de Metron.');
}

export function parseRespuestaMetron(rawText: string): MetronAnalisisResultado {
  const data = extractJsonObject(rawText);
  if (!data || typeof data !== 'object') {
    throw new Error('JSON de Metron inválido.');
  }
  const o = data as Record<string, unknown>;

  const computosRaw = Array.isArray(o.computos) ? o.computos : [];
  const computos = computosRaw
    .map((c, i) => parseComputo(c, i))
    .filter((c): c is MetronComputoLinea => c != null);

  const especialidades = (Array.isArray(o.especialidades) ? o.especialidades : [])
    .map((x) => asDisciplina(x))
    .filter((d, i, arr) => arr.indexOf(d) === i);

  const disciplina = asDisciplina(o.disciplina, especialidades[0] ?? 'desconocida');

  return {
    disciplina,
    especialidades: especialidades.length ? especialidades : disciplina !== 'desconocida' ? [disciplina] : [],
    titulo_plano: asString(o.titulo_plano),
    escala_detectada: asString(o.escala_detectada),
    resumen: asString(o.resumen) || 'Sin resumen.',
    supuestos: asStringArray(o.supuestos),
    alertas: asStringArray(o.alertas),
    computos,
  };
}
