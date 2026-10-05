/**
 * Selección múltiple en el plano de NetVision: elegir varios equipos y
 * moverlos, duplicarlos, cambiarles el modelo o eliminarlos de una vez.
 * Funciones puras (sin React) para poder probarlas.
 */
import type { DesignCamera, NetVisionProject } from '@/lib/netvision/types'

type Posicionable = { id: string; x: number; y: number }

const redondear = (n: number) => Math.round(n * 1000) / 1000
const acotar = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))

/** Agrega el id a la selección, o lo quita si ya estaba. */
export function alternarSeleccion(ids: readonly string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]
}

/** Equipos que se pueden elegir en selección múltiple (cámaras, red, equipos y sala técnica). */
export function equiposSeleccionables(project: NetVisionProject): Posicionable[] {
  return [
    ...project.cameras,
    ...project.networkNodes,
    ...(project.planDevices ?? []),
    ...(project.infraDevices ?? []),
  ].map((e) => ({ id: e.id, x: e.x, y: e.y }))
}

/** Quita de la selección los ids que ya no existen en el diseño. */
export function depurarSeleccion(project: NetVisionProject, ids: readonly string[]): string[] {
  const existentes = new Set(equiposSeleccionables(project).map((e) => e.id))
  return ids.filter((id) => existentes.has(id))
}

/**
 * Desplazamiento del grupo cuando se arrastra uno de sus equipos hasta `destino`.
 * Se recorta para que ningún equipo del grupo salga del plano (0–1).
 */
export function desplazamientoGrupo(
  equipos: readonly Posicionable[],
  ids: readonly string[],
  anclaId: string,
  destino: { x: number; y: number },
): { dx: number; dy: number } {
  const grupo = equipos.filter((e) => ids.includes(e.id))
  const ancla = grupo.find((e) => e.id === anclaId)
  if (!ancla) return { dx: 0, dy: 0 }
  let dx = destino.x - ancla.x
  let dy = destino.y - ancla.y
  const minX = Math.min(...grupo.map((e) => e.x))
  const maxX = Math.max(...grupo.map((e) => e.x))
  const minY = Math.min(...grupo.map((e) => e.y))
  const maxY = Math.max(...grupo.map((e) => e.y))
  dx = acotar(dx, -minX, 1 - maxX)
  dy = acotar(dy, -minY, 1 - maxY)
  return { dx, dy }
}

/** Mueve todos los equipos seleccionados lo mismo que el que se arrastró. */
export function moverGrupo(
  project: NetVisionProject,
  ids: readonly string[],
  anclaId: string,
  destino: { x: number; y: number },
): NetVisionProject {
  const { dx, dy } = desplazamientoGrupo(equiposSeleccionables(project), ids, anclaId, destino)
  if (dx === 0 && dy === 0) return project
  const mover = <T extends Posicionable>(e: T): T =>
    ids.includes(e.id)
      ? { ...e, x: redondear(acotar(e.x + dx, 0, 1)), y: redondear(acotar(e.y + dy, 0, 1)) }
      : e
  return {
    ...project,
    cameras: project.cameras.map(mover),
    networkNodes: project.networkNodes.map(mover),
    planDevices: (project.planDevices ?? []).map(mover),
    infraDevices: (project.infraDevices ?? []).map(mover),
  }
}

/**
 * Siguiente nombre «CAM-NN» libre. Usa el número más alto ya usado, así no se
 * repite un nombre después de borrar una cámara.
 */
export function siguienteEtiquetaCamara(etiquetas: readonly string[]): string {
  let mayor = 0
  for (const etiqueta of etiquetas) {
    const m = /^CAM-(\d+)$/i.exec(etiqueta.trim())
    if (m) mayor = Math.max(mayor, Number(m[1]))
  }
  const n = Math.max(mayor, etiquetas.length) + 1
  return `CAM-${String(n).padStart(2, '0')}`
}

/** Separación de la copia respecto al original (fracción del plano). */
export const DUPLICADO_DESPLAZAMIENTO = 0.035

/**
 * Copias de las cámaras elegidas: mismo modelo, orientación, ángulo, alcance,
 * altura y color; nombre nuevo y un poco desplazadas para que no queden encima.
 */
export function duplicarCamaras(
  camaras: readonly DesignCamera[],
  ids: readonly string[],
  crearId: () => string,
  desplazamiento = DUPLICADO_DESPLAZAMIENTO,
): DesignCamera[] {
  const etiquetas = camaras.map((c) => c.label)
  const copias: DesignCamera[] = []
  for (const original of camaras) {
    if (!ids.includes(original.id)) continue
    const etiqueta = siguienteEtiquetaCamara(etiquetas)
    etiquetas.push(etiqueta)
    const copia = JSON.parse(JSON.stringify(original)) as DesignCamera
    // Si no cabe hacia abajo/derecha, la copia va hacia el otro lado.
    const sx = original.x + desplazamiento <= 0.98 ? desplazamiento : -desplazamiento
    const sy = original.y + desplazamiento <= 0.98 ? desplazamiento : -desplazamiento
    copia.id = crearId()
    copia.label = etiqueta
    copia.x = redondear(acotar(original.x + sx, 0, 1))
    copia.y = redondear(acotar(original.y + sy, 0, 1))
    // Los quiebres de la línea al nombre son puntos fijos del plano: no se copian.
    delete copia.leaderElbows
    copias.push(copia)
  }
  return copias
}

/** Resumen corto de lo elegido, p. ej. «3 cámaras · 1 equipo de red». */
export function resumenSeleccion(project: NetVisionProject, ids: readonly string[]): string {
  const cuenta = (lista: readonly { id: string }[]) => lista.filter((e) => ids.includes(e.id)).length
  const camaras = cuenta(project.cameras)
  const red = cuenta(project.networkNodes)
  const otros = cuenta(project.planDevices ?? []) + cuenta(project.infraDevices ?? [])
  const partes = [
    camaras ? `${camaras} ${camaras === 1 ? 'cámara' : 'cámaras'}` : null,
    red ? `${red} ${red === 1 ? 'equipo de red' : 'equipos de red'}` : null,
    otros ? `${otros} ${otros === 1 ? 'equipo' : 'equipos'}` : null,
  ].filter(Boolean)
  return partes.length ? partes.join(' · ') : 'Nada seleccionado'
}
