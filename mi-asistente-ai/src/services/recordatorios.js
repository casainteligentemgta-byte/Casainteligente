import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../../.data');
const FILE = path.join(DATA_DIR, 'recordatorios.json');

/**
 * @typedef {{
 *   id: string,
 *   chatId: string,
 *   texto: string,
 *   cuandoIso: string,
 *   createdAt: string,
 *   enviadoAt?: string | null,
 *   cancelado?: boolean,
 * }} Recordatorio
 */

/** @type {Recordatorio[]} */
let items = [];

function load() {
  try {
    if (!fs.existsSync(FILE)) return;
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    items = Array.isArray(raw) ? raw : [];
  } catch (e) {
    console.warn('[recordatorios] load', e);
    items = [];
  }
}

function save() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(items, null, 2), 'utf8');
  } catch (e) {
    console.warn('[recordatorios] save', e);
  }
}

load();

function nuevoId() {
  return `r_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * @param {{ chatId: string|number, texto: string, cuandoIso: string }} input
 */
export function crearRecordatorio(input) {
  const cuando = new Date(input.cuandoIso);
  if (Number.isNaN(cuando.getTime())) {
    throw new Error(`Fecha/hora inválida: ${input.cuandoIso}`);
  }
  if (cuando.getTime() < Date.now() - 30_000) {
    throw new Error('La fecha del recordatorio ya pasó.');
  }
  const texto = String(input.texto || '').trim();
  if (!texto) throw new Error('Falta el texto del recordatorio.');

  /** @type {Recordatorio} */
  const row = {
    id: nuevoId(),
    chatId: String(input.chatId),
    texto,
    cuandoIso: cuando.toISOString(),
    createdAt: new Date().toISOString(),
    enviadoAt: null,
    cancelado: false,
  };
  items.push(row);
  save();
  return row;
}

/**
 * @param {string|number} chatId
 * @param {{ incluirEnviados?: boolean }} [opts]
 */
export function listarRecordatorios(chatId, opts = {}) {
  const id = String(chatId);
  const ahora = Date.now();
  return items
    .filter((r) => r.chatId === id && !r.cancelado)
    .filter((r) => opts.incluirEnviados || !r.enviadoAt)
    .filter((r) => opts.incluirEnviados || new Date(r.cuandoIso).getTime() >= ahora - 60_000)
    .sort((a, b) => new Date(a.cuandoIso).getTime() - new Date(b.cuandoIso).getTime());
}

/**
 * @param {string} id
 * @param {string|number} chatId
 */
export function cancelarRecordatorio(id, chatId) {
  const row = items.find((r) => r.id === id && r.chatId === String(chatId));
  if (!row) return false;
  row.cancelado = true;
  save();
  return true;
}

/**
 * Recordatorios vencidos pendientes de envío.
 * @returns {Recordatorio[]}
 */
export function popVencidos() {
  const ahora = Date.now();
  /** @type {Recordatorio[]} */
  const due = [];
  for (const r of items) {
    if (r.cancelado || r.enviadoAt) continue;
    if (new Date(r.cuandoIso).getTime() <= ahora) {
      r.enviadoAt = new Date().toISOString();
      due.push({ ...r });
    }
  }
  if (due.length) save();
  return due;
}

/**
 * Arranca el ticker que envía recordatorios por Telegram.
 * @param {import('telegraf').Telegraf} bot
 * @param {{ intervalMs?: number }} [opts]
 */
export function startRecordatoriosTicker(bot, opts = {}) {
  const intervalMs = opts.intervalMs ?? 20_000;
  const tick = async () => {
    const due = popVencidos();
    for (const r of due) {
      try {
        const cuando = new Date(r.cuandoIso).toLocaleString('es-VE', {
          timeZone: 'America/Caracas',
        });
        await bot.telegram.sendMessage(
          r.chatId,
          `⏰ *Recordatorio*\n${r.texto}\n_${cuando}_`,
          { parse_mode: 'Markdown' },
        );
      } catch (e) {
        console.error('[recordatorios] send', r.id, e);
        // Reintentar: desmarcar enviado
        const orig = items.find((x) => x.id === r.id);
        if (orig) {
          orig.enviadoAt = null;
          save();
        }
      }
    }
  };
  void tick();
  return setInterval(() => void tick(), intervalMs);
}
