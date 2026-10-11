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

/** Un trozo de texto del PDF. `y` crece hacia abajo; `x`,`w`,`h` en puntos de página. */
export type TrozoPdf = { str: string; x: number; y: number; w: number; h: number }

export type PaginaPdf = { numero: number; trozos: TrozoPdf[] }

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

export type ListaPdfLeida = ListaLeida & { diagnostico: DiagnosticoPdf }

type Celda = { texto: string; x: number; fin: number; h: number }
type Linea = { y: number; h: number; celdas: Celda[] }

type Columna = 'modelo' | 'descripcion' | 'precio' | 'estatus' | 'marca' | 'otra'
type ColumnaTabla = { tipo: Columna; titulo: string; x: number; fin: number; prioridad: number }

function sinAcentos(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

/** Junta los trozos en líneas (misma altura) y, dentro de la línea, en celdas (texto pegado). */
export function lineasDePagina(trozos: readonly TrozoPdf[]): Linea[] {
  const utiles = trozos
    .filter((t) => t.str.trim() !== '')
    .map((t) => ({ ...t, h: t.h > 0 ? t.h : 8 }))
    .sort((a, b) => a.y - b.y || a.x - b.x)

  const lineas: Array<{ y: number; h: number; trozos: TrozoPdf[] }> = []
  for (const t of utiles) {
    const actual = lineas[lineas.length - 1]
    // Misma línea si el centro vertical cae a menos de media altura.
    if (actual && Math.abs(t.y + t.h / 2 - (actual.y + actual.h / 2)) <= Math.max(actual.h, t.h) * 0.5) {
      actual.trozos.push(t)
      actual.h = Math.max(actual.h, t.h)
    } else {
      lineas.push({ y: t.y, h: t.h, trozos: [t] })
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
      if (previa && hueco <= Math.max(previa.h, t.h) * 0.45) {
        previa.texto += (hueco > Math.max(previa.h, t.h) * 0.15 && !previa.texto.endsWith(' ') ? ' ' : '') + t.str
        previa.fin = Math.max(previa.fin, t.x + t.w)
        previa.h = Math.max(previa.h, t.h)
      } else {
        celdas.push({ texto: t.str, x: t.x, fin: t.x + t.w, h: t.h })
      }
    }
    return {
      y: l.y,
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
  if (/(precio|price|usd|\$|costo|cost|pvp|tarifa|valor|importe|neto|lista)/.test(t)) {
    // Lo que paga la empresa pesa más que el precio sugerido al público.
    if (/(pvp|publico|sugerido|venta|retail|msrp|final)/.test(t)) return { tipo: 'precio', prioridad: 1 }
    if (/(instalador|distribuidor|mayor|integrador|costo|cost|neto|dealer|partner)/.test(t)) return { tipo: 'precio', prioridad: 3 }
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

/** Reparte las celdas de una línea en las columnas del encabezado, por posición. */
function repartir(linea: Linea, columnas: readonly ColumnaTabla[]): string[] {
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
    }
  }

  const hayEncabezado = porPagina.some((p) => p.lineas.some((l) => encabezadoDeLinea(l)))
  const filas: FilaLista[] = []
  let columnas: ColumnaTabla[] | null = null
  let seccion = ''

  if (hayEncabezado) {
    for (const pagina of porPagina) {
      type Renglon = { fila: FilaLista; y: number; h: number; propia: boolean }
      type Suelta = { texto: string; y: number; h: number; unaCelda: boolean }
      const renglones: Renglon[] = []
      const sueltas: Suelta[] = []
      /** Títulos de sección: se aplican a los renglones que quedan debajo. */
      const secciones: Array<{ y: number; texto: string }> = []

      // Lo que está por encima del encabezado de la página es membrete (título, fecha…).
      const iCabecera = pagina.lineas.findIndex((l) => encabezadoDeLinea(l) != null)
      for (let iLinea = 0; iLinea < pagina.lineas.length; iLinea++) {
        const linea = pagina.lineas[iLinea]!
        const cab = encabezadoDeLinea(linea)
        if (cab) {
          columnas = cab
          continue
        }
        if (!columnas || iLinea < iCabecera) {
          diagnostico.lineasSinUsar += 1
          continue
        }
        const cols: ColumnaTabla[] = columnas
        const valores = repartir(linea, cols)
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
        const modelo = (valores[iModelo] ?? '').trim()
        const precioTexto = (valores[iPrecio] ?? '').trim()
        const estatusTexto = iEstatus >= 0 ? (valores[iEstatus] ?? '').trim() : ''
        const descripcion = iDescr >= 0 ? (valores[iDescr] ?? '').trim() : ''

        const tienePrecio = leerPrecio(precioTexto.replace(/usd/gi, '')) != null
        const tieneEstatus = leerEstatusPdf(estatusTexto) != null || leerEstatusPdf(precioTexto) != null
        if (modelo && (tienePrecio || tieneEstatus || /^[-–—]+$/.test(precioTexto))) {
          diagnostico.columnaPrecio = cols[iPrecio]?.titulo ?? ''
          const fila = filaDesde(
            0,
            pagina.numero,
            '',
            iMarca >= 0 ? (valores[iMarca] ?? '').trim() : '',
            modelo,
            descripcion,
            precioTexto,
            estatusTexto,
            iEstatus >= 0,
          )
          renglones.push({ fila, y: linea.y, h: linea.h, propia: descripcion !== '' })
          continue
        }

        const texto = linea.celdas.map((c) => c.texto).join(' ')
        const esPie = /^\d+$/.test(texto) || /p[aá]gina|page|\bde \d+$/i.test(texto)
        // Solo texto en la columna de descripción: sigue (o empieza) la descripción de un renglón.
        if (!modelo && !precioTexto && !estatusTexto && descripcion !== '' && !esPie) {
          sueltas.push({ texto: descripcion, y: linea.y, h: linea.h, unaCelda: linea.celdas.length === 1 })
          continue
        }
        if (linea.celdas.length === 1 && pareceTituloDeSeccion(texto)) {
          secciones.push({ y: linea.y, texto })
          continue
        }
        diagnostico.lineasSinUsar += 1
      }

      // ── Colgar las líneas sueltas de descripción de su renglón ──────────────────────
      const altoTipico = renglones.length > 0 ? renglones.map((r) => r.h).sort((a, b) => a - b)[Math.floor(renglones.length / 2)]! : 8
      /** Hasta dónde llega una línea que sigue a otra dentro de la misma celda. */
      const alcance = altoTipico * 1.9
      const antes = new Map<Renglon, string[]>()
      const despues = new Map<Renglon, string[]>()
      const colgar = (mapa: Map<Renglon, string[]>, r: Renglon, texto: string) => mapa.set(r, [...(mapa.get(r) ?? []), texto])
      const tituloOSobra = (su: Suelta) => {
        if (su.unaCelda && pareceTituloDeSeccion(su.texto)) secciones.push({ y: su.y, texto: su.texto })
        else diagnostico.lineasSinUsar += 1
      }

      // Un título con letra más grande que la de la tabla es una sección, esté donde esté.
      const lineasSueltas: Suelta[] = []
      for (const su of sueltas) {
        if (su.unaCelda && su.h > altoTipico * 1.15) tituloOSobra(su)
        else lineasSueltas.push(su)
      }

      type Pieza = { y: number; renglon?: Renglon; suelta?: Suelta }
      const piezas: Pieza[] = [
        ...renglones.map((r) => ({ y: r.y, renglon: r })),
        ...lineasSueltas.map((su) => ({ y: su.y, suelta: su })),
      ].sort((a, b) => a.y - b.y)

      // ¿Tabla con el modelo centrado en vertical (como sale de Excel)? Entonces la descripción
      // puede empezar una línea ANTES que el modelo. Se nota porque esa línea queda más cerca
      // del renglón de abajo que de lo que tiene arriba, o porque el renglón no trae descripción propia.
      let empiezanAntes = 0
      for (let i = 0; i + 1 < piezas.length; i++) {
        const p = piezas[i]!
        const sig = piezas[i + 1]!
        if (!p.suelta || !sig.renglon) continue
        const haciaAbajo = sig.y - p.y
        const haciaArriba = i > 0 ? p.y - piezas[i - 1]!.y : Infinity
        if (haciaAbajo <= altoTipico * 1.5 && haciaAbajo < haciaArriba * 0.8) empiezanAntes += 1
      }
      const sinPropia = renglones.filter((r) => !r.propia).length
      const centrada =
        renglones.length > 0 &&
        (sinPropia / renglones.length >= 0.3 || empiezanAntes >= Math.max(2, renglones.length * 0.08))

      // Se recorre tramo a tramo: las líneas sueltas que hay entre un renglón y el siguiente.
      const indicesRenglon = piezas.map((p, i) => (p.renglon ? i : -1)).filter((i) => i >= 0)
      const tramo = (desde: number, hasta: number) => piezas.slice(desde + 1, hasta).map((p) => p.suelta!)

      if (indicesRenglon.length === 0) {
        for (const p of piezas) tituloOSobra(p.suelta!)
      } else {
        // Antes del primer renglón: solo en tabla centrada pueden ser el comienzo de su descripción.
        const primero = piezas[indicesRenglon[0]!]!.renglon!
        const previas = tramo(-1, indicesRenglon[0]!)
        let tope = primero.y
        const pegadas: Suelta[] = []
        for (let k = previas.length - 1; k >= 0; k--) {
          const su = previas[k]!
          if (centrada && tope - su.y <= alcance) {
            pegadas.unshift(su)
            tope = su.y
          } else tituloOSobra(su)
        }
        for (const su of pegadas) colgar(antes, primero, su.texto)

        for (let n = 0; n < indicesRenglon.length; n++) {
          const actual = piezas[indicesRenglon[n]!]!.renglon!
          const iSiguiente = indicesRenglon[n + 1]
          const siguiente = iSiguiente !== undefined ? piezas[iSiguiente]!.renglon! : null
          const entre = tramo(indicesRenglon[n]!, iSiguiente ?? piezas.length)
          if (entre.length === 0) continue

          // En tabla centrada, el hueco más grande del tramo separa lo de arriba de lo de abajo.
          let corte = entre.length
          if (centrada && siguiente) {
            const ys = [actual.y, ...entre.map((su) => su.y), siguiente.y]
            let mayor = -1
            for (let k = 0; k + 1 < ys.length; k++) {
              const hueco = ys[k + 1]! - ys[k]!
              if (hueco >= mayor) {
                mayor = hueco
                corte = k
              }
            }
          }
          // Lo de arriba: sigue al renglón mientras cada línea quede pegada a la anterior.
          let fondo = actual.y
          let rota = false
          entre.slice(0, corte).forEach((su) => {
            if (!rota && su.y - fondo <= alcance) {
              colgar(despues, actual, su.texto)
              fondo = su.y
            } else {
              rota = true
              tituloOSobra(su)
            }
          })
          // Lo de abajo (solo tabla centrada): empieza la descripción del renglón siguiente.
          if (siguiente) {
            let techo = siguiente.y
            const suyas: Suelta[] = []
            const resto = entre.slice(corte)
            for (let k = resto.length - 1; k >= 0; k--) {
              const su = resto[k]!
              if (techo - su.y <= alcance) {
                suyas.unshift(su)
                techo = su.y
              } else tituloOSobra(su)
            }
            for (const su of suyas) colgar(antes, siguiente, su.texto)
          }
        }
      }

      secciones.sort((a, b) => a.y - b.y)
      for (const r of renglones) {
        const titulo = [...secciones].reverse().find((sec) => sec.y <= r.y)
        if (titulo) seccion = titulo.texto
        r.fila.n = filas.length + 1
        r.fila.seccion = seccion
        r.fila.descripcion = [...(antes.get(r) ?? []), r.fila.descripcion, ...(despues.get(r) ?? [])]
          .filter(Boolean)
          .join(' ')
          .trim()
        filas.push(r.fila)
      }
      // Una sección al final de la página vale para la siguiente.
      const ultimaSeccion = secciones[secciones.length - 1]
      const ultimoRenglon = renglones[renglones.length - 1]
      if (ultimaSeccion && (!ultimoRenglon || ultimaSeccion.y > ultimoRenglon.y)) seccion = ultimaSeccion.texto
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
      }
    }
  }

  if (filas.length === 0) {
    return {
      filas: [],
      error:
        'No encontré en el PDF una tabla con modelo y precio. Si la lista viene en otro formato, súbela como CSV o mándamela para ajustar la lectura.',
      diagnostico,
    }
  }
  return { filas, error: null, diagnostico }
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
