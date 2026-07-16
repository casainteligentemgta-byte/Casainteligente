import { NextResponse } from 'next/server';
import { evaluarYEnviarParadojaSiCorresponde, type FilaEmpleadoParadoja } from '@/lib/alerts/telegramParadojaCeo';

export const dynamic = 'force-dynamic';

type SupabaseDbWebhookBody = {
  type?: string;
  table?: string;
  schema?: string;
  record?: Record<string, unknown>;
  old_record?: Record<string, unknown> | null;
};

function verifyWebhookAuth(req: Request): boolean {
  const expected = process.env.ALERTS_WEBHOOK_SECRET?.trim();
  if (!expected) {
    console.warn('[telegram-exception] ALERTS_WEBHOOK_SECRET no definido; se rechaza la petición.');
    return false;
  }
  const auth = req.headers.get('authorization')?.trim();
  return auth === `Bearer ${expected}`;
}

function asString(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === 'string') return v;
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return null;
}

function asNumber(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function recordToFila(record: Record<string, unknown>): FilaEmpleadoParadoja {
  const rec = record as Record<string, unknown>;
  const anos = asNumber(rec.anos_experiencia) ?? asNumber(rec['años_experiencia']);
  return {
    id: asString(record.id) ?? '',
    nombre_completo: asString(record.nombre_completo),
    cargo: asString(record.cargo),
    rol_buscado: asString(record.rol_buscado),
    anos_experiencia: anos,
    semaforo_riesgo: asString(record.semaforo_riesgo),
    puntuacion_logica: asNumber(record.puntuacion_logica),
    perfil_color: asString(record.perfil_color),
    motivo_semaforo_riesgo: asString(record.motivo_semaforo_riesgo),
  };
}

/**
 * POST: Webhook (p. ej. Supabase Database Webhook) al completar evaluación obrero.
 * Requiere `Authorization: Bearer ${ALERTS_WEBHOOK_SECRET}`.
 * Cuerpo: payload estándar de Supabase con `record` de `ci_empleados`.
 */
export async function POST(req: Request) {
  if (!verifyWebhookAuth(req)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  let body: SupabaseDbWebhookBody | Record<string, unknown>;
  try {
    body = (await req.json()) as SupabaseDbWebhookBody;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const table = typeof body === 'object' && body && 'table' in body ? (body as SupabaseDbWebhookBody).table : null;
  if (table && table !== 'ci_empleados') {
    return NextResponse.json({ ok: true, skipped: true, reason: 'wrong_table' }, { status: 200 });
  }

  const record =
    typeof body === 'object' && body && 'record' in body && (body as SupabaseDbWebhookBody).record
      ? (body as SupabaseDbWebhookBody).record
      : (body as Record<string, unknown>);

  if (!record || typeof record !== 'object') {
    return NextResponse.json({ error: 'Falta record' }, { status: 400 });
  }

  const estatus =
    asString(record.estatus_evaluacion)?.toLowerCase() ??
    asString(record.status_evaluacion)?.toLowerCase();
  if (estatus !== 'completado') {
    return NextResponse.json({ ok: true, skipped: true, reason: 'estatus_not_completado' }, { status: 200 });
  }

  const fila = recordToFila(record as Record<string, unknown>);
  if (!fila.id) {
    return NextResponse.json({ error: 'record.id requerido' }, { status: 400 });
  }

  const r = await evaluarYEnviarParadojaSiCorresponde(fila);
  if (!r.enviado) {
    if (r.razon === 'no_cumple_regla_paradoja') {
      return NextResponse.json({ ok: true, skipped: true, reason: 'regla_paradoja_no_cumplida' }, { status: 200 });
    }
    return NextResponse.json(
      { ok: false, error: 'No se pudo enviar Telegram', detail: r.razon },
      { status: r.razon.startsWith('telegram_error') ? 502 : 503 },
    );
  }

  return NextResponse.json({ ok: true, sent: true, candidato_id: fila.id }, { status: 200 });
}
