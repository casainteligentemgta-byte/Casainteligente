/**
 * Lector mínimo de archivos ZIP para el navegador (sin librerías): lista las
 * entradas y saca una por una. Sirve para el ZIP de fotos del proveedor.
 * No soporta ZIP64 ni cifrado; no hacen falta para unos cientos de fotos.
 */

export type EntradaZip = {
  /** Ruta dentro del ZIP. */
  nombre: string
  /** 0 = sin comprimir, 8 = deflate. */
  metodo: number
  tamComprimido: number
  tam: number
  /** Dónde empieza su cabecera local. */
  desplazamiento: number
}

const FIRMA_FIN = 0x06054b50
const FIRMA_CENTRAL = 0x02014b50
const FIRMA_LOCAL = 0x04034b50

async function bytes(blob: Blob): Promise<DataView> {
  return new DataView(await blob.arrayBuffer())
}

/** Nombre sin carpetas: «fotos/a.jpg» → «a.jpg». */
export function nombreBase(ruta: string): string {
  const partes = ruta.split(/[\\/]/)
  return partes[partes.length - 1] ?? ruta
}

/** Lista las entradas (archivos) de un ZIP. */
export async function listarZip(archivo: Blob): Promise<EntradaZip[]> {
  const colaTam = Math.min(archivo.size, 65557)
  const cola = await bytes(archivo.slice(archivo.size - colaTam))
  let fin = -1
  for (let i = cola.byteLength - 22; i >= 0; i--) {
    if (cola.getUint32(i, true) === FIRMA_FIN) {
      fin = i
      break
    }
  }
  if (fin < 0) throw new Error('El archivo no es un ZIP válido.')
  const total = cola.getUint16(fin + 10, true)
  const tamCentral = cola.getUint32(fin + 12, true)
  const inicioCentral = cola.getUint32(fin + 16, true)
  if (inicioCentral === 0xffffffff) throw new Error('El ZIP es demasiado grande para leerlo aquí.')
  const central = await bytes(archivo.slice(inicioCentral, inicioCentral + tamCentral))
  const decod = new TextDecoder('utf-8')
  const entradas: EntradaZip[] = []
  let p = 0
  for (let k = 0; k < total && p + 46 <= central.byteLength; k++) {
    if (central.getUint32(p, true) !== FIRMA_CENTRAL) break
    const metodo = central.getUint16(p + 10, true)
    const tamComprimido = central.getUint32(p + 20, true)
    const tam = central.getUint32(p + 24, true)
    const largoNombre = central.getUint16(p + 28, true)
    const largoExtra = central.getUint16(p + 30, true)
    const largoComentario = central.getUint16(p + 32, true)
    const desplazamiento = central.getUint32(p + 42, true)
    const nombre = decod.decode(
      new Uint8Array(central.buffer, central.byteOffset + p + 46, largoNombre),
    )
    if (nombre.charAt(nombre.length - 1) !== '/') {
      entradas.push({ nombre, metodo, tamComprimido, tam, desplazamiento })
    }
    p += 46 + largoNombre + largoExtra + largoComentario
  }
  return entradas
}

type FlujoDescompresor = { new (formato: string): unknown }

/** Saca una entrada del ZIP como Blob. */
export async function extraerDeZip(archivo: Blob, e: EntradaZip, tipo = ''): Promise<Blob> {
  const cab = await bytes(archivo.slice(e.desplazamiento, e.desplazamiento + 30))
  if (cab.byteLength < 30 || cab.getUint32(0, true) !== FIRMA_LOCAL) {
    throw new Error(`No pude leer «${e.nombre}» dentro del ZIP.`)
  }
  const inicio = e.desplazamiento + 30 + cab.getUint16(26, true) + cab.getUint16(28, true)
  const datos = archivo.slice(inicio, inicio + e.tamComprimido)
  if (e.metodo === 0) return new Blob([datos], { type: tipo })
  if (e.metodo !== 8) throw new Error(`«${e.nombre}» usa una compresión que no sé abrir.`)
  const Descompresor = (globalThis as unknown as { DecompressionStream?: FlujoDescompresor })
    .DecompressionStream
  if (!Descompresor) {
    throw new Error('Este navegador no puede abrir el ZIP. Actualízalo o usa Chrome o Safari recientes.')
  }
  const flujo = (datos.stream() as unknown as { pipeThrough: (t: unknown) => ReadableStream }).pipeThrough(
    new Descompresor('deflate-raw'),
  )
  const salida = await new Response(flujo).blob()
  return new Blob([salida], { type: tipo })
}

/** Tipo de imagen según la extensión. */
export function tipoDeImagen(nombre: string): string {
  const ext = (nombre.split('.').pop() ?? '').toLowerCase()
  if (ext === 'png') return 'image/png'
  if (ext === 'webp') return 'image/webp'
  if (ext === 'gif') return 'image/gif'
  return 'image/jpeg'
}
