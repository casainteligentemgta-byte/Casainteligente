/**
 * Vista previa de mensajes /ingreso → envía al chat de pruebas con cabecera por flujo.
 * Uso: npx tsx scripts/enviar-preview-mensajes-ingreso.ts
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { listarFacturasPendientesIngreso } from '../lib/almacen/listarFacturasPendientesIngreso';
import {
  callbackFacturaPrecargada,
  etiquetaFacturaBoton,
} from '../lib/telegram/ingresoFacturaTelegram';
import {
  callbackMenuIngreso,
  type OpcionMenuIngreso,
} from '../lib/telegram/menuIngresoSalidaTelegram';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const MENU_FACTURAS_PAGE_SIZE = 5;

const FLUJO_PASOS_ARTICULOS =
  '5️⃣ <b>Artículos a ingresar</b>: material de la obra o nuevo; elige <b>categoría</b> por línea.\n' +
  '6️⃣ Indica la <b>cantidad</b> de cada artículo.\n' +
  '7️⃣ <b>¿Agregar más artículos?</b>\n' +
  '8️⃣ <b>Soporte fotográfico</b> (opcional).\n' +
  '9️⃣ <b>Observaciones</b> (opcional) y <b>registrar ingreso</b> (stock + contabilidad provisional).\n\n' +
  '<code>/cancelar</code> para abortar.';

const MENSAJE_FACTURA_MANUAL =
  '🧾 <b>Ingreso manual de factura</b> (<code>/ingreso</code>)\n\n' +
  '1️⃣ Elige la <b>obra</b>.\n' +
  '2️⃣ Elige el <b>almacén</b> de ingreso.\n' +
  '3️⃣ <b>Elige o escribe</b> el <b>proveedor</b> (lista o nombre nuevo).\n' +
  '4️⃣ Escribe el <b>número de factura</b> (<code>S/N</code> si no hay).\n' +
  FLUJO_PASOS_ARTICULOS;

const MENSAJE_FACTURA_AUTO =
  '🤖 <b>Ingreso automático de factura</b> (<code>/ingreso</code>)\n\n' +
  '1️⃣ Elige la <b>obra</b>.\n' +
  '2️⃣ Elige el <b>almacén</b> de ingreso.\n' +
  '3️⃣ <b>Elige o escribe</b> el <b>proveedor</b> (lista o nombre nuevo).\n' +
  '4️⃣ Envíe <b>foto o PDF</b> de la factura (IA) o escriba el <b>número de factura</b> (<code>S/N</code> si no hay).\n' +
  FLUJO_PASOS_ARTICULOS;

const MENSAJE_NOTA =
  '📄 <b>Ingreso con nota de entrega</b> (<code>/ingreso</code>)\n\n' +
  '1️⃣ Elige la <b>obra</b>.\n' +
  '2️⃣ Elige el <b>almacén</b> de ingreso.\n' +
  '3️⃣ <b>Elige o escribe</b> el <b>proveedor</b> (lista o nombre nuevo).\n' +
  '4️⃣ Escribe el <b>número de la nota de entrega</b> (<code>S/N</code> si no hay).\n' +
  FLUJO_PASOS_ARTICULOS;

const MENSAJE_SIN_NOTA =
  '📝 <b>Ingreso sin nota</b> (<code>/ingreso</code>)\n\n' +
  '1️⃣ Elige la <b>obra</b>.\n' +
  '2️⃣ Elige el <b>almacén</b> de ingreso.\n' +
  '3️⃣ <b>Elige o escribe</b> el <b>proveedor</b> (lista o nombre nuevo).\n' +
  '4️⃣ Escribe una <b>referencia</b> del ingreso (<code>S/N</code> si no hay documento).\n' +
  FLUJO_PASOS_ARTICULOS;

const MENSAJE_PASOS_PRECARGADA =
  '1️⃣ Elige la <b>Obra</b>.\n' +
  '2️⃣ Elige el <b>almacén</b>.\n' +
  '3️⃣ Escribe el <b>proveedor</b> y <b>número de factura</b>.\n' +
  '4️⃣ <b>Nº o referencia</b> de factura o nota (<code>S/N</code> si no hay).\n' +
  '5️⃣ <b>Material</b> (catálogo o nuevo), <b>cantidad</b>, <b>foto</b>.\n' +
  '6️⃣ <b>Observaciones</b> (opcional).\n' +
  '7️⃣ <b>Confirmar</b> ingreso.\n\n' +
  '<code>/cancelar</code> para abortar.';

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
  flujo: string,
  cuerpo: string,
  replyMarkup?: object,
): Promise<void> {
  const text =
    `📬 <b>Flujo: ${escHtml(flujo)}</b>\n` +
    `<i>Vista previa — no inicia sesión real en el bot</i>\n\n` +
    cuerpo;

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatDestino,
      text: text.slice(0, 4090),
      parse_mode: 'HTML',
      disable_web_page_preview: false,
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    }),
  });

  const json = (await res.json()) as { ok?: boolean; description?: string };
  if (!json.ok) throw new Error(json.description ?? 'Telegram sendMessage failed');
  await new Promise((r) => setTimeout(r, 450));
}

function tecladoMenuIngreso(
  facturas: Awaited<ReturnType<typeof listarFacturasPendientesIngreso>>,
): { inline_keyboard: Array<Array<{ text: string; callback_data: string }>> } {
  const rows: Array<Array<{ text: string; callback_data: string }>> = [
    [{ text: '🧾 Ingreso manual de factura', callback_data: callbackMenuIngreso('factura') }],
    [{ text: '🤖 Ingreso automático de factura', callback_data: callbackMenuIngreso('factauto') }],
    [{ text: '📄 Ingreso con nota de entrega', callback_data: callbackMenuIngreso('nota') }],
    [{ text: '📝 Ingreso sin nota', callback_data: callbackMenuIngreso('sinnota') }],
  ];

  const slice = facturas.slice(0, MENU_FACTURAS_PAGE_SIZE);
  for (const f of slice) {
    rows.push([
      { text: etiquetaFacturaBoton(f), callback_data: callbackFacturaPrecargada(f.key) },
    ]);
  }

  if (facturas.length > MENU_FACTURAS_PAGE_SIZE) {
    rows.push([
      { text: '📋 Ver todas por proveedor', callback_data: callbackMenuIngreso('precargadas') },
    ]);
  }

  return { inline_keyboard: rows };
}

function textoMenuIngreso(facturas: Awaited<ReturnType<typeof listarFacturasPendientesIngreso>>): string {
  const nIngreso = facturas.filter((f) => f.accion === 'ingreso_almacen').length;
  const nConfirmar = facturas.length - nIngreso;
  let texto = '📥 <b>Ingreso a almacén</b>\n\nElige el tipo de ingreso:';
  if (facturas.length) {
    texto +=
      `\n\n<b>Facturas precargadas</b> (${facturas.length})` +
      (nIngreso ? `\n📥 ${nIngreso} lista(s) para ingreso` : '') +
      (nConfirmar ? `\n⏳ ${nConfirmar} requiere(n) confirmar compra` : '') +
      '\n<i>📥 = ingresar · ⏳ = confirmar compra primero</i>';
  }
  return texto;
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
  const facturas = await listarFacturasPendientesIngreso(sb);

  // 1 Menú principal
  await enviarPreview(token, chatDestino, '/ingreso — menú principal', textoMenuIngreso(facturas), tecladoMenuIngreso(facturas));

  const flujosGuiados: Array<{ flujo: string; cuerpo: string }> = [
    { flujo: 'Manual factura', cuerpo: MENSAJE_FACTURA_MANUAL },
    { flujo: 'Automático factura (OCR)', cuerpo: MENSAJE_FACTURA_AUTO },
    { flujo: 'Con nota de entrega', cuerpo: MENSAJE_NOTA },
    { flujo: 'Sin nota', cuerpo: MENSAJE_SIN_NOTA },
  ];

  for (const f of flujosGuiados) {
    await enviarPreview(token, chatDestino, f.flujo, f.cuerpo);
  }

  // Pasos intermedios (demo obra RANCHO)
  await enviarPreview(
    token,
    chatDestino,
    'Manual factura — paso 2 almacén',
    '2️⃣ <b>Elige el almacén de ingreso</b>\nObra: <b>RANCHO FLAMBOYANT</b>\n🏢 Entidad: <b>Dimáquinas</b>',
    {
      inline_keyboard: [
        [{ text: '🏭 Almacén central obra', callback_data: 'demo:ub' }],
        [{ text: '🚐 Almacén móvil', callback_data: 'demo:ub2' }],
      ],
    },
  );

  await enviarPreview(
    token,
    chatDestino,
    'Manual factura — paso 4 número',
    '🏢 Proveedor: <b>Ferretería El Constructor</b>\n\n4️⃣ 📄 Escribe el <b>número de factura</b> (<code>S/N</code> si no hay):',
  );

  await enviarPreview(
    token,
    chatDestino,
    'Automático OCR — paso 4 foto/PDF',
    '🏢 Proveedor: <b>Ferretería El Constructor</b>\n\n' +
      '4️⃣ Envíe <b>foto o PDF</b> de la factura (IA leerá número y artículos).\n\n' +
      'También puede escribir el <b>número de factura</b> (<code>S/N</code> si no hay) para cargar artículos manualmente.',
  );

  await enviarPreview(
    token,
    chatDestino,
    'Sin nota — paso 4 referencia',
    '🏢 Proveedor: <b>Proveedor eventual</b>\n\n4️⃣ 📄 Escribe una <b>referencia</b> del ingreso (<code>S/N</code> si no hay documento):',
  );

  await enviarPreview(
    token,
    chatDestino,
    'Guiado — paso 5 material',
    '5️⃣ <b>Artículos a ingresar</b>\n\nEscribe el nombre del material o elige del catálogo de la obra.',
    {
      inline_keyboard: [
        [{ text: 'CEMENTO GRIS', callback_data: 'demo:mat' }],
        [{ text: '➕ Material nuevo', callback_data: 'demo:new' }],
      ],
    },
  );

  await enviarPreview(
    token,
    chatDestino,
    'Guiado — éxito factura manual',
    '✅ <b>Factura ingresada</b> (almacén + contabilidad)\n\n' +
      'Ferretería El Constructor · #FAC-2026-0042\n\n' +
      '📋 Contabilidad provisional registrada (conciliación fiscal posterior).',
  );

  await enviarPreview(
    token,
    chatDestino,
    'Sin nota — éxito',
    '✅ <b>Ingreso sin nota registrado</b> (almacén + contabilidad)\n\n' +
      'Proveedor eventual · #S/N\n\n' +
      '📋 Contabilidad provisional registrada. Concilie con la factura fiscal cuando llegue.',
  );

  // Precargadas — lista depositario
  const nConfirmar = facturas.filter((f) => f.accion === 'confirmar').length;
  const notaConfirmar =
    nConfirmar > 0
      ? `\n⏳ <b>${nConfirmar}</b> factura(s) requieren <b>confirmar compra</b> en la app antes del ingreso.\n` +
        '📥 Las marcadas como <b>ingreso</b> siguen el flujo completo aquí.\n'
      : '';

  const demoProvRows =
    facturas.length > 0
      ? facturas.slice(0, 3).map((f) => [{ text: etiquetaFacturaBoton(f), callback_data: 'demo:fc' }])
      : [
          [{ text: '📥 #FAC-001 · Ferretería · ingreso', callback_data: 'demo:fc' }],
          [{ text: '⏳ #FAC-002 · Dimáquinas · confirmar', callback_data: 'demo:fc2' }],
        ];

  await enviarPreview(
    token,
    chatDestino,
    'Precargadas — /ingresofactura (por proveedor)',
    '📥 <b>INGRESO FÍSICO — DEPOSITARIO</b>\n\n' + MENSAJE_PASOS_PRECARGADA + notaConfirmar,
    { inline_keyboard: [...demoProvRows, [{ text: '🏢 Ferretería El Constructor', callback_data: 'demo:pr' }]] },
  );

  await enviarPreview(
    token,
    chatDestino,
    'Precargadas — elegir factura',
    '🏢 <b>Ferretería El Constructor</b>\n\nElige la factura a ingresar:',
    {
      inline_keyboard: [[{ text: '📥 #FAC-2026-0042 · ingreso', callback_data: 'demo:fc' }]],
    },
  );

  await enviarPreview(
    token,
    chatDestino,
    'Precargadas — preview líneas',
    '📄 <b>Factura #FAC-2026-0042</b>\n' +
      '📱 Telegram\n\n' +
      '<b>Productos y cantidades facturadas:</b>\n' +
      '1. <b>CEMENTO GRIS</b> · <b>50</b>\n' +
      '2. <b>ARENA FINA</b> · <b>10</b>\n\n' +
      '<i>A continuación verificarás la cantidad física de cada ítem.</i>',
  );

  await enviarPreview(
    token,
    chatDestino,
    'Precargadas — cantidad física',
    '📦 <b>Ítem 1 de 2</b>\n\n' +
      '🔹 <b>CEMENTO GRIS</b>\n' +
      '📋 Cantidad facturada: <b>50</b>\n\n' +
      '✍️ Escribe la <b>cantidad física recibida</b>:',
  );

  await enviarPreview(
    token,
    chatDestino,
    'Precargadas — fotos',
    '📷 <b>Soporte fotográfico</b>\n\n' +
      'Envía una o varias fotos del material o comprobante.\n' +
      'Cuando termines, pulsa <b>Listo con fotos</b> o <b>Omitir fotos</b>.',
    {
      inline_keyboard: [
        [
          { text: '✅ Listo con fotos', callback_data: 'demo:foto:done' },
          { text: '⏭ Omitir fotos', callback_data: 'demo:foto:skip' },
        ],
      ],
    },
  );

  await enviarPreview(
    token,
    chatDestino,
    'Precargadas — confirmar',
    '📋 <b>Resumen antes de ingresar a almacén</b>\n\n' +
      '🏢 Ferretería El Constructor\n' +
      '📄 #FAC-2026-0042\n' +
      '📱 Telegram\n\n' +
      '✅ <b>CEMENTO GRIS</b>\n   Facturado: 50 · Recibido: 50\n' +
      '✅ <b>ARENA FINA</b>\n   Facturado: 10 · Recibido: 10',
    {
      inline_keyboard: [[{ text: '🚀 Registrar ingreso a almacén', callback_data: 'demo:conf' }]],
    },
  );

  await enviarPreview(
    token,
    chatDestino,
    'Precargadas — éxito',
    '✅ <b>Ingreso a almacén registrado</b>\n\nFerretería El Constructor · #FAC-2026-0042',
  );

  await enviarPreview(
    token,
    chatDestino,
    'Precargadas — ⏳ confirmar compra primero',
    '⏳ <b>Confirmar compra primero</b>\n' +
      'Dimáquinas · #FAC-PENDIENTE\n' +
      '📱 Telegram\n\n' +
      'Esta factura está en tránsito: debe registrarse la compra en contabilidad y quedar ' +
      'lista para ingreso a almacén.\n\n' +
      '<a href="https://casainteligente.company/contabilidad/compras">Abrir y confirmar en la app</a>\n\n' +
      'Luego vuelva a usar <code>/ingreso</code> — aparecerá como 📥 ingreso.',
  );

  const opciones: OpcionMenuIngreso[] = ['factura', 'factauto', 'nota', 'sinnota', 'precargadas'];
  console.log(`✅ Vista previa /ingreso enviada a Telegram ${chatDestino}`);
  console.log(`   Mensajes: menú + ${flujosGuiados.length} intros + pasos + precargadas`);
  console.log(`   Facturas precargadas en BD: ${facturas.length}`);
  console.log(`   Opciones menú: ${opciones.join(', ')}`);
}

main().catch((e) => {
  console.error('❌', e instanceof Error ? e.message : e);
  process.exit(1);
});
