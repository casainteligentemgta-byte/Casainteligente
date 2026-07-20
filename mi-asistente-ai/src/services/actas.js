import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { env } from '../config/env.js';
import { generateText } from './llm.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../../.data/actas');

function slug(s) {
  return (
    String(s || 'acta')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 50) || 'acta'
  );
}

function fechaCaracas() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Caracas' });
}

function horaCaracas() {
  return new Date().toLocaleTimeString('es-VE', {
    timeZone: 'America/Caracas',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Redacta un acta profesional a partir de notas/transcripción.
 * @param {{
 *   notas: string,
 *   obraNombre?: string | null,
 *   titulo?: string | null,
 * }} input
 */
export async function redactarActaMarkdown(input) {
  const notas = String(input.notas || '').trim();
  if (!notas) throw new Error('Faltan notas o transcripción para el acta.');

  const obra = input.obraNombre?.trim() || 'Sin obra especificada';
  const titulo = input.titulo?.trim() || `Acta de obra — ${obra}`;
  const fecha = fechaCaracas();
  const hora = horaCaracas();

  const prompt = [
    `Redacta un ACTA DE OBRA en Markdown (español Venezuela), lista para archivar.`,
    `Título sugerido: ${titulo}`,
    `Obra: ${obra}`,
    `Fecha: ${fecha} · Hora aprox.: ${hora} (America/Caracas)`,
    '',
    'Estructura obligatoria:',
    '1. Título (#)',
    '2. Metadatos (obra, fecha, hora, redactor: Asistente Casa Inteligente)',
    '3. Participantes (si no hay datos, poner "Por confirmar")',
    '4. Resumen',
    '5. Temas tratados (viñetas)',
    '6. Acuerdos / decisiones',
    '7. Pendientes / acciones (con responsable si se menciona)',
    '8. Próxima visita o seguimiento (si aplica)',
    '',
    'Reglas: no inventes montos ni facturas. Si falta un dato, indícalo como pendiente.',
    'Sé conciso y profesional. Solo el Markdown, sin explicación fuera del documento.',
    '',
    'Notas / transcripción del usuario:',
    '---',
    notas,
    '---',
  ].join('\n');

  let md = await generateText({
    prompt,
    temperature: 0.35,
    maxOutputTokens: 4096,
  });
  if (!md) throw new Error('No pude redactar el acta.');
  md = md.replace(/^```(?:markdown|md)?\s*/i, '').replace(/\s*```$/i, '').trim();

  const fileName = `${fecha}_${slug(obra)}_${slug(titulo)}.md`;
  return {
    titulo,
    obra,
    fecha,
    fileName,
    markdown: md,
    buffer: Buffer.from(md, 'utf8'),
    mimeType: 'text/markdown',
  };
}

/**
 * Guarda el acta en .data y opcionalmente en iCloud/Actas.
 * @param {{ fileName: string, buffer: Buffer, chatId?: string|number }} file
 */
export async function guardarActa(file) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const localPath = path.join(DATA_DIR, file.fileName);
  await fs.writeFile(localPath, file.buffer);

  let iCloudPath = null;
  const base = env.icloudContainerPath();
  if (base) {
    const dir = path.join(base, 'Actas');
    await fs.mkdir(dir, { recursive: true });
    iCloudPath = path.join(dir, file.fileName);
    await fs.writeFile(iCloudPath, file.buffer);
  }

  return { localPath, iCloudPath };
}
