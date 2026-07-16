/**
 * Edge Function: check-document-expiry
 *
 * Consulta la vista `documentos_por_vencer` y envía correos (Resend) a RRHH
 * cuando un documento vence en exactamente 30, 15 o 5 días (zona America/Caracas).
 *
 * Secretos / env en Supabase → Project Settings → Edge Functions → Secrets:
 *   SUPABASE_URL              (a veces ya inyectado)
 *   SUPABASE_SERVICE_ROLE_KEY (requerido)
 *   RESEND_API_KEY            (requerido para envío real)
 *   RESEND_FROM               (opcional, ej. "Casa Inteligente <docs@tudominio.com>")
 *   RRHH_ALERT_EMAIL          (opcional, por defecto rrhh@casainteligente.com)
 *
 * Programación: Supabase Dashboard → Edge Functions → Schedules, o cron externo:
 *   curl -i --request POST "https://<ref>.supabase.co/functions/v1/check-document-expiry" \
 *     --header "Authorization: Bearer <anon o service>"
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const RRHH_DEFAULT = 'rrhh@casainteligente.com';
const ALERT_DAYS = [30, 15, 5] as const;

type DocumentoPorVencer = {
  documento_id: string;
  persona_id: string;
  proyecto_id: string | null;
  nombre_obrero: string;
  proyecto_nombre: string;
  document_type: string;
  fecha_vencimiento: string;
  dias_hasta_vencimiento: number;
};

function todayCaracasYmd(): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Caracas',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildEmailHtml(row: DocumentoPorVencer): string {
  const v = String(row.fecha_vencimiento);
  return `
    <p><strong>Obrero:</strong> ${escapeHtml(row.nombre_obrero)}</p>
    <p><strong>Proyecto:</strong> ${escapeHtml(row.proyecto_nombre)}</p>
    <p><strong>Tipo de documento:</strong> ${escapeHtml(row.document_type)}</p>
    <p><strong>Fecha de vencimiento:</strong> ${escapeHtml(v)}</p>
    <p><strong>Días restantes (Caracas):</strong> ${row.dias_hasta_vencimiento}</p>
  `.trim();
}

Deno.serve(async (req) => {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const resendKey = Deno.env.get('RESEND_API_KEY') ?? '';
  const resendFrom = Deno.env.get('RESEND_FROM') ?? 'Casa Inteligente <onboarding@resend.dev>';
  const rrhhTo = Deno.env.get('RRHH_ALERT_EMAIL') ?? RRHH_DEFAULT;

  if (!supabaseUrl || !serviceKey) {
    return new Response(
      JSON.stringify({ ok: false, error: 'Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }

  if (!resendKey) {
    return new Response(
      JSON.stringify({
        ok: false,
        error:
          'Falta RESEND_API_KEY. En Supabase → Edge Functions → Secrets añade RESEND_API_KEY (y opcional RESEND_FROM, RRHH_ALERT_EMAIL).',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: rows, error: qErr } = await supabase
    .from('documentos_por_vencer')
    .select(
      'documento_id, persona_id, proyecto_id, nombre_obrero, proyecto_nombre, document_type, fecha_vencimiento, dias_hasta_vencimiento',
    )
    .in('dias_hasta_vencimiento', [...ALERT_DAYS]);

  if (qErr) {
    return new Response(JSON.stringify({ ok: false, error: qErr.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const list = (rows ?? []) as DocumentoPorVencer[];
  const sentOn = todayCaracasYmd();
  const results: { documento_id: string; dias: number; status: string }[] = [];

  for (const row of list) {
    const dias = row.dias_hasta_vencimiento;
    if (!ALERT_DAYS.includes(dias as 30 | 15 | 5)) continue;

    const { data: already } = await supabase
      .from('notification_logs')
      .select('id')
      .eq('notification_type', 'check_document_expiry')
      .eq('documento_id', row.documento_id)
      .eq('alert_days', dias)
      .eq('sent_on', sentOn)
      .maybeSingle();

    if (already?.id) {
      results.push({ documento_id: row.documento_id, dias, status: 'skipped_duplicate' });
      continue;
    }

    const subject = `⚠️ ALERTA: Vencimiento de ${row.document_type} - ${row.nombre_obrero}`;
    const html = buildEmailHtml(row);

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: resendFrom,
        to: [rrhhTo],
        subject,
        html,
      }),
    });

    const resendJson = (await resendRes.json().catch(() => ({}))) as Record<string, unknown>;

    if (!resendRes.ok) {
      results.push({
        documento_id: row.documento_id,
        dias,
        status: `resend_error:${resendRes.status}:${JSON.stringify(resendJson).slice(0, 400)}`,
      });
      continue;
    }

    const plainBody =
      `Obrero: ${row.nombre_obrero}\n` +
      `Proyecto: ${row.proyecto_nombre}\n` +
      `Tipo: ${row.document_type}\n` +
      `Vencimiento: ${row.fecha_vencimiento}\n` +
      `Días restantes: ${row.dias_hasta_vencimiento}`;

    const { error: logErr } = await supabase.from('notification_logs').insert({
      notification_type: 'check_document_expiry',
      documento_id: row.documento_id,
      alert_days: dias,
      sent_on: sentOn,
      recipient: rrhhTo,
      subject,
      body: plainBody,
    });

    if (logErr) {
      results.push({ documento_id: row.documento_id, dias, status: `log_insert_failed:${logErr.message}` });
      continue;
    }

    results.push({ documento_id: row.documento_id, dias, status: 'sent' });
  }

  return new Response(
    JSON.stringify({
      ok: true,
      scanned: list.length,
      sent_on: sentOn,
      recipient: rrhhTo,
      results,
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );
});
