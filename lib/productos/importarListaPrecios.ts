/**
 * Importar la lista de precios del proveedor a Productos: lógica pura,
 * sin React ni red, para poder probarla.
 *
 * La lista llega como CSV (una fila por renglón del proveedor). Aquí se lee,
 * se cruza con los productos que ya existen y se calcula qué cambiaría.
 * Nada se escribe: la pantalla aplica solo lo que el dueño marque.
 */

export type EstatusProveedor = 'disponible' | 'no_disponible' | 'en_transito'

export type FilaLista = {
  /** Orden en la lista (1…). */
  n: number
  pagina: number | null
  seccion: string
  marca: string
  /** Código de fábrica: la primera palabra del modelo. */
  codigo: string
  /** Modelo tal como lo escribe el proveedor (puede llevar el lente). */
  modelo: string
  descripcion: string
  precioUsd: number | null
  estatus: EstatusProveedor | null
  /** Nombre del archivo de la foto dentro del ZIP ('' si no hay). */
  foto: string
  nota: string
}

export type ProductoActual = {
  id: number
  nombre: string
  marca: string | null
  modelo: string | null
  categoria: string | null
  costo: number | null
  precio: number | null
  imagen: string | null
}

const redondear2 = (n: number) => Math.round(n * 100) / 100

/** Solo letras y números, en mayúsculas: «DS-2CE76K0T-LPFS» → «DS2CE76K0TLPFS». */
export function normalizarModelo(s: string | null | undefined): string {
  return (s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')
}

function sinAcentos(s: string): string {
  return s
    .toLowerCase()
    .replace(/[áàä]/g, 'a')
    .replace(/[éèë]/g, 'e')
    .replace(/[íìï]/g, 'i')
    .replace(/[óòö]/g, 'o')
    .replace(/[úùü]/g, 'u')
    .replace(/ñ/g, 'n')
}

/** Quién separa las columnas: coma o punto y coma (Excel en español). */
function separadorDe(texto: string): string {
  const fin = texto.search(/[\r\n]/)
  const primera = fin < 0 ? texto : texto.slice(0, fin)
  const comas = primera.split(',').length
  const puntoComas = primera.split(';').length
  return puntoComas > comas ? ';' : ','
}

/** Lee un CSV (comillas dobles, saltos dentro de comillas, BOM). */
export function leerCsv(texto: string): string[][] {
  const t = texto.charCodeAt(0) === 0xfeff ? texto.slice(1) : texto
  const sep = separadorDe(t)
  const filas: string[][] = []
  let fila: string[] = []
  let campo = ''
  let enComillas = false
  for (let i = 0; i < t.length; i++) {
    const c = t.charAt(i)
    if (enComillas) {
      if (c === '"') {
        if (t.charAt(i + 1) === '"') {
          campo += '"'
          i++
        } else enComillas = false
      } else campo += c
    } else if (c === '"') {
      enComillas = true
    } else if (c === sep) {
      fila.push(campo)
      campo = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && t.charAt(i + 1) === '\n') i++
      fila.push(campo)
      campo = ''
      filas.push(fila)
      fila = []
    } else campo += c
  }
  if (campo !== '' || fila.length > 0) {
    fila.push(campo)
    filas.push(fila)
  }
  return filas.filter((f) => f.some((x) => x.trim() !== ''))
}

/** «10.25», «10,25», «1,825.00», «1.825,00», «$ 12» → número; vacío o «-» → null. */
export function leerPrecio(raw: string | null | undefined): number | null {
  let t = (raw ?? '').replace(/[\s$]/g, '').replace(/^(usd|us)/i, '')
  if (t === '' || t === '-') return null
  const coma = t.lastIndexOf(',')
  const punto = t.lastIndexOf('.')
  if (coma >= 0 && punto >= 0) {
    // El último de los dos es el decimal.
    t = coma > punto ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '')
  } else if (coma >= 0) {
    t = /,\d{1,2}$/.test(t) ? t.replace(',', '.') : t.replace(/,/g, '')
  }
  if (!/^\d+(\.\d+)?$/.test(t)) return null
  const n = parseFloat(t)
  return Number.isFinite(n) && n >= 0 ? redondear2(n) : null
}

export function leerEstatus(raw: string | null | undefined): EstatusProveedor | null {
  const t = sinAcentos(raw ?? '').replace(/[^a-z]/g, '')
  if (t === 'disponible') return 'disponible'
  if (t === 'nodisponible' || t === 'agotado') return 'no_disponible'
  if (t === 'entransito') return 'en_transito'
  return null
}

const ALIAS: Record<string, string> = {
  n: 'n',
  pagina: 'pagina',
  seccion: 'seccion',
  marca: 'marca',
  codigo: 'codigo',
  modelo: 'modelo',
  descripcion: 'descripcion',
  precio_usd: 'precio',
  precio: 'precio',
  estatus: 'estatus',
  estado: 'estatus',
  status: 'estatus',
  foto: 'foto',
  imagen: 'foto',
  nota: 'nota',
}

export type ListaLeida = { filas: FilaLista[]; error: string | null }

/** Convierte el texto del CSV en filas de la lista. */
export function leerListaCsv(texto: string): ListaLeida {
  const tabla = leerCsv(texto)
  if (tabla.length < 2) return { filas: [], error: 'El archivo está vacío o no es una tabla.' }
  const columnas: Record<string, number> = {}
  tabla[0]!.forEach((titulo, i) => {
    const clave = ALIAS[sinAcentos(titulo).trim().replace(/\s+/g, '_')]
    if (clave && columnas[clave] === undefined) columnas[clave] = i
  })
  if (columnas.modelo === undefined && columnas.codigo === undefined) {
    return { filas: [], error: 'Falta la columna «modelo». ¿Es el archivo de la lista de precios?' }
  }
  if (columnas.precio === undefined) {
    return { filas: [], error: 'Falta la columna «precio_usd».' }
  }
  const celda = (f: string[], clave: string) => {
    const i = columnas[clave]
    return i === undefined ? '' : (f[i] ?? '').replace(/\s+/g, ' ').trim()
  }
  const filas: FilaLista[] = []
  for (let k = 1; k < tabla.length; k++) {
    const f = tabla[k]!
    const modelo = celda(f, 'modelo') || celda(f, 'codigo')
    if (!modelo) continue
    const codigo = celda(f, 'codigo') || modelo.split(' ')[0]!
    const precioUsd = leerPrecio(celda(f, 'precio'))
    const estatusLeido = leerEstatus(celda(f, 'estatus'))
    const pagina = parseInt(celda(f, 'pagina'), 10)
    filas.push({
      n: parseInt(celda(f, 'n'), 10) || k,
      pagina: Number.isFinite(pagina) ? pagina : null,
      seccion: celda(f, 'seccion'),
      marca: celda(f, 'marca'),
      codigo,
      modelo,
      descripcion: celda(f, 'descripcion'),
      precioUsd,
      // Sin columna de estatus: con precio se asume disponible.
      estatus: estatusLeido ?? (columnas.estatus === undefined && precioUsd != null ? 'disponible' : null),
      foto: celda(f, 'foto'),
      nota: celda(f, 'nota'),
    })
  }
  if (filas.length === 0) return { filas: [], error: 'No encontré ningún renglón con modelo.' }
  return { filas, error: null }
}

/** Precio que se puede usar como costo: solo si el proveedor lo tiene o viene en camino. */
export function precioUsable(f: FilaLista): number | null {
  if (f.estatus !== 'disponible' && f.estatus !== 'en_transito') return null
  return f.precioUsd != null && f.precioUsd > 0 ? f.precioUsd : null
}

export type TipoCoincidencia =
  /** El costo cambia. */
  | 'cambia'
  /** Ya tiene ese costo. */
  | 'igual'
  /** El proveedor no lo tiene: solo se anota la disponibilidad. */
  | 'sin_precio'
  /** Hay que elegir a mano cuál renglón de la lista es. */
  | 'dudoso'

export type Coincidencia = {
  producto: ProductoActual
  tipo: TipoCoincidencia
  /** Renglones de la lista que pueden ser este producto (el mejor primero). */
  opciones: FilaLista[]
  /** Índice en `opciones`; null = el dueño debe elegir. */
  elegida: number | null
  /** Por qué es dudoso ('' si no lo es). */
  motivo: string
}

export type PlanImportacion = {
  coincidencias: Coincidencia[]
  /** Renglones de la lista que no están en Productos (sin repetir modelo). */
  nuevos: FilaLista[]
}

const MIN_EXACTO = 5
const MIN_PARECIDO = 8

function sinRepetir(filas: FilaLista[]): FilaLista[] {
  const vistos: Record<number, true> = {}
  return filas.filter((f) => (vistos[f.n] ? false : (vistos[f.n] = true)))
}

function tipoDe(producto: ProductoActual, fila: FilaLista): TipoCoincidencia {
  const costo = precioUsable(fila)
  if (costo == null) return 'sin_precio'
  return producto.costo != null && Math.abs(producto.costo - costo) < 0.005 ? 'igual' : 'cambia'
}

/** Cruza la lista con los productos que ya existen. */
export function planificarImportacion(filas: FilaLista[], productos: ProductoActual[]): PlanImportacion {
  const porModelo: Record<string, FilaLista[]> = {}
  const porCodigo: Record<string, FilaLista[]> = {}
  for (const f of filas) {
    const m = normalizarModelo(f.modelo)
    const c = normalizarModelo(f.codigo)
    if (m) (porModelo[m] = porModelo[m] ?? []).push(f)
    if (c) (porCodigo[c] = porCodigo[c] ?? []).push(f)
  }
  const codigos = Object.keys(porCodigo)
  const usadas: Record<number, true> = {}
  const coincidencias: Coincidencia[] = []

  for (const producto of productos) {
    const m = normalizarModelo(producto.modelo)
    if (m.length < MIN_EXACTO) continue
    // Primero el modelo completo (más preciso); si no, el código de fábrica.
    const exactas = porModelo[m] ?? porCodigo[m] ?? []
    if (exactas.length > 0) {
      for (const f of exactas) usadas[f.n] = true
      const efectos: Record<string, true> = {}
      for (const f of exactas) efectos[`${precioUsable(f) ?? '-'}|${f.estatus ?? ''}`] = true
      if (Object.keys(efectos).length > 1) {
        coincidencias.push({
          producto,
          tipo: 'dudoso',
          opciones: exactas,
          elegida: null,
          motivo: 'La lista trae este modelo varias veces con precio o disponibilidad distintos.',
        })
      } else {
        coincidencias.push({ producto, tipo: tipoDe(producto, exactas[0]!), opciones: exactas, elegida: 0, motivo: '' })
      }
      continue
    }
    if (m.length < MIN_PARECIDO) continue
    let parecidas: FilaLista[] = []
    for (const c of codigos) {
      if (c.length < MIN_PARECIDO) continue
      if (m.indexOf(c) === 0 || c.indexOf(m) === 0) parecidas = parecidas.concat(porCodigo[c]!)
    }
    parecidas = sinRepetir(parecidas)
    if (parecidas.length === 0) continue
    parecidas.sort(
      (a, b) =>
        Math.abs(normalizarModelo(a.codigo).length - m.length) -
          Math.abs(normalizarModelo(b.codigo).length - m.length) || a.n - b.n,
    )
    coincidencias.push({
      producto,
      tipo: 'dudoso',
      opciones: parecidas,
      elegida: null,
      motivo: 'El modelo se parece al de la lista, pero no es idéntico.',
    })
  }

  // Lo que queda de la lista son productos que no tienes; un renglón por modelo.
  const elegidoPorModelo: Record<string, FilaLista> = {}
  const orden: string[] = []
  for (const f of filas) {
    if (usadas[f.n]) continue
    const clave = `${sinAcentos(f.marca)}|${normalizarModelo(f.modelo)}`
    const previo = elegidoPorModelo[clave]
    if (!previo) {
      elegidoPorModelo[clave] = f
      orden.push(clave)
    } else if (precioUsable(previo) == null && precioUsable(f) != null) {
      elegidoPorModelo[clave] = f
    }
  }
  return { coincidencias, nuevos: orden.map((k) => elegidoPorModelo[k]!) }
}

export type OpcionesImportacion = {
  /** Subir el precio de venta en la misma proporción que el costo. */
  mantenerMargen: boolean
}

export type Efecto = {
  costo: number | null
  precio: number | null
  utilidad: number | null
  cambiaCosto: boolean
  cambiaPrecio: boolean
  disponibilidad: EstatusProveedor | null
  /** El costo queda por encima del precio de venta. */
  vendeBajoCosto: boolean
}

/** Qué le pasaría a un producto si se le aplica un renglón de la lista. */
export function efectoEnProducto(p: ProductoActual, f: FilaLista, opciones: OpcionesImportacion): Efecto {
  const costoLista = precioUsable(f)
  const cambiaCosto = costoLista != null && (p.costo == null || Math.abs(p.costo - costoLista) >= 0.005)
  const costo = costoLista != null ? costoLista : p.costo
  let precio = p.precio
  let cambiaPrecio = false
  if (
    opciones.mantenerMargen &&
    cambiaCosto &&
    costoLista != null &&
    p.costo != null &&
    p.costo > 0 &&
    p.precio != null &&
    p.precio > 0
  ) {
    const nuevo = redondear2((costoLista * p.precio) / p.costo)
    cambiaPrecio = Math.abs(nuevo - p.precio) >= 0.005
    precio = nuevo
  }
  return {
    costo,
    precio,
    utilidad: costo != null && precio != null ? redondear2(precio - costo) : null,
    cambiaCosto,
    cambiaPrecio,
    disponibilidad: f.estatus,
    vendeBajoCosto: costo != null && precio != null && precio > 0 && costo > precio,
  }
}

/** Columnas que se escriben en `products` al aplicar un renglón a un producto. */
export function cambioParaProducto(
  p: ProductoActual,
  f: FilaLista,
  opciones: OpcionesImportacion,
  fechaLista: string,
  ahoraIso: string,
): Record<string, string | number | null> {
  const e = efectoEnProducto(p, f, opciones)
  const cambio: Record<string, string | number | null> = {
    disponibilidad_proveedor: e.disponibilidad,
    lista_proveedor_fecha: fechaLista,
    modificado: ahoraIso,
  }
  if (e.cambiaCosto) cambio.costo = e.costo
  if (e.cambiaPrecio) cambio.precio = e.precio
  if (e.cambiaCosto || e.cambiaPrecio) cambio.utilidad = e.utilidad
  return cambio
}

/** Nombre corto para un producto nuevo, sacado de la descripción del proveedor. */
export function nombreDesdeDescripcion(descripcion: string, modelo: string, max = 90): string {
  const d = descripcion.replace(/\s+/g, ' ').trim()
  if (!d) return modelo
  if (d.length <= max) return d
  const corte = d.slice(0, max + 1)
  const coma = corte.lastIndexOf(',')
  const punto = corte.lastIndexOf('. ')
  const espacio = corte.lastIndexOf(' ')
  const hasta = Math.max(coma, punto) >= max * 0.5 ? Math.max(coma, punto) : espacio > 0 ? espacio : max
  return d.slice(0, hasta).replace(/[\s,.;:(-]+$/, '')
}

/** Categoría del catálogo que mejor le va a una sección de la lista. */
export function categoriaSugerida(seccion: string): string {
  const s = sinAcentos(seccion)
  if (/switch|router|access point|sfp|utp|metalmecanica|conector/.test(s)) return 'Network'
  if (/dvr|nvr|kit cctv|disco|video balun/.test(s)) return 'C.C.T.V'
  if (/camara.* ip|solucion ip|termica|kit solar|unifi/.test(s)) return 'Cámaras IP'
  if (/turbo|colorvu|smart hybrid|serie iot|audio bidireccional/.test(s)) return 'Cámaras Análogas'
  return 'C.C.T.V'
}

/** Fila para crear en `products` un producto que no existía. */
export function productoNuevoDesdeFila(
  f: FilaLista,
  categoria: string,
  fechaLista: string,
  ahoraIso: string,
): Record<string, string | number | null> {
  return {
    nombre: nombreDesdeDescripcion(f.descripcion, f.modelo),
    modelo: f.modelo,
    marca: f.marca || null,
    categoria: categoria || categoriaSugerida(f.seccion),
    descripcion: f.descripcion || null,
    costo: precioUsable(f),
    precio: null,
    utilidad: null,
    cantidad: 0,
    disponibilidad_proveedor: f.estatus,
    lista_proveedor_fecha: fechaLista,
    modificado: ahoraIso,
  }
}

export type ResumenPlan = {
  cambian: number
  iguales: number
  sinPrecio: number
  dudosos: number
  nuevos: number
}

export function resumirPlan(plan: PlanImportacion): ResumenPlan {
  const cuenta = (t: TipoCoincidencia) => plan.coincidencias.filter((c) => c.tipo === t).length
  return {
    cambian: cuenta('cambia'),
    iguales: cuenta('igual'),
    sinPrecio: cuenta('sin_precio'),
    dudosos: cuenta('dudoso'),
    nuevos: plan.nuevos.length,
  }
}
