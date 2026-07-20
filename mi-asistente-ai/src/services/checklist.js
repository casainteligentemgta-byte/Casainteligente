import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../../.data');
const FILE = path.join(DATA_DIR, 'checklists.json');

/**
 * @typedef {{
 *   id: string,
 *   chatId: string,
 *   obraId: string | null,
 *   obraNombre: string | null,
 *   fecha: string,
 *   items: Array<{ id: string, texto: string, hecho: boolean }>,
 *   createdAt: string,
 *   updatedAt: string,
 * }} Checklist
 */

/** @type {Checklist[]} */
let items = [];

function load() {
  try {
    if (!fs.existsSync(FILE)) return;
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    items = Array.isArray(raw) ? raw : [];
  } catch (e) {
    console.warn('[checklist] load', e);
    items = [];
  }
}

function save() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(items, null, 2), 'utf8');
  } catch (e) {
    console.warn('[checklist] save', e);
  }
}

load();

function nuevoId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function fechaCaracas(isoOrDate) {
  if (isoOrDate) {
    const d = new Date(isoOrDate);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString('en-CA', { timeZone: 'America/Caracas' });
    }
  }
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Caracas' });
}

/**
 * Normaliza ítems desde string ("a, b y c") o array.
 * @param {string | string[]} raw
 */
function parseItems(raw) {
  if (Array.isArray(raw)) {
    return raw.map((t) => String(t || '').trim()).filter(Boolean);
  }
  return String(raw || '')
    .split(/[,;\n]| y (?=[A-Za-zÁÉÍÓÚáéíóúÑñ0-9])/i)
    .map((t) => t.trim())
    .filter(Boolean);
}

/**
 * @param {{
 *   chatId: string|number,
 *   obraId?: string | null,
 *   obraNombre?: string | null,
 *   fecha?: string,
 *   items: string | string[],
 *   reemplazar?: boolean,
 * }} input
 */
export function crearOActualizarChecklist(input) {
  const chatId = String(input.chatId);
  const fecha = fechaCaracas(input.fecha);
  const textos = parseItems(input.items);
  if (!textos.length) throw new Error('Agrega al menos un ítem al checklist.');

  let row = items.find(
    (c) =>
      c.chatId === chatId &&
      c.fecha === fecha &&
      String(c.obraId || '') === String(input.obraId || ''),
  );

  const ahora = new Date().toISOString();

  if (!row || input.reemplazar) {
    if (row && input.reemplazar) {
      items = items.filter((c) => c.id !== row.id);
    }
    row = {
      id: nuevoId('cl'),
      chatId,
      obraId: input.obraId ? String(input.obraId) : null,
      obraNombre: input.obraNombre || null,
      fecha,
      items: textos.map((texto) => ({
        id: nuevoId('i'),
        texto,
        hecho: false,
      })),
      createdAt: ahora,
      updatedAt: ahora,
    };
    items.push(row);
  } else {
    for (const texto of textos) {
      const exists = row.items.some(
        (i) => i.texto.toLowerCase() === texto.toLowerCase(),
      );
      if (!exists) {
        row.items.push({ id: nuevoId('i'), texto, hecho: false });
      }
    }
    if (input.obraNombre) row.obraNombre = input.obraNombre;
    row.updatedAt = ahora;
  }

  save();
  return row;
}

/**
 * @param {string|number} chatId
 * @param {{ fecha?: string, obraId?: string | null }} [opts]
 */
export function obtenerChecklist(chatId, opts = {}) {
  const id = String(chatId);
  const fecha = fechaCaracas(opts.fecha);
  const obraKey = opts.obraId != null ? String(opts.obraId) : null;

  let list = items.filter((c) => c.chatId === id && c.fecha === fecha);
  if (obraKey) {
    const exact = list.find((c) => String(c.obraId || '') === obraKey);
    if (exact) return exact;
  }
  // Preferir checklist de la obra pedida; si no, el más reciente del día
  list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return list[0] || null;
}

/**
 * @param {string|number} chatId
 * @param {string} itemRef índice 1-based o id del ítem
 * @param {{ fecha?: string, obraId?: string | null, hecho?: boolean }} [opts]
 */
export function marcarItem(chatId, itemRef, opts = {}) {
  const row = obtenerChecklist(chatId, opts);
  if (!row) throw new Error('No hay checklist para esa fecha.');

  const ref = String(itemRef || '').trim();
  let item = row.items.find((i) => i.id === ref);
  if (!item && /^\d+$/.test(ref)) {
    const idx = Number(ref) - 1;
    item = row.items[idx];
  }
  if (!item) {
    item = row.items.find((i) => i.texto.toLowerCase().includes(ref.toLowerCase()));
  }
  if (!item) throw new Error(`No encontré el ítem «${ref}».`);

  item.hecho = opts.hecho != null ? Boolean(opts.hecho) : !item.hecho;
  row.updatedAt = new Date().toISOString();
  save();
  return { checklist: row, item };
}

/**
 * Formato Markdown para Telegram.
 * @param {Checklist} row
 */
export function formatChecklist(row) {
  if (!row) return 'No hay checklist.';
  const hechos = row.items.filter((i) => i.hecho).length;
  const head = [
    `*Checklist · ${row.fecha}*`,
    row.obraNombre ? `Obra: *${row.obraNombre}*` : null,
    `Progreso: ${hechos}/${row.items.length}`,
  ]
    .filter(Boolean)
    .join('\n');

  const lines = row.items.map((i, n) => {
    const mark = i.hecho ? '✅' : '⬜';
    return `${n + 1}. ${mark} ${i.texto}`;
  });

  return `${head}\n\n${lines.join('\n')}\n\nMarcar: /check 1 · Agregar: /checklist hormigón, acero`;
}
