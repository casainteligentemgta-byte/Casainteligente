/**
 * Técnico de dispositivos (IA) · parte pura: contexto del catálogo, instrucciones
 * y utilidades de formato. Sin llamadas a proveedores, para poder probarla sola.
 */
import { CAMERA_CATALOG, catalogFovLabel } from '@/lib/netvision/catalog/cameras'
import { NETWORK_CATALOG } from '@/lib/netvision/catalog/network'
import type { CameraModel, NetworkDeviceModel } from '@/lib/netvision/types'
import {
  formFactorLabel,
  inferCameraConnection,
} from '@/lib/netvision/utils/clienteCameraCard'

export const TECNICO_PREGUNTA_MIN = 4
export const TECNICO_PREGUNTA_MAX = 1200
export const TECNICO_HISTORIAL_MAX = 8
/** Telegram admite 4096 caracteres por mensaje; se deja margen para el pie. */
export const TECNICO_TELEGRAM_MAX = 3800

export type TecnicoTurno = { role: 'user' | 'assistant'; text: string }

function conexionCamara(m: CameraModel): string {
  const kind = inferCameraConnection(m)
  if (kind === 'battery') return 'batería (sin cable)'
  if (kind === 'wifi') return 'Wi-Fi con su fuente (sin tendido PoE)'
  return m.poeSplitterV
    ? `cableada por red; no trae PoE, lleva adaptador PoE (splitter) de ${m.poeSplitterV} V`
    : 'cableada PoE'
}

/** Una línea por cámara con lo que el técnico necesita para responder. */
export function lineaCamara(m: CameraModel): string {
  const partes = [
    `${m.brand} ${m.name}`,
    formFactorLabel(m.formFactor),
    m.resolution,
    `ángulo ${catalogFovLabel(m)}`,
    `alcance ${m.rangeDayM} m día / ${m.rangeNightM} m noche`,
    `consumo ${m.poeWatts} W`,
    `${m.bitrateMbps} Mbps`,
    `conexión: ${conexionCamara(m)}`,
  ]
  const notas = (m.notes ?? '').trim()
  return `- ${partes.join(' · ')}${notas ? ` · Notas: ${notas}` : ''}`
}

export function lineaRed(m: NetworkDeviceModel): string {
  const partes = [`${m.brand} ${m.name}`]
  if (m.kind === 'ap') {
    partes.push(
      'punto de acceso Wi-Fi',
      m.band === 'dual' ? 'doble banda' : `banda ${m.band}`,
      `alcance útil ~${m.wifiRangeM} m de radio`,
      `consumo ${m.drawWatts} W (PoE)`,
    )
  } else if (m.kind === 'injector') {
    partes.push('inyector PoE', `${m.poeBudgetW} W`)
  } else {
    partes.push(
      m.kind === 'nvr' ? (m.recorder === 'dvr' ? 'grabador DVR' : 'grabador NVR') : 'switch',
      `${m.ports} puertos (${m.poePorts} con PoE)`,
      `presupuesto PoE ${m.poeBudgetW} W`,
      `consumo propio ${m.drawWatts} W`,
    )
    if (m.hddBays) partes.push(`${m.hddBays} bahía(s) de disco`)
    if (m.rackUnits) partes.push(`${m.rackUnits}U de rack`)
  }
  return `- ${partes.join(' · ')}`
}

export function marcasDelCatalogo(): string[] {
  const marcas = new Set<string>()
  for (const m of CAMERA_CATALOG) marcas.add(m.brand)
  for (const m of NETWORK_CATALOG) if (m.brand !== 'Generic') marcas.add(m.brand)
  return [...marcas].sort((a, b) => a.localeCompare(b))
}

/** Ficha de la empresa: todo el catálogo de NetVision en texto. */
export function construirContextoCatalogo(): string {
  return [
    'CÁMARAS',
    ...CAMERA_CATALOG.map(lineaCamara),
    '',
    'RED, GRABADORES Y PoE',
    ...NETWORK_CATALOG.map(lineaRed),
  ].join('\n')
}

export function construirPromptTecnico(contexto: string = construirContextoCatalogo()): string {
  return `Eres el técnico de dispositivos de Casa Inteligente C.A., una empresa venezolana de seguridad electrónica y domótica. Atiendes a instaladores en campo y al equipo de proyectos.

Especialidad: cámaras y grabadores (EZVIZ, Hikvision, Dahua, Uniview, Axis, Sony, Aqara), redes UniFi de Ubiquiti (switches, PoE, puntos de acceso) y otras marcas de CCTV, redes y domótica.

Cómo respondes:
- En español, directo y práctico. Si es un procedimiento, pasos numerados y cortos.
- Texto plano: sin Markdown, sin tablas, sin asteriscos. Se lee en un teléfono.
- Primero usa el CATÁLOGO DE LA EMPRESA de abajo: son los datos oficiales con los que la empresa cotiza e instala. Cuando el dato sale de ahí, dilo («según el catálogo»).
- Si el dato no está en el catálogo, responde con tu conocimiento general y adviértelo («no está en el catálogo; verifica en la ficha oficial del fabricante»).
- Nunca inventes especificaciones, modelos, compatibilidades ni precios. Si no lo sabes, dilo.
- Para dimensionar PoE: suma el consumo de las cámaras y compáralo con el presupuesto PoE y con la cantidad de puertos PoE del switch o grabador. Deja margen.
- Las cámaras marcadas con adaptador PoE (splitter) no traen PoE: cada una lleva su adaptador del voltaje indicado.

Seguridad:
- Trabajos en altura o con 110/220 V: recuerda cortar la energía y usar protección.
- No pidas ni repitas contraseñas, códigos de verificación ni seriales completos. Recomienda cambiar siempre la contraseña de fábrica.
- Solo atiendes temas técnicos de equipos e instalación. Si preguntan otra cosa, dilo en una línea.

CATÁLOGO DE LA EMPRESA (NetVision)
${contexto}`
}

export function normalizarPregunta(raw: unknown): string {
  return String(raw ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, TECNICO_PREGUNTA_MAX)
}

/** Últimos turnos válidos de la conversación (para preguntas de seguimiento). */
export function normalizarHistorial(raw: unknown): TecnicoTurno[] {
  if (!Array.isArray(raw)) return []
  const turnos: TecnicoTurno[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const r = item as Record<string, unknown>
    const role = r.role === 'assistant' ? 'assistant' : r.role === 'user' ? 'user' : null
    const text = String(r.text ?? '')
      .trim()
      .slice(0, 4000)
    if (role && text) turnos.push({ role, text })
  }
  const ultimos = turnos.slice(-TECNICO_HISTORIAL_MAX)
  // La conversación debe empezar con el usuario.
  while (ultimos.length > 0 && ultimos[0]!.role !== 'user') ultimos.shift()
  return ultimos
}

export function escaparHtmlTelegram(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Parte una respuesta larga en mensajes que Telegram acepte, cortando por párrafos. */
export function partirMensajeTelegram(texto: string, max: number = TECNICO_TELEGRAM_MAX): string[] {
  const limpio = texto.trim()
  if (!limpio) return []
  const partes: string[] = []
  let resto = limpio
  while (resto.length > max) {
    let corte = resto.lastIndexOf('\n\n', max)
    if (corte < max * 0.4) corte = resto.lastIndexOf('\n', max)
    if (corte < max * 0.4) corte = resto.lastIndexOf(' ', max)
    if (corte < max * 0.4) corte = max
    partes.push(resto.slice(0, corte).trim())
    resto = resto.slice(corte).trim()
  }
  if (resto) partes.push(resto)
  return partes
}

/** Texto tras el comando: «/tecnico@Bot ¿cuánto consume…?» → «¿cuánto consume…?». */
export function preguntaDeComandoTecnico(texto: string): string {
  return normalizarPregunta(texto.trim().replace(/^\/\S+\s*/, ''))
}

export const MENSAJE_AYUDA_TECNICO_TELEGRAM =
  '🛠 <b>Técnico de dispositivos (IA)</b>\n\n' +
  'Escribe tu pregunta después del comando:\n' +
  '• <code>/tecnico ¿cuántos W consume la H9c?</code>\n' +
  '• <code>/tecnico ¿qué switch UniFi necesito para 12 cámaras H3 3K?</code>\n' +
  '• <code>/tecnico pasos para restablecer de fábrica una C6N</code>\n\n' +
  'Responde con el catálogo de NetVision y avisa cuando un dato no está ahí.'
