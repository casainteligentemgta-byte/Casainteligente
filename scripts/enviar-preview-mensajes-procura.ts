/**
 * Envía al chat de pruebas los mensajes del flujo procura (Admin, PM, Comprador, etc.)
 * con cabecera «Recibe: …». No notifica a los destinatarios reales.
 *
 * Uso: npx tsx scripts/enviar-preview-mensajes-procura.ts
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { tecladoAprobacionDepartamento } from '../lib/compras/aprobacionDepartamentoTelegram';
import { listarUsuariosOrdenCompraTelegram } from '../lib/compras/usuariosSistemaTelegram';
import {
  cargarProcuraOrdenCompra,
  mensajeOrdenCompraComprador,
} from '../lib/procuras/emitirOrdenCompraProcura';
import {
  construirMensajeAdminViabilidadProcura,
  construirMensajePmDecisionProcura,
  resumenStockDesdeEvaluacion,
  type FilaProcuraMensaje,
} from '../lib/procuras/mensajeAlertaProcuraTelegram';
import { tecladoViabilidadAdmin } from '../lib/procuras/viabilidadAdminProcuraTelegram';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function parseEnvFile(content: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of content.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function enviarPreview(
  token: string,
  chatDestino: string,
  rol: string,
  nombrePersona: string | null,
  cuerpo: string,
  replyMarkup?: object,
): Promise<void> {
  const quien = nombrePersona ? `${rol} · ${escHtml(nombrePersona)}` : rol;
  const text =
    `📬 <b>Recibe: ${quien}</b>\n` +
    `<i>Vista previa — el destinatario real aún no recibe este mensaje</i>\n\n` +
    cuerpo;

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatDestino,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: false,
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    }),
  });

  const json = (await res.json()) as { ok?: boolean; description?: string };
  if (!json.ok) {
    throw new Error(json.description ?? 'Telegram sendMessage failed');
  }
  await new Promise((r) => setTimeout(r, 400));
}

async function main(): Promise<void> {
  const envPath = path.join(root, '.env.local');
  if (!fs.existsSync(envPath)) throw new Error('Falta .env.local');
  const env = parseEnvFile(fs.readFileSync(envPath, 'utf8'));
  const token = env.TELEGRAM_BOT_TOKEN?.trim();
  const chatDestino =
    env.TELEGRAM_PRUEBAS_REDIRECT_CHAT_ID?.trim() ||
    env.TELEGRAM_CHAT_ID?.trim() ||
    '267515133';
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!token) throw new Error('Falta TELEGRAM_BOT_TOKEN');
  if (!url || !key) throw new Error('Faltan credenciales Supabase');

  const sb = createClient(url, key, { auth: { persistSession: false } });

  const { data: procuraRow } = await sb
    .from('ci_procuras')
    .select(
      `id,ticket,estado,solicitante_nombre,material_txt,cantidad,unidad,prioridad,monto_estimado_usd,
       cantidad_despacho,cantidad_compra,stock_almacen_detectado,viabilidad_presupuestaria,viabilidad_informada_por,
       ci_proyectos(nombre),ci_compras_capitulos_maestro(codigo,nombre)`,
    )
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const row = (procuraRow ?? {
    id: '00000000-0000-4000-8000-000000000099',
    ticket: 'PR-2026-00028',
    estado: 'solicitada',
    solicitante_nombre: 'Obrero demo',
    material_txt: 'CEMENTO GRIS',
    cantidad: 50,
    unidad: 'SACO',
    prioridad: 'Media',
    monto_estimado_usd: 120,
    cantidad_despacho: 0,
    cantidad_compra: 50,
    stock_almacen_detectado: 0,
    viabilidad_presupuestaria: 'si',
    viabilidad_informada_por: 'Administrador demo',
    ci_compras_capitulos_maestro: { codigo: '03', nombre: 'Estructura' },
    ci_proyectos: { nombre: 'RANCHO FLAMBOYANT' },
  }) as FilaProcuraMensaje & { id: string };

  const prioridad = row.prioridad?.trim() || 'Media';
  const stock = resumenStockDesdeEvaluacion(
    {
      cantidadSolicitada: Number(row.cantidad),
      cantidadDespacho: Number(row.cantidad_despacho ?? 0),
      cantidadCompra: Number(row.cantidad_compra ?? row.cantidad),
      stockDisponible: Number(row.stock_almacen_detectado ?? 0),
    },
    row.unidad,
  );

  const procuraId = String(row.id);
  const ticket = String(row.ticket);

  await enviarPreview(
    token,
    chatDestino,
    'Administrador',
    null,
    construirMensajeAdminViabilidadProcura(row, prioridad, stock),
    tecladoViabilidadAdmin(procuraId),
  );

  await enviarPreview(
    token,
    chatDestino,
    'Project Manager',
    null,
    construirMensajePmDecisionProcura(
      {
        ...row,
        viabilidad_presupuestaria: row.viabilidad_presupuestaria ?? 'si',
        viabilidad_informada_por: row.viabilidad_informada_por ?? 'Administrador',
      },
      prioridad,
      stock,
    ),
    tecladoAprobacionDepartamento(procuraId),
  );

  const procuraOrden = (await cargarProcuraOrdenCompra(sb, procuraId)) ?? {
    id: procuraId,
    ticket,
    estado: 'aprobada',
    material_txt: String(row.material_txt),
    cantidad: Number(row.cantidad),
    unidad: String(row.unidad),
    solicitante_nombre: row.solicitante_nombre,
    solicitante_telegram_chat_id: null,
    prioridad: row.prioridad,
    monto_estimado_usd: row.monto_estimado_usd,
    observaciones: null,
    ci_proyectos: row.ci_proyectos,
    ci_entidades: null,
    ci_compras_capitulos_maestro: row.ci_compras_capitulos_maestro,
  };

  const textoComprador = mensajeOrdenCompraComprador(procuraOrden, {
    autorNombre: 'Project Manager (demo)',
    motivo: 'Orden de compra tras aprobación PM — pendiente factura',
    cantidadCompra: Number(row.cantidad_compra ?? row.cantidad),
  });

  const compradores = await listarUsuariosOrdenCompraTelegram(sb);
  if (compradores.length) {
    for (const c of compradores) {
      await enviarPreview(
        token,
        chatDestino,
        'Comprador',
        `${c.nombre} (chat ${c.telegram_id})`,
        textoComprador,
      );
    }
  } else {
    await enviarPreview(
      token,
      chatDestino,
      'Comprador',
      'Usuario comprador configurado en sistema',
      textoComprador,
    );
  }

  await enviarPreview(
    token,
    chatDestino,
    'Solicitante (obrero)',
    row.solicitante_nombre?.trim() || null,
    `🎫 <b>Ticket:</b> ${escHtml(ticket)}\n` +
      `📦 ${escHtml(String(row.material_txt))}\n` +
      `<b>APROBADO</b>`,
  );

  console.log(`✅ Mensajes de vista previa enviados a Telegram ${chatDestino}`);
  console.log(`   Procura de referencia: ${ticket}`);
  console.log(`   Compradores en sistema: ${compradores.length || '(ninguno — mensaje genérico)'}`);
}

main().catch((e) => {
  console.error('❌', e instanceof Error ? e.message : e);
  process.exit(1);
});
