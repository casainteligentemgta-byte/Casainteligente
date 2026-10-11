/**
 * Leer la lista de precios del proveedor desde un PDF: lógica pura.
 *
 * El navegador saca del PDF los trozos de texto con su posición
 * (`lib/productos/extraerTextoPdf.ts`); aquí se arman las líneas, se localiza la tabla y
 * se devuelven los mismos renglones que da el CSV (`FilaLista`), para que pasen por la
 * misma revisión antes de guardar nada.
 *
 * Cada proveedor arma su PDF a su manera, así que esto no adivina: busca el encabezado de
 * la tabla (modelo / precio / descripción…) y reparte cada celda en su columna por
 * posición. Si no hay encabezado, toma de cada línea el modelo y el último precio. Lo que
 * no parece un producto se cuenta aparte para que el dueño lo vea.
 */
import { leerPrecio, type EstatusProveedor, type FilaLista, type ListaLeida } from './importarListaPrecios'
import type { ImagenPdf, UbicacionFila } from './fotosListaPdf'

/** Un trozo de texto del PDF. `y` crece hacia abajo; `x`,`w`,`h` en puntos de página. */
export type TrozoPdf = { str: string; x: number; y: number; w: number; h: number }

export type PaginaPdf = {
  numero: number
  trozos: TrozoPdf[]
  /** Dónde está cada imagen de la página (para sacar la foto de cada producto). */
  imagenes?: ImagenPdf[]
  ancho?: number
  alto?: number
}

export type DiagnosticoPdf = {
  paginas: number
  /** Título de la columna de la que se tomó el precio ('' si no hubo encabezado). */
  columnaPrecio: string
  /** Hubo que leer sin encabezado (modelo + último precio de cada línea). */
  sinEncabezado: boolean
  /** Líneas con texto que no eran productos (títulos, pies de página…). */
  lineasSinUsar: number
  /** El PDF no trae texto: es una foto o un escaneo. */
  esImagen: boolean
}

export type ListaPdfLeida = ListaLeida & {
  diagnostico: DiagnosticoPdf
  /** A qué altura de su página quedó cada renglón (para darle su foto). */
  ubicaciones: UbicacionFila[]
}

type Parte = { texto: string; x: number; fin: number }
/** `partes`: los trozos del PDF que forman la celda, por si hay que volver a separarla. */
type Celda = { texto: string; x: number; fin: number; h: number; partes?: Parte[]; /** Alto de su letra más pequeña. */ hMin?: number }
type Linea = { y: number; h: number; celdas: Celda[] }

type Columna = 'modelo' | 'descripcion' | 'precio' | 'estatus' | 'marca' | 'otra'
type ColumnaTabla = { tipo: Columna; titulo: string; x: number; fin: number; prioridad: number }

function sinAcentos(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

/**
 * Junta los trozos en líneas y, dentro de la línea, en celdas (texto pegado).
 * Dos trozos están en la misma línea si comparten la línea base (el pie de la letra):
 * así un modelo centrado entre dos líneas de descripción no se mezcla con ellas, y una
 * letra suelta más alta (un superíndice, un título) no arrastra a las líneas vecinas.
 */
export function lineasDePagina(trozos: readonly TrozoPdf[]): Linea[] {
  const utiles = trozos
    .filter((t) => t.str.trim() !== '')
    .map((t) => ({ ...t, h: t.h > 0 ? t.h : 8 }))
    .sort((a, b) => a.y + a.h - (b.y + b.h) || a.x - b.x)

  const lineas: Array<{ base: number; h: number; trozos: TrozoPdf[] }> = []
  for (const t of utiles) {
    const base = t.y + t.h
    const actual = lineas[lineas.length - 1]
    if (actual && Math.abs(base - actual.base) <= Math.min(actual.h, t.h) * 0.3) {
      actual.trozos.push(t)
      // La altura de la línea es la de su letra más común, no la del trozo más alto.
      actual.h = Math.min(actual.h, t.h)
    } else {
      lineas.push({ base, h: t.h, trozos: [t] })
    }
  }

  return lineas.map((l) => {
    const orden = [...l.trozos].sort((a, b) => a.x - b.x)
    const celdas: Celda[] = []
    for (const t of orden) {
      const previa = celdas[celdas.length - 1]
      const hueco = previa ? t.x - previa.fin : Infinity
      // Un hueco como el de un espacio es la misma celda; mayor, puede ser otra columna
      // (las celdas de una misma columna se vuelven a juntar al repartirlas).
      // Letras de tamaño muy distinto no son la misma celda (un rótulo grande que pisa la tabla).
      const mismoTamano = previa ? Math.max(previa.h, t.h) <= Math.min(previa.hMin ?? previa.h, t.h) * 1.4 : false
      if (previa && mismoTamano && hueco <= Math.max(previa.h, t.h) * 0.45) {
        previa.texto += (hueco > Math.max(previa.h, t.h) * 0.15 && !previa.texto.endsWith(' ') ? ' ' : '') + t.str
        previa.fin = Math.max(previa.fin, t.x + t.w)
        previa.h = Math.max(previa.h, t.h)
        previa.hMin = Math.min(previa.hMin ?? t.h, t.h)
        previa.partes!.push({ texto: t.str, x: t.x, fin: t.x + t.w })
      } else {
        celdas.push({ texto: t.str, x: t.x, fin: t.x + t.w, h: t.h, hMin: t.h, partes: [{ texto: t.str, x: t.x, fin: t.x + t.w }] })
      }
    }
    return {
      y: l.base,
      h: l.h,
      celdas: celdas.map((c) => ({ ...c, texto: c.texto.replace(/\s+/g, ' ').trim() })).filter((c) => c.texto !== ''),
    }
  })
}

/** ¿Qué columna anuncia este título? `prioridad` desempata entre varias de precio. */
function tipoDeTitulo(titulo: string): { tipo: Columna; prioridad: number } {
  const t = sinAcentos(titulo).replace(/[^a-z0-9$/ ]/g, ' ').replace(/\s+/g, ' ').trim()
  if (/^(modelo|model|codigo|cod|sku|referencia|ref|parte|n ?de ?parte|no ?parte|numero de parte|part ?number|part ?no|p\/n|item|articulo)( .*)?$/.test(t)) {
    return { tipo: 'modelo', prioridad: /modelo|model|sku|parte|part|p\/n/.test(t) ? 2 : 1 }
  }
  if (/(precio|price|usd|\$|costo|cost|pvp|tarifa|valor|importe|neto|lista|instalador|distribuidor|mayorista|mayoreo|integrador|dealer|partner|reseller)/.test(t)) {
    // Lo que paga la empresa pesa más que el precio sugerido al público.
    if (/(pvp|publico|sugerido|venta|retail|msrp|final)/.test(t)) return { tipo: 'precio', prioridad: 1 }
    if (/(instalador|distribuidor|mayor|integrador|costo|cost|neto|dealer|partner|reseller)/.test(t)) return { tipo: 'precio', prioridad: 3 }
    return { tipo: 'precio', prioridad: 2 }
  }
  if (/(descripcion|description|producto|nombre|detalle|caracteristica|especificacion)/.test(t)) {
    return { tipo: 'descripcion', prioridad: 1 }
  }
  if (/(estatus|status|estado|disponib|stock|existencia|inventario)/.test(t)) return { tipo: 'estatus', prioridad: 1 }
  if (/(marca|brand|fabricante)/.test(t)) return { tipo: 'marca', prioridad: 1 }
  return { tipo: 'otra', prioridad: 0 }
}

/** Si la línea es el encabezado de la tabla, sus columnas; si no, `null`. */
export function encabezadoDeLinea(linea: Linea): ColumnaTabla[] | null {
  if (linea.celdas.length < 2) return null
  const columnas = linea.celdas.map((c) => ({ ...tipoDeTitulo(c.texto), titulo: c.texto, x: c.x, fin: c.fin }))
  const hayModelo = columnas.some((c) => c.tipo === 'modelo')
  const hayPrecio = columnas.some((c) => c.tipo === 'precio')
  // Un título es corto: una frase larga con la palabra «precio» no es un encabezado.
  const titulosCortos = linea.celdas.every((c) => c.texto.length <= 40)
  return hayModelo && hayPrecio && titulosCortos ? columnas : null
}

/**
 * Límites de cada columna, medidos sobre los datos y no solo sobre los títulos: un título
 * puede estar centrado y sus valores alineados a la izquierda o a la derecha.
 * Cada celda de la tabla se asigna al título con el que más se solapa (o al más cercano)
 * y la columna se estira hasta cubrir todas sus celdas.
 */
function indiceColumna(celda: Celda, columnas: readonly { x: number; fin: number }[]): number {
  let mejor = 0
  let mejorPuntos = -Infinity
  columnas.forEach((c, i) => {
    const solape = Math.min(celda.fin, c.fin) - Math.max(celda.x, c.x)
    // Con solape gana el mayor; sin solape, el título más cercano (puntos negativos).
    const puntos = solape > 0 ? solape : -Math.max(c.x - celda.fin, celda.x - c.fin)
    if (puntos > mejorPuntos) {
      mejorPuntos = puntos
      mejor = i
    }
  })
  return mejor
}

type Tramo = { x: number; fin: number }

/**
 * Franjas verticales de la página donde hay texto, separadas por los «ríos» en blanco que
 * deja la cuadrícula de la tabla. Se tolera que alguna línea suelta cruce un río (un título
 * centrado, una nota al pie).
 */
function franjasConTexto(lineas: readonly Linea[]): Tramo[] {
  // Se mide sobre los trozos sueltos: un modelo largo que llega hasta tocar la descripción
  // forma una sola celda, pero entre sus dos trozos sigue estando el río.
  const celdas: Tramo[] = lineas.flatMap((l) => l.celdas.flatMap((c) => (c.partes && c.partes.length > 0 ? c.partes : [c])))
  if (celdas.length === 0) return []
  const tolerancia = Math.max(1, Math.floor(lineas.length * 0.03))
  const cortes = Array.from(new Set(celdas.flatMap((c) => [c.x, c.fin]))).sort((a, b) => a - b)
  const franjas: Tramo[] = []
  for (let i = 0; i + 1 < cortes.length; i++) {
    const desde = cortes[i]!
    const hasta = cortes[i + 1]!
    const medio = (desde + hasta) / 2
    const cubren = celdas.reduce((n, c) => (c.x <= medio && c.fin >= medio ? n + 1 : n), 0)
    if (cubren <= tolerancia) continue
    const previa = franjas[franjas.length - 1]
    if (previa && desde - previa.fin < 1.5) previa.fin = hasta
    else franjas.push({ x: desde, fin: hasta })
  }
  return franjas
}

/**
 * Dónde cae de verdad cada columna. El título puede estar centrado y sus valores alineados
 * a la izquierda («DESCRIPCION» en medio de una celda ancha): si se repartiera por el título,
 * el principio de la descripción acabaría en la columna del modelo. Por eso cada columna
 * toma la franja de texto que queda bajo su título; una franja sin título es de la columna
 * vecina que todavía no tiene la suya.
 *
 * Devuelve también las franjas que quedan fuera de la tabla (los números de fila que Excel
 * imprime a la izquierda).
 */
export function tramosDeColumnas(lineas: readonly Linea[], columnas: readonly Tramo[]): { tramos: Tramo[]; fuera: Tramo[] } {
  const franjas = franjasConTexto(lineas)
  const propias: Tramo[][] = columnas.map(() => [])
  const sinTitulo: Tramo[] = []
  for (const f of franjas) {
    const debajo = columnas.map((c, i) => (Math.min(f.fin, c.fin) - Math.max(f.x, c.x) > 0 ? i : -1)).filter((i) => i >= 0)
    if (debajo.length === 1) propias[debajo[0]!]!.push(f)
    else if (debajo.length === 0) sinTitulo.push(f)
    // Una franja bajo dos títulos no separa nada: esas columnas se reparten por el título.
  }

  const fuera: Tramo[] = []
  const primerTitulo = Math.min(...columnas.map((c) => c.x))
  const distancia = (f: Tramo, c: Tramo) => Math.max(c.x - f.fin, f.x - c.fin, 0)
  for (const f of sinTitulo) {
    if (f.fin <= primerTitulo) {
      const textos = lineas.flatMap((l) => l.celdas.filter((c) => c.x >= f.x - 0.5 && c.fin <= f.fin + 0.5).map((c) => c.texto))
      if (textos.length > 0 && textos.every((t) => /^\d{1,5}$/.test(t))) {
        fuera.push(f)
        continue
      }
    }
    // Primero las columnas que aún no tienen franja; si todas tienen, la más cercana.
    const libres = columnas.map((_, i) => i).filter((i) => propias[i]!.length === 0)
    const candidatas = libres.length > 0 ? libres : columnas.map((_, i) => i)
    const destino = candidatas.reduce((m, i) => (distancia(f, columnas[i]!) < distancia(f, columnas[m]!) ? i : m))
    propias[destino]!.push(f)
  }

  const tramos = columnas.map((c, i) => {
    const suyas = propias[i]!
    if (suyas.length === 0) return { x: c.x, fin: c.fin }
    return { x: Math.min(...suyas.map((f) => f.x)), fin: Math.max(...suyas.map((f) => f.fin)) }
  })
  return { tramos, fuera }
}

/**
 * Un texto largo puede llegar hasta tocar la columna siguiente y quedar pegado a ella en una
 * sola celda («CS-ABC(2K 4GA)» + «BIDIRECCIONAL, …»). Si uno de sus trozos empieza justo
 * donde empieza otra columna, la celda se parte ahí.
 */
function separarPorColumnas(celdas: readonly Celda[], tramos: readonly Tramo[]): Celda[] {
  const salida: Celda[] = []
  for (const celda of celdas) {
    const partes = celda.partes ?? []
    if (partes.length < 2) {
      salida.push(celda)
      continue
    }
    let grupo: Parte[] = []
    const cerrar = () => {
      if (grupo.length === 0) return
      let texto = ''
      grupo.forEach((p, i) => {
        const hueco = i > 0 ? p.x - grupo[i - 1]!.fin : 0
        texto += (i > 0 && hueco > celda.h * 0.15 && !texto.endsWith(' ') ? ' ' : '') + p.texto
      })
      texto = texto.replace(/\s+/g, ' ').trim()
      if (texto) salida.push({ texto, x: grupo[0]!.x, fin: Math.max(...grupo.map((p) => p.fin)), h: celda.h, hMin: celda.hMin, partes: grupo })
      grupo = []
    }
    for (const parte of partes) {
      const empiezaColumna = grupo.length > 0 && tramos.some((t) => Math.abs(parte.x - t.x) <= 1.5 && grupo[0]!.x < t.x - 2)
      if (empiezaColumna) cerrar()
      grupo.push(parte)
    }
    cerrar()
  }
  return salida
}

/** Reparte las celdas de una línea en las columnas del encabezado, por posición. */
function repartir(linea: Linea, columnas: readonly Tramo[]): string[] {
  const valores = columnas.map(() => '')
  for (const celda of linea.celdas) {
    const i = indiceColumna(celda, columnas)
    valores[i] = valores[i] ? `${valores[i]} ${celda.texto}` : celda.texto
  }
  return valores
}

/** «Disponible», «Agotado», «En tránsito», «Sin stock», «0», «25»… */
export function leerEstatusPdf(raw: string | null | undefined): EstatusProveedor | null {
  const t = sinAcentos(raw ?? '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
  if (!t) return null
  if (/(no disponible|agotad|sin stock|sin existencia|no hay|descontinuad|out of stock)/.test(t)) return 'no_disponible'
  if (/(transito|por llegar|en camino|backorder|proxim)/.test(t)) return 'en_transito'
  if (/(disponible|en stock|existencia|in stock|inmediat)/.test(t)) return 'disponible'
  if (/^\d+$/.test(t)) return Number(t) > 0 ? 'disponible' : 'no_disponible'
  if (t === 'si' || t === 'yes') return 'disponible'
  if (t === 'no') return 'no_disponible'
  return null
}

/**
 * ¿Parece el título de una sección («CÁMARAS IP», «Cableado estructurado»)? Corto, empieza
 * en mayúscula o número y no termina como una frase: así el final suelto de una descripción
 * («…sirena, H.265.») no se toma por título.
 */
export function pareceTituloDeSeccion(texto: string): boolean {
  const t = texto.trim()
  if (t.length < 3 || t.length > 70) return false
  if (t.split(/\s+/).length > 8) return false
  if (/[.,;:]$/.test(t)) return false
  if (/^\d+$/.test(t) || /p[aá]gina|page|\bde \d+$/i.test(t)) return false
  return /^[A-ZÁÉÍÓÚÑ0-9¿¡(]/.test(t)
}

/**
 * Un modelo largo puede venir partido en dos o tres líneas dentro de su celda
 * («CS-H8c-R100-» / «1J4WKFL(4mm)(US-» / «STD)(Mu)»). Se vuelve a unir: sin espacio si el
 * corte fue en un guion o un paréntesis, con espacio si fue entre palabras.
 */
export function unirModelo(partes: readonly string[]): string {
  let modelo = ''
  for (const cruda of partes) {
    const parte = cruda.trim()
    if (!parte) continue
    if (!modelo) modelo = parte
    else if (/[-/(_]$/.test(modelo) || /^[)\-/_]/.test(parte)) modelo += parte
    else modelo += ` ${parte}`
  }
  return modelo
}

/** ¿Parece un modelo de fábrica? Sin espacios raros, con algún número o guion, 3+ caracteres. */
function pareceModelo(texto: string): boolean {
  const t = texto.trim()
  if (t.length < 3 || t.length > 60) return false
  if (!/^[A-Za-z0-9][A-Za-z0-9\-_/.+()# ]*$/.test(t)) return false
  if (t.split(' ').length > 4) return false
  return /\d/.test(t) || /[-_/]/.test(t)
}

/** ¿La celda es un precio escrito como precio? (con decimales, o con «$» / «USD»). */
function parecePrecio(texto: string): boolean {
  const t = texto.trim()
  if (!/^(usd|us)?\s*\$?\s*\d[\d.,]*\s*(usd|\$)?$/i.test(t)) return false
  return /[.,]\d{2}\s*(usd|\$)?$/i.test(t) || /\$|usd/i.test(t)
}

function filaDesde(
  n: number,
  pagina: number,
  seccion: string,
  marca: string,
  modelo: string,
  descripcion: string,
  precioTexto: string,
  estatusTexto: string,
  hayColumnaEstatus: boolean,
): FilaLista {
  const precioUsd = leerPrecio(precioTexto.replace(/usd/gi, ''))
  const estatus =
    leerEstatusPdf(estatusTexto) ??
    leerEstatusPdf(precioTexto) ??
    (!hayColumnaEstatus && precioUsd != null ? 'disponible' : null)
  return {
    n,
    pagina,
    seccion,
    marca,
    codigo: modelo.split(' ')[0] ?? modelo,
    modelo,
    descripcion,
    precioUsd,
    estatus,
    foto: '',
    nota: '',
  }
}

/** Convierte las páginas del PDF en renglones de la lista. */
export function leerListaPdf(paginas: readonly PaginaPdf[]): ListaPdfLeida {
  const diagnostico: DiagnosticoPdf = {
    paginas: paginas.length,
    columnaPrecio: '',
    sinEncabezado: false,
    lineasSinUsar: 0,
    esImagen: false,
  }
  const porPagina = paginas.map((p) => ({ numero: p.numero, lineas: lineasDePagina(p.trozos) }))
  const totalLineas = porPagina.reduce((s, p) => s + p.lineas.length, 0)
  if (totalLineas === 0) {
    diagnostico.esImagen = true
    return {
      filas: [],
      error:
        'Este PDF no trae texto: es una foto o un escaneo. Pide al proveedor el PDF original (el que se puede copiar y pegar) o la lista en Excel.',
      diagnostico,
      ubicaciones: [],
    }
  }

  const hayEncabezado = porPagina.some((p) => p.lineas.some((l) => encabezadoDeLinea(l)))
  const filas: FilaLista[] = []
  const ubicaciones: UbicacionFila[] = []
  let columnas: ColumnaTabla[] | null = null
  let seccion = ''

  if (hayEncabezado) {
    for (const pagina of porPagina) {
      // Lo que está por encima del encabezado de la página es membrete (título, fecha…).
      const iCabecera = pagina.lineas.findIndex((l) => encabezadoDeLinea(l) != null)
      if (iCabecera >= 0) columnas = encabezadoDeLinea(pagina.lineas[iCabecera]!)
      if (!columnas) {
        diagnostico.lineasSinUsar += pagina.lineas.length
        continue
      }
      const cols: ColumnaTabla[] = columnas
      const mejor = (tipo: Columna): number => {
        let idx = -1
        cols.forEach((c, i) => {
          if (c.tipo === tipo && (idx < 0 || c.prioridad > cols[idx]!.prioridad)) idx = i
        })
        return idx
      }
      const iModelo = mejor('modelo')
      const iPrecio = mejor('precio')
      const iDescr = mejor('descripcion')
      const iEstatus = mejor('estatus')
      const iMarca = mejor('marca')
      const delCuerpo = pagina.lineas.filter((l, i) => i > iCabecera && !encabezadoDeLinea(l))
      // Los números de fila que Excel imprime a la izquierda no son de la tabla.
      const { tramos, fuera } = tramosDeColumnas(delCuerpo, cols)
      const estaFuera = (c: Celda) => fuera.some((f) => c.x >= f.x - 0.5 && c.fin <= f.fin + 0.5)
      // Un título de sección se distingue del resto: letra más grande que la de la tabla, o
      // arranca en la primera columna y se mete en la de al lado.
      const altos = delCuerpo.map((l) => l.h).sort((a, b) => a - b)
      const altoMediano = altos.length > 0 ? altos[Math.floor(altos.length / 2)]! : 8
      // La letra más grande de los renglones con precio o estatus: un título es mayor que esa.
      const altoCuerpo = delCuerpo.reduce((max, l) => {
        const celdas = l.celdas.filter((c) => !estaFuera(c))
        if (!celdas.some((c) => parecePrecio(c.texto) || leerEstatusPdf(c.texto) != null)) return max
        return Math.max(max, ...celdas.map((c) => c.hMin ?? c.h))
      }, altoMediano)
      const letraGrande = (c: Celda) => (c.hMin ?? c.h) >= altoCuerpo * 1.15
      const inicios = tramos.map((t) => t.x).sort((a, b) => a - b)
      const esTituloSuelto = (c: Celda): boolean => {
        if (!pareceTituloDeSeccion(c.texto) || parecePrecio(c.texto) || leerEstatusPdf(c.texto) != null) return false
        if (letraGrande(c)) return true
        const pisadas = tramos.filter((t) => Math.min(c.fin, t.fin) - Math.max(c.x, t.x) >= 3).length
        return inicios.length > 1 && c.x < inicios[1]! - 1 && pisadas >= 2
      }
      const titulos: Array<{ y: number; texto: string }> = []

      /** Un renglón de la lista: la línea que trae el precio o el estatus. */
      type Ancla = { y: number; h: number; precio: string; estatus: string; marca: string }
      type Trozo = { y: number; h: number; texto: string; sola: boolean }
      const anclas: Ancla[] = []
      const trozosModelo: Trozo[] = []
      const trozosDescr: Trozo[] = []
      const trozosEstatus: Array<Trozo & { marca: string }> = []

      pagina.lineas.forEach((lineaCompleta, iLinea) => {
        if (iLinea <= iCabecera) {
          if (iLinea < iCabecera) diagnostico.lineasSinUsar += 1
          return
        }
        if (encabezadoDeLinea(lineaCompleta)) return
        const delaTabla = separarPorColumnas(lineaCompleta.celdas.filter((c) => !estaFuera(c)), tramos)
        if (delaTabla.length === 0) return
        if (delaTabla.length === 1 && esTituloSuelto(delaTabla[0]!)) {
          titulos.push({ y: lineaCompleta.y, texto: delaTabla[0]!.texto })
          return
        }
        // Un rótulo en letra grande que cae a la altura de un renglón (el título que Excel
        // repite en cada hoja) no es parte de ese renglón.
        const rotulos = delaTabla.filter((c) => letraGrande(c) && esTituloSuelto(c))
        for (const r of rotulos) titulos.push({ y: lineaCompleta.y, texto: r.texto })
        const linea: Linea = { ...lineaCompleta, celdas: delaTabla.filter((c) => !rotulos.includes(c)) }
        if (linea.celdas.length === 0) return
        const valores = repartir(linea, tramos)
        const modelo = (valores[iModelo] ?? '').trim()
        const precioTexto = (valores[iPrecio] ?? '').trim()
        const estatusTexto = iEstatus >= 0 ? (valores[iEstatus] ?? '').trim() : ''
        const descripcion = iDescr >= 0 ? (valores[iDescr] ?? '').trim() : ''
        const texto = linea.celdas.map((c) => c.texto).join(' ')
        const esPie = /^\d+$/.test(texto) || /p[aá]gina|page|\bde \d+$/i.test(texto)
        if (esPie) {
          diagnostico.lineasSinUsar += 1
          return
        }

        const marca = iMarca >= 0 ? (valores[iMarca] ?? '').trim() : ''
        const tienePrecio = leerPrecio(precioTexto.replace(/usd/gi, '')) != null
        // «Agotado» o un guion escritos en la casilla del precio también marcan un renglón.
        const esAncla = tienePrecio || (precioTexto !== '' && leerEstatusPdf(precioTexto) != null) || /^[-–—]+$/.test(precioTexto)
        if (esAncla) anclas.push({ y: linea.y, h: linea.h, precio: precioTexto, estatus: '', marca })
        const sola = linea.celdas.length === 1
        if (modelo) trozosModelo.push({ y: linea.y, h: linea.h, texto: modelo, sola })
        if (descripcion) trozosDescr.push({ y: linea.y, h: linea.h, texto: descripcion, sola })
        if (estatusTexto) trozosEstatus.push({ y: linea.y, h: linea.h, texto: estatusTexto, sola, marca })
        if (!esAncla && !modelo && !descripcion && !estatusTexto) diagnostico.lineasSinUsar += 1
      })

      // El estatus va con el precio de su misma línea; si se partió en dos («NO» / «DISPONIBLE»),
      // sus mitades quedan justo encima y debajo. Un estatus sin precio cerca es un renglón sin
      // precio (un producto «en tránsito» al que el proveedor aún no le puso precio).
      trozosEstatus.sort((a, b) => a.y - b.y)
      const conPrecio = [...anclas]
      let sinPrecio: Ancla | null = null
      for (const t of trozosEstatus) {
        const cercana = conPrecio.reduce<Ancla | null>((m, a) => (m == null || Math.abs(a.y - t.y) < Math.abs(m.y - t.y) ? a : m), null)
        if (cercana && Math.abs(cercana.y - t.y) <= Math.min(cercana.h, t.h)) {
          cercana.estatus = cercana.estatus ? `${cercana.estatus} ${t.texto}` : t.texto
        } else if (sinPrecio && t.y - sinPrecio.y <= t.h * 1.6) {
          sinPrecio.estatus = `${sinPrecio.estatus} ${t.texto}`
        } else if (leerEstatusPdf(t.texto) != null) {
          sinPrecio = { y: t.y, h: t.h, precio: '', estatus: t.texto, marca: t.marca }
          anclas.push(sinPrecio)
        } else {
          diagnostico.lineasSinUsar += 1
        }
      }

      if (anclas.length === 0) {
        diagnostico.lineasSinUsar += trozosModelo.length + trozosDescr.length
        // Una página que solo trae el título de la sección: vale para la siguiente.
        if (titulos.length > 0) seccion = titulos[titulos.length - 1]!.texto
        continue
      }
      anclas.sort((a, b) => a.y - b.y)
      const altoTipico = anclas.map((a) => a.h).sort((a, b) => a - b)[Math.floor(anclas.length / 2)]!
      const secciones: Array<{ y: number; texto: string }> = [...titulos]

      /**
       * Cuelga cada trozo de texto de una columna del renglón (ancla) al que pertenece.
       * Los trozos de una misma celda van seguidos, con el paso de una línea; entre una celda
       * y la siguiente hay un hueco mayor. Cada grupo apretado es de la ancla que cae dentro.
       */
      const colgar = (trozos: Trozo[], esDescripcion: boolean): Map<Ancla, Trozo[]> => {
        const mapa = new Map<Ancla, Trozo[]>()
        const poner = (ancla: Ancla, t: Trozo) => mapa.set(ancla, [...(mapa.get(ancla) ?? []), t])
        const orden = [...trozos].sort((a, b) => a.y - b.y)
        const pasos: number[] = []
        for (let i = 1; i < orden.length; i++) {
          const d = orden[i]!.y - orden[i - 1]!.y
          if (d > 0.5) pasos.push(d)
        }
        pasos.sort((a, b) => a - b)
        // Paso entre líneas de una misma celda: el más corto que se repite (cuartil bajo).
        const paso = pasos.length > 0 ? pasos[Math.floor(pasos.length * 0.25)]! : altoTipico * 1.25
        const corte = Math.max(paso * 1.6, altoTipico * 0.9)

        const grupos: Trozo[][] = []
        for (const t of orden) {
          const grupo = grupos[grupos.length - 1]
          const previo = grupo ? grupo[grupo.length - 1]! : null
          if (grupo && previo && t.y - previo.y <= corte) grupo.push(t)
          else grupos.push([t])
        }

        // Dos celdas que se tocan (un texto que no cabía en su fila) forman un solo grupo con dos
        // precios dentro. Las líneas de una misma celda van a paso parejo: donde el paso se
        // rompe empieza la celda siguiente.
        const anclasEn = (grupo: Trozo[]) =>
          anclas.filter((a) => a.y >= grupo[0]!.y - paso * 0.75 && a.y <= grupo[grupo.length - 1]!.y + paso * 0.75).length
        for (let g = 0; g < grupos.length; g++) {
          const grupo = grupos[g]!
          if (grupo.length < 3 || anclasEn(grupo) < 2) continue
          const partes: Trozo[][] = [[grupo[0]!]]
          for (let i = 1; i < grupo.length; i++) {
            const d = grupo[i]!.y - grupo[i - 1]!.y
            if (d > 0.5 && Math.abs(d - paso) > paso * 0.2) partes.push([grupo[i]!])
            else partes[partes.length - 1]!.push(grupo[i]!)
          }
          if (partes.length > 1) {
            grupos.splice(g, 1, ...partes)
            g += partes.length - 1
          }
        }

        // ¿Tabla centrada en vertical (como sale de Excel)? El texto empieza antes de la línea del precio.
        let empiezanAntes = 0
        for (const grupo of grupos) {
          const dentro = anclas.filter((a) => a.y >= grupo[0]!.y - paso * 0.75 && a.y <= grupo[grupo.length - 1]!.y + paso * 0.75)
          if (dentro.length === 1 && dentro[0]!.y - grupo[0]!.y > paso * 0.4) empiezanAntes += 1
        }
        const centrada = empiezanAntes >= Math.max(2, anclas.length * 0.08)

        for (const grupo of grupos) {
          const arriba = grupo[0]!.y
          const abajo = grupo[grupo.length - 1]!.y
          const dentro = anclas.filter((a) => a.y >= arriba - paso * 0.75 && a.y <= abajo + paso * 0.75)
          if (dentro.length === 1) {
            for (const t of grupo) poner(dentro[0]!, t)
            continue
          }
          if (dentro.length === 0) {
            // Texto sin precio cerca: un título de sección, la cola de una celda, o nada.
            const cercana = anclas.reduce((m, a) => (Math.min(Math.abs(a.y - arriba), Math.abs(a.y - abajo)) < Math.min(Math.abs(m.y - arriba), Math.abs(m.y - abajo)) ? a : m))
            const distancia = Math.min(Math.abs(cercana.y - arriba), Math.abs(cercana.y - abajo))
            if (esDescripcion && grupo.length === 1 && grupo[0]!.sola && pareceTituloDeSeccion(grupo[0]!.texto) && distancia > paso * 1.2) {
              secciones.push({ y: arriba, texto: grupo[0]!.texto })
            } else if (distancia <= corte * 1.4) {
              for (const t of grupo) poner(cercana, t)
            } else if (esDescripcion && grupo.length === 1 && grupo[0]!.sola && pareceTituloDeSeccion(grupo[0]!.texto)) {
              secciones.push({ y: arriba, texto: grupo[0]!.texto })
            } else {
              diagnostico.lineasSinUsar += grupo.length
            }
            continue
          }
          // Varios renglones pegados (tabla sin aire entre filas): se reparte trozo a trozo.
          for (const t of grupo) {
            const previa = [...dentro].reverse().find((a) => a.y <= t.y + paso * 0.4)
            const siguiente = dentro.find((a) => a.y > t.y + paso * 0.4)
            if (previa && (!centrada || !siguiente || t.y - previa.y <= siguiente.y - t.y)) poner(previa, t)
            else if (siguiente && (centrada || !previa)) poner(siguiente, t)
            else diagnostico.lineasSinUsar += 1
          }
        }
        return mapa
      }

      const modelos = colgar(trozosModelo, false)
      const descripciones = colgar(trozosDescr, true)
      secciones.sort((a, b) => a.y - b.y)

      for (const ancla of anclas) {
        const titulo = [...secciones].reverse().find((sec) => sec.y <= ancla.y)
        if (titulo) seccion = titulo.texto
        const modelo = unirModelo((modelos.get(ancla) ?? []).map((t) => t.texto))
        if (!modelo) {
          // Un precio sin modelo (un subtotal, una nota): no es un producto.
          diagnostico.lineasSinUsar += 1
          continue
        }
        diagnostico.columnaPrecio = cols[iPrecio]?.titulo ?? ''
        const descripcion = (descripciones.get(ancla) ?? []).map((t) => t.texto).join(' ').replace(/\s+/g, ' ').trim()
        filas.push(filaDesde(filas.length + 1, pagina.numero, seccion, ancla.marca, modelo, descripcion, ancla.precio, ancla.estatus, iEstatus >= 0))
        ubicaciones.push({ n: filas.length, pagina: pagina.numero, y: ancla.y - ancla.h / 2, yEncabezado: iCabecera >= 0 ? pagina.lineas[iCabecera]!.y : 0 })
      }
      // Una sección al final de la página vale para la siguiente.
      const ultimaSeccion = secciones[secciones.length - 1]
      if (ultimaSeccion && ultimaSeccion.y > anclas[anclas.length - 1]!.y) seccion = ultimaSeccion.texto
    }
  } else {
    // Sin encabezado: de cada línea, el modelo y el último precio; lo demás es la descripción.
    diagnostico.sinEncabezado = true
    for (const pagina of porPagina) {
      for (const linea of pagina.lineas) {
        const celdas = linea.celdas
        let iPrecio = -1
        for (let i = celdas.length - 1; i >= 0; i--) {
          if (parecePrecio(celdas[i]!.texto)) {
            iPrecio = i
            break
          }
        }
        const iModelo = celdas.findIndex((c, i) => i !== iPrecio && pareceModelo(c.texto))
        if (iPrecio < 0 || iModelo < 0) {
          diagnostico.lineasSinUsar += 1
          continue
        }
        const resto = celdas.filter((_, i) => i !== iPrecio && i !== iModelo).map((c) => c.texto)
        const estatusTexto = resto.find((t) => leerEstatusPdf(t) != null && !/^\d+$/.test(t)) ?? ''
        const descripcion = resto.filter((t) => t !== estatusTexto && !parecePrecio(t)).join(' ')
        filas.push(
          filaDesde(filas.length + 1, pagina.numero, '', '', celdas[iModelo]!.texto, descripcion, celdas[iPrecio]!.texto, estatusTexto, false),
        )
        ubicaciones.push({ n: filas.length, pagina: pagina.numero, y: linea.y - linea.h / 2, yEncabezado: 0 })
      }
    }
  }

  if (filas.length === 0) {
    return {
      filas: [],
      error:
        'No encontré en el PDF una tabla con modelo y precio. Si la lista viene en otro formato, súbela como CSV o mándamela para ajustar la lectura.',
      diagnostico,
      ubicaciones: [],
    }
  }
  return { filas, error: null, diagnostico, ubicaciones }
}

/** Frase corta para la pantalla: qué se leyó del PDF. */
export function resumenLecturaPdf(d: DiagnosticoPdf, renglones: number): string {
  const partes = [
    `${d.paginas} página${d.paginas === 1 ? '' : 's'}`,
    `${renglones.toLocaleString('es')} ${renglones === 1 ? 'renglón' : 'renglones'} con modelo`,
  ]
  if (d.columnaPrecio) partes.push(`precio tomado de «${d.columnaPrecio}»`)
  if (d.sinEncabezado) partes.push('sin encabezado: tomé el modelo y el último precio de cada línea')
  if (d.lineasSinUsar > 0) {
    partes.push(
      d.lineasSinUsar === 1
        ? '1 línea que no era un producto'
        : `${d.lineasSinUsar.toLocaleString('es')} líneas que no eran productos`,
    )
  }
  return partes.join(' · ')
}
