import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../../.data');
const FILE = path.join(DATA_DIR, 'obra-por-chat.json');

/** @type {Map<string, { id: string, nombre: string }>} */
const cache = new Map();

function load() {
  try {
    if (!fs.existsSync(FILE)) return;
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    for (const [chatId, obra] of Object.entries(raw || {})) {
      if (obra?.id && obra?.nombre) cache.set(String(chatId), obra);
    }
  } catch (e) {
    console.warn('[obraMemoria] load', e);
  }
}

function save() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const obj = Object.fromEntries(cache.entries());
    fs.writeFileSync(FILE, JSON.stringify(obj, null, 2), 'utf8');
  } catch (e) {
    console.warn('[obraMemoria] save', e);
  }
}

load();

/**
 * @param {string|number} chatId
 * @returns {{ id: string, nombre: string } | null}
 */
export function getObraChat(chatId) {
  return cache.get(String(chatId)) || null;
}

/**
 * @param {string|number} chatId
 * @param {{ id: string, nombre: string } | null} obra
 */
export function setObraChat(chatId, obra) {
  const key = String(chatId);
  if (!obra) {
    cache.delete(key);
  } else {
    cache.set(key, { id: obra.id, nombre: obra.nombre });
  }
  save();
}
