import fs from 'fs/promises';
import path from 'path';
import { env } from '../config/env.js';

function pad(n) {
  return String(n).padStart(2, '0');
}

/** @param {Date} d */
function toIcsUtc(d) {
  return (
    d.getUTCFullYear() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    'T' +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    'Z'
  );
}

function escapeIcs(text) {
  return String(text || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

function slug(s) {
  return String(s || 'cita')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40) || 'cita';
}

/**
 * @param {{
 *   titulo: string,
 *   inicioIso: string,
 *   finIso?: string,
 *   duracionMinutos?: number,
 *   ubicacion?: string,
 *   notas?: string,
 * }} input
 */
export function buildIcsEvent(input) {
  const titulo = (input.titulo || 'Cita').trim();
  const start = new Date(input.inicioIso);
  if (Number.isNaN(start.getTime())) {
    throw new Error(`Fecha de inicio inválida: ${input.inicioIso}`);
  }

  let end;
  if (input.finIso) {
    end = new Date(input.finIso);
    if (Number.isNaN(end.getTime())) throw new Error(`Fecha de fin inválida: ${input.finIso}`);
  } else {
    const mins = Number(input.duracionMinutos) > 0 ? Number(input.duracionMinutos) : 60;
    end = new Date(start.getTime() + mins * 60_000);
  }

  const uid = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}@casainteligente`;
  const now = toIcsUtc(new Date());
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Casa Inteligente//Asistente//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    `DTSTART:${toIcsUtc(start)}`,
    `DTEND:${toIcsUtc(end)}`,
    `SUMMARY:${escapeIcs(titulo)}`,
  ];
  if (input.ubicacion?.trim()) lines.push(`LOCATION:${escapeIcs(input.ubicacion.trim())}`);
  if (input.notas?.trim()) lines.push(`DESCRIPTION:${escapeIcs(input.notas.trim())}`);
  lines.push('END:VEVENT', 'END:VCALENDAR', '');

  const ics = lines.join('\r\n');
  const fileName = `${slug(titulo)}_${start.toISOString().slice(0, 10)}.ics`;
  return {
    fileName,
    buffer: Buffer.from(ics, 'utf8'),
    mimeType: 'text/calendar',
    titulo,
    inicio: start.toISOString(),
    fin: end.toISOString(),
  };
}

/**
 * Guarda el .ics en iCloud si está configurado.
 * @param {{ fileName: string, buffer: Buffer }} file
 */
export async function guardarIcsEnIcloud(file) {
  const base = env.icloudContainerPath();
  if (!base) return null;
  const dir = path.join(base, 'Agenda');
  await fs.mkdir(dir, { recursive: true });
  const dest = path.join(dir, file.fileName);
  await fs.writeFile(dest, file.buffer);
  return dest;
}
