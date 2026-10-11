import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  encabezadoDeLinea,
  leerEstatusPdf,
  leerListaPdf,
  lineasDePagina,
  pareceTituloDeSeccion,
  resumenLecturaPdf,
  tramosDeColumnas,
  unirModelo,
  type PaginaPdf,
  type TrozoPdf,
} from './leerListaPdf'
import { trozosDeItems } from './extraerTextoPdf'

// Datos inventados: ningún modelo ni precio real.
const ALTO = 8
const t = (str: string, x: number, y: number, h = ALTO): TrozoPdf => ({ str, x, y, w: str.length * h * 0.5, h })
/** Texto alineado a la derecha (como los precios): termina en `fin`. */
const derecha = (str: string, fin: number, y: number): TrozoPdf => ({ str, x: fin - str.length * 4, y, w: str.length * 4, h: ALTO })

const CABECERA = (y: number) => [t('N°', 40, y), t('MODELO', 70, y), t('DESCRIPCIÓN', 215, y), t('ESTATUS', 455, y), t('PRECIO USD', 520, y)]

function pagina(numero: number, trozos: TrozoPdf[]): PaginaPdf {
  return { numero, trozos }
}

describe('líneas y celdas del PDF', () => {
  it('junta lo que está a la misma altura y separa las columnas', () => {
    const lineas = lineasDePagina([t('12.50', 540, 100), t('MOD-PRUEBA-100', 70, 100.6), t('Cámara de', 215, 100), t('prueba', 253, 100), t('otra línea', 70, 130)])
    assert.equal(lineas.length, 2)
    assert.deepEqual(lineas[0]!.celdas.map((c) => c.texto), ['MOD-PRUEBA-100', 'Cámara de prueba', '12.50'])
    assert.deepEqual(lineas[1]!.celdas.map((c) => c.texto), ['otra línea'])
  })

  it('reconoce el encabezado de la tabla y no una frase con la palabra precio', () => {
    const [cab] = lineasDePagina(CABECERA(50))
    assert.deepEqual(encabezadoDeLinea(cab!)?.map((c) => c.tipo), ['otra', 'modelo', 'descripcion', 'estatus', 'precio'])
    const [frase] = lineasDePagina([t('Modelo', 40, 10), t('Los precios pueden cambiar sin previo aviso según disponibilidad', 120, 10)])
    assert.equal(encabezadoDeLinea(frase!), null)
  })

  it('pasa los items de pdf.js a posiciones con la «y» hacia abajo', () => {
    const trozos = trozosDeItems(
      [{ str: 'MOD-PRUEBA-100', transform: [8, 0, 0, 8, 70, 700], width: 60, height: 8 }, { str: '  ', transform: [8, 0, 0, 8, 0, 0] }, { str: 'sin alto', transform: [9, 0, 0, 9, 10, 500], width: 30 }],
      792,
    )
    assert.deepEqual(trozos, [
      { str: 'MOD-PRUEBA-100', x: 70, y: 84, w: 60, h: 8 },
      { str: 'sin alto', x: 10, y: 283, w: 30, h: 9 },
    ])
  })
})

describe('lista con encabezado, alineada arriba', () => {
  const trozos = [
    t('LISTA DE PRECIOS DE PRUEBA', 40, 20, 12),
    ...CABECERA(50),
    t('SECCIÓN UNO', 40, 70, 10.5),
    t('1', 40, 90), t('MOD-PRUEBA-100', 70, 90), t('Cámara de prueba con una descripción', 215, 90), t('Disponible', 455, 90), derecha('$ 12.34', 575, 90),
    t('que sigue en la línea de abajo', 215, 100),
    t('y en una tercera línea.', 215, 110),
    t('2', 40, 126), t('MOD-PRUEBA-101(2.8mm)', 70, 126), t('Otro producto', 215, 126), t('Agotado', 455, 126), derecha('-', 575, 126),
    t('3', 40, 142), t('MOD-PRUEBA-102', 70, 142), t('Tercer producto', 215, 142), t('En tránsito', 455, 142), derecha('$ 1,825.00', 575, 142),
    t('SECCIÓN DOS', 40, 164, 10.5),
    t('4', 40, 184), t('MOD-PRUEBA-103', 70, 184), t('Cuarto producto', 215, 184), t('Disponible', 455, 184), derecha('$ 7.00', 575, 184),
    t('Página 1', 280, 760, 7),
  ]
  const leida = leerListaPdf([pagina(1, trozos)])

  it('lee cada renglón con su modelo, precio y estatus', () => {
    assert.equal(leida.error, null)
    assert.deepEqual(
      leida.filas.map((f) => [f.n, f.modelo, f.precioUsd, f.estatus]),
      [
        [1, 'MOD-PRUEBA-100', 12.34, 'disponible'],
        [2, 'MOD-PRUEBA-101(2.8mm)', null, 'no_disponible'],
        [3, 'MOD-PRUEBA-102', 1825, 'en_transito'],
        [4, 'MOD-PRUEBA-103', 7, 'disponible'],
      ],
    )
  })

  it('pega al renglón las líneas de descripción que siguen debajo', () => {
    assert.equal(leida.filas[0]!.descripcion, 'Cámara de prueba con una descripción que sigue en la línea de abajo y en una tercera línea.')
    assert.equal(leida.filas[1]!.descripcion, 'Otro producto')
  })

  it('toma los títulos como sección y deja fuera membrete y pie de página', () => {
    assert.deepEqual(leida.filas.map((f) => f.seccion), ['SECCIÓN UNO', 'SECCIÓN UNO', 'SECCIÓN UNO', 'SECCIÓN DOS'])
    assert.equal(leida.diagnostico.columnaPrecio, 'PRECIO USD')
    assert.equal(leida.diagnostico.sinEncabezado, false)
    assert.equal(leida.diagnostico.lineasSinUsar, 2)
    assert.equal(leida.filas[0]!.pagina, 1)
    assert.equal(leida.filas[0]!.codigo, 'MOD-PRUEBA-100')
  })

  it('en la página siguiente sigue la misma tabla y la misma sección', () => {
    const p2 = pagina(2, [t('LISTA DE PRECIOS DE PRUEBA', 40, 20, 12), ...CABECERA(50), t('5', 40, 70), t('MOD-PRUEBA-104', 70, 70), t('Quinto', 215, 70), t('Disponible', 455, 70), derecha('$ 3.00', 575, 70)])
    const dos = leerListaPdf([pagina(1, trozos), p2])
    assert.equal(dos.filas.length, 5)
    assert.deepEqual([dos.filas[4]!.n, dos.filas[4]!.pagina, dos.filas[4]!.seccion], [5, 2, 'SECCIÓN DOS'])
  })
})

describe('lista como sale de Excel: modelo centrado y dos columnas de precio', () => {
  const cab = (y: number) => [t('CÓDIGO', 60, y, 9), t('DESCRIPCIÓN DEL PRODUCTO', 300, y, 9), t('PVP SUGERIDO', 610, y, 9), t('PRECIO INSTALADOR', 710, y, 9)]
  const precio = (str: string, fin: number, y: number): TrozoPdf => ({ str, x: fin - str.length * 4.5, y, w: str.length * 4.5, h: 9 })
  const trozos = [
    ...cab(40),
    // Renglón de dos líneas: el código queda a media altura, sin descripción en su línea.
    t('Primera línea del producto uno', 215, 62, 9),
    t('MOD-PRUEBA-200', 40, 67.5, 9), precio('160.00', 680, 67.5), precio('100.00', 800, 67.5),
    t('y su segunda línea', 215, 73, 9),
    // Renglón de tres líneas: el código comparte la línea del medio.
    t('Producto dos, primera', 215, 93, 9),
    t('MOD-PRUEBA-201', 40, 104, 9), t('segunda', 215, 104, 9), precio('32.00', 680, 104), precio('20.00', 800, 104),
    t('y tercera', 215, 115, 9),
    // Renglón de una sola línea.
    t('MOD-PRUEBA-202', 40, 135, 9), t('Producto tres', 215, 135, 9), precio('8.00', 680, 135), precio('5.00', 800, 135),
    t('Producto cuatro, arriba', 215, 155, 9),
    t('MOD-PRUEBA-203', 40, 160.5, 9), precio('16.00', 680, 160.5), precio('10.00', 800, 160.5),
    t('y abajo', 215, 166, 9),
  ]
  const leida = leerListaPdf([pagina(1, trozos)])

  it('usa el precio del instalador, no el sugerido al público', () => {
    assert.equal(leida.diagnostico.columnaPrecio, 'PRECIO INSTALADOR')
    assert.deepEqual(leida.filas.map((f) => f.precioUsd), [100, 20, 5, 10])
    assert.deepEqual(leida.filas.map((f) => f.estatus), ['disponible', 'disponible', 'disponible', 'disponible'])
  })

  it('arma cada descripción con la línea de arriba y la de abajo de su renglón', () => {
    assert.deepEqual(
      leida.filas.map((f) => [f.modelo, f.descripcion]),
      [
        ['MOD-PRUEBA-200', 'Primera línea del producto uno y su segunda línea'],
        ['MOD-PRUEBA-201', 'Producto dos, primera segunda y tercera'],
        ['MOD-PRUEBA-202', 'Producto tres'],
        ['MOD-PRUEBA-203', 'Producto cuatro, arriba y abajo'],
      ],
    )
    assert.equal(leida.diagnostico.lineasSinUsar, 0)
  })
})

describe('hoja de Excel impresa: títulos centrados, textos largos y filas numeradas', () => {
  // Como la imprime Excel: letras de columna arriba, número de fila a la izquierda, el
  // título «DESCRIPCION» centrado sobre un texto que empieza mucho más a la izquierda, el
  // precio bajo un título que solo dice «INSTALADOR» y el modelo a media altura de su fila.
  const P = 6 // alto de la letra de la tabla
  const d = (str: string, y: number): TrozoPdf => ({ str, x: 147, y, w: 225, h: P })
  const m = (str: string, y: number): TrozoPdf => ({ str, x: 71, y, w: str.length * 3.2, h: P })
  const marca = (y: number): TrozoPdf => ({ str: 'MARCAX', x: 45, y, w: 17, h: P })
  const pr = (str: string, y: number): TrozoPdf => ({ str, x: 497, y, w: 15, h: P })
  const est = (str: string, y: number): TrozoPdf => ({ str, x: 523, y, w: str.length * 3.4, h: P })
  const fila = (n: number, y: number): TrozoPdf => ({ str: String(n), x: 26, y, w: 5, h: 8.8 })
  const trozos: TrozoPdf[] = [
    ...['A', 'B', 'C', 'D', 'I', 'J'].map((l, i) => ({ str: l, x: [51, 106, 260, 418, 489, 540][i]!, y: 93, w: 5, h: 8.8 })),
    { str: 'MARCA', x: 41, y: 118, w: 21, h: 7 }, { str: 'MODELO', x: 92, y: 118, w: 27, h: 7 }, { str: 'DESCRIPCION', x: 236, y: 118, w: 48, h: 7 },
    { str: 'IMAGEN', x: 407, y: 118, w: 27, h: 7 }, { str: 'INSTALADOR', x: 467, y: 118, w: 45, h: 7 }, { str: 'ESTATUS', x: 525, y: 118, w: 30, h: 7 },
    fila(1, 127),
    // Rótulo grande de la marca, en su propia fila.
    fila(2, 149), { str: 'MARCAX', x: 276, y: 141, w: 49, h: 17 },
    // Fila 3: cinco líneas de descripción; modelo, precio y estatus en la del medio.
    d('CAMARA DE PRUEBA UNO PARA INTERIOR,', 169), d('SEGUNDA LINEA DE LA UNO', 177),
    marca(193), m('MOD-PRUEBA-400', 193), d('TERCERA LINEA DE LA UNO', 185 + 8), pr('12,34', 193), est('DISPONIBLE', 193),
    d('CUARTA LINEA DE LA UNO', 201), d('MOVIMIENTO', 209),
    fila(3, 219),
    // Fila 4: el modelo no cabe y va partido en dos líneas, entre las de la descripción.
    d('CAMARA DE PRUEBA DOS PARA EXTERIOR,', 240), d('SEGUNDA LINEA DE LA DOS', 248),
    m('MOD-PRUEBA-401-', 252), marca(256), d('TERCERA LINEA DE LA DOS', 256), pr('1.234,50', 256), est('TRANSITO', 256), m('WKFL(4mm)', 260),
    d('CUARTA LINEA DE LA DOS', 264),
    fila(4, 272),
    // Fila 5: el modelo es tan largo que llega a tocar la descripción; estatus en dos líneas.
    d('KIT DE PRUEBA TRES CON BATERIA,', 290),
    est('NO', 294),
    marca(298), { str: 'MOD-PRUEBA-402(2K 4GA)-LARGO', x: 71, y: 298, w: 75.5, h: P }, d('SEGUNDA LINEA DE LA TRES', 298), pr('99,00', 298),
    est('DISPONIBLE', 302),
    d('TERCERA LINEA DE LA TRES', 306),
    fila(5, 314),
    // Fila 6: en tránsito y todavía sin precio.
    d('PRODUCTO DE PRUEBA CUATRO', 330), marca(334), m('MOD-PRUEBA-403', 334), est('TRANSITO', 334), d('QUE VIENE EN CAMINO', 338),
    fila(6, 346),
    // Filas 7 y 8: el texto de la 7 no cabe y la 8 empieza pegada a ella (el paso entre líneas se rompe).
    d('PRODUCTO DE PRUEBA CINCO, LINEA UNO', 360), d('LINEA DOS DE LA CINCO', 368),
    marca(376), m('MOD-PRUEBA-404', 376), d('LINEA TRES DE LA CINCO', 376), pr('5,00', 376), est('DISPONIBLE', 376),
    d('LINEA CUATRO DE LA CINCO', 384), d('LINEA CINCO DE LA CINCO', 392),
    fila(7, 394),
    d('SEIS', 397), d('PRODUCTO DE PRUEBA, LINEA DOS', 405),
    marca(413), m('MOD-PRUEBA-405', 413), d('LINEA TRES DE LA SEIS', 413), pr('6,00', 413), est('DISPONIBLE', 413),
    d('LINEA CUATRO DE LA SEIS', 421),
    fila(8, 430),
  ].map((tz) => ({ ...tz, y: tz.y - tz.h })) // arriba se escribió la línea base (el pie de la letra)
  const leida = leerListaPdf([pagina(1, trozos)])

  it('toma el precio de la columna «INSTALADOR» y lee cada fila con su modelo completo', () => {
    assert.equal(leida.error, null)
    assert.equal(leida.diagnostico.sinEncabezado, false)
    assert.equal(leida.diagnostico.columnaPrecio, 'INSTALADOR')
    assert.deepEqual(
      leida.filas.map((f) => [f.modelo, f.precioUsd, f.estatus]),
      [
        ['MOD-PRUEBA-400', 12.34, 'disponible'],
        ['MOD-PRUEBA-401-WKFL(4mm)', 1234.5, 'en_transito'],
        ['MOD-PRUEBA-402(2K 4GA)-LARGO', 99, 'no_disponible'],
        ['MOD-PRUEBA-403', null, 'en_transito'],
        ['MOD-PRUEBA-404', 5, 'disponible'],
        ['MOD-PRUEBA-405', 6, 'disponible'],
      ],
    )
  })

  it('el principio de la descripción no se va a la columna del modelo', () => {
    assert.deepEqual(
      leida.filas.map((f) => f.descripcion),
      [
        'CAMARA DE PRUEBA UNO PARA INTERIOR, SEGUNDA LINEA DE LA UNO TERCERA LINEA DE LA UNO CUARTA LINEA DE LA UNO MOVIMIENTO',
        'CAMARA DE PRUEBA DOS PARA EXTERIOR, SEGUNDA LINEA DE LA DOS TERCERA LINEA DE LA DOS CUARTA LINEA DE LA DOS',
        'KIT DE PRUEBA TRES CON BATERIA, SEGUNDA LINEA DE LA TRES TERCERA LINEA DE LA TRES',
        'PRODUCTO DE PRUEBA CUATRO QUE VIENE EN CAMINO',
        'PRODUCTO DE PRUEBA CINCO, LINEA UNO LINEA DOS DE LA CINCO LINEA TRES DE LA CINCO LINEA CUATRO DE LA CINCO LINEA CINCO DE LA CINCO',
        'SEIS PRODUCTO DE PRUEBA, LINEA DOS LINEA TRES DE LA SEIS LINEA CUATRO DE LA SEIS',
      ],
    )
  })

  it('el rótulo grande es la sección; los números de fila de Excel no entran', () => {
    assert.deepEqual(Array.from(new Set(leida.filas.map((f) => f.seccion))), ['MARCAX'])
    assert.deepEqual(Array.from(new Set(leida.filas.map((f) => f.marca))), ['MARCAX'])
    assert.ok(leida.filas.every((f) => !/^\d+ /.test(f.descripcion) && !/ \d$/.test(f.descripcion)))
  })

  it('el rótulo que Excel repite en cada hoja no se mete en la descripción que pisa', () => {
    const hoja2 = trozos.map((tz) =>
      tz.str === 'MARCAX' && tz.h === 17 ? { ...tz, y: 169 - 17 } : tz.str === '2' && tz.x === 26 ? { ...tz, str: '' } : tz,
    )
    const dos = leerListaPdf([pagina(1, hoja2)])
    assert.equal(dos.filas[0]!.descripcion, leida.filas[0]!.descripcion)
    assert.equal(dos.filas[0]!.seccion, 'MARCAX')
  })
})

describe('piezas de la hoja de Excel', () => {
  it('une el modelo partido en varias líneas', () => {
    assert.equal(unirModelo(['MOD-PRUEBA-401-', 'WKFL(4mm)(US-', 'STD)(Mu)']), 'MOD-PRUEBA-401-WKFL(4mm)(US-STD)(Mu)')
    assert.equal(unirModelo(['MOD-PRUEBA-500', '2.8MM']), 'MOD-PRUEBA-500 2.8MM')
    assert.equal(unirModelo(['MOD-PRUEBA(3MP', 'Type-C)']), 'MOD-PRUEBA(3MP Type-C)')
  })

  it('mide las columnas sobre los datos y aparta los números de fila', () => {
    const lineas = lineasDePagina([
      { str: '7', x: 26, y: 100, w: 5, h: 8 }, { str: 'MOD-PRUEBA-600', x: 71, y: 100, w: 50, h: 6 }, { str: 'Texto que empieza a la izquierda', x: 147, y: 100, w: 200, h: 6 },
      { str: '8', x: 26, y: 120, w: 5, h: 8 }, { str: 'MOD-PRUEBA-601', x: 71, y: 120, w: 50, h: 6 }, { str: 'Otro texto igual de largo que el de arriba', x: 147, y: 120, w: 200, h: 6 },
      { str: '9', x: 26, y: 140, w: 5, h: 8 }, { str: 'MOD-PRUEBA-602', x: 71, y: 140, w: 50, h: 6 }, { str: 'Corto', x: 147, y: 140, w: 22, h: 6 },
    ])
    const { tramos, fuera } = tramosDeColumnas(lineas, [{ x: 92, fin: 119 }, { x: 236, fin: 284 }])
    assert.deepEqual(tramos, [{ x: 71, fin: 121 }, { x: 147, fin: 347 }])
    assert.deepEqual(fuera, [{ x: 26, fin: 31 }])
  })

  it('«instalador», «distribuidor» o «mayorista» anuncian la columna del precio', () => {
    for (const titulo of ['INSTALADOR', 'Distribuidor', 'MAYORISTA', 'Integrador']) {
      const [cab] = lineasDePagina([t('MODELO', 40, 10), t('DESCRIPCION', 150, 10), t(titulo, 400, 10)])
      assert.deepEqual(encabezadoDeLinea(cab!)?.map((c) => c.tipo), ['modelo', 'descripcion', 'precio'], titulo)
    }
  })
})

describe('lista sin encabezado', () => {
  const leida = leerListaPdf([
    pagina(1, [
      t('Precios vigentes', 40, 20, 14),
      t('MOD-PRUEBA-300', 40, 50), t('Producto sin encabezado', 200, 50), derecha('12.34', 570, 50),
      t('MOD-PRUEBA-301', 40, 62), t('Otro más', 200, 62), t('Agotado', 400, 62), derecha('$ 99', 570, 62),
      t('Nota: precios sujetos a cambio', 40, 90),
    ]),
  ])

  it('toma el modelo y el último precio de cada línea, y lo avisa', () => {
    assert.equal(leida.diagnostico.sinEncabezado, true)
    assert.deepEqual(
      leida.filas.map((f) => [f.modelo, f.descripcion, f.precioUsd, f.estatus]),
      [
        ['MOD-PRUEBA-300', 'Producto sin encabezado', 12.34, 'disponible'],
        ['MOD-PRUEBA-301', 'Otro más', 99, 'no_disponible'],
      ],
    )
    assert.equal(leida.diagnostico.lineasSinUsar, 2)
  })
})

describe('PDF que no se puede leer', () => {
  it('un escaneo (sin texto) se dice claro', () => {
    const leida = leerListaPdf([pagina(1, []), pagina(2, [])])
    assert.equal(leida.diagnostico.esImagen, true)
    assert.match(leida.error ?? '', /foto o un escaneo/)
    assert.deepEqual(leida.filas, [])
  })

  it('texto sin tabla de modelos y precios', () => {
    const leida = leerListaPdf([pagina(1, [t('Estimado cliente:', 40, 40), t('Le enviamos nuestro catálogo.', 40, 60)])])
    assert.equal(leida.diagnostico.esImagen, false)
    assert.match(leida.error ?? '', /No encontré en el PDF una tabla/)
  })
})

describe('piezas sueltas', () => {
  it('estatus escritos de varias formas', () => {
    assert.equal(leerEstatusPdf('DISPONIBLE'), 'disponible')
    assert.equal(leerEstatusPdf('En stock'), 'disponible')
    assert.equal(leerEstatusPdf('25'), 'disponible')
    assert.equal(leerEstatusPdf('0'), 'no_disponible')
    assert.equal(leerEstatusPdf('NO DISPONIBLE'), 'no_disponible')
    assert.equal(leerEstatusPdf('Agotado'), 'no_disponible')
    assert.equal(leerEstatusPdf('Sin stock'), 'no_disponible')
    assert.equal(leerEstatusPdf('En tránsito'), 'en_transito')
    assert.equal(leerEstatusPdf('Próximamente'), 'en_transito')
    assert.equal(leerEstatusPdf(''), null)
    assert.equal(leerEstatusPdf('Cámara domo'), null)
  })

  it('un título de sección no es el final suelto de una descripción', () => {
    assert.equal(pareceTituloDeSeccion('CÁMARAS IP'), true)
    assert.equal(pareceTituloDeSeccion('Cableado estructurado'), true)
    assert.equal(pareceTituloDeSeccion('sirena y luz, H.265.'), false)
    assert.equal(pareceTituloDeSeccion('unidades'), false)
    assert.equal(pareceTituloDeSeccion('Página 3 de 12'), false)
    assert.equal(pareceTituloDeSeccion('12'), false)
  })

  it('resumen de lo leído', () => {
    assert.equal(
      resumenLecturaPdf({ paginas: 3, columnaPrecio: 'PRECIO USD', sinEncabezado: false, lineasSinUsar: 5, esImagen: false }, 60),
      '3 páginas · 60 renglones con modelo · precio tomado de «PRECIO USD» · 5 líneas que no eran productos',
    )
    assert.equal(
      resumenLecturaPdf({ paginas: 1, columnaPrecio: '', sinEncabezado: true, lineasSinUsar: 1, esImagen: false }, 1),
      '1 página · 1 renglón con modelo · sin encabezado: tomé el modelo y el último precio de cada línea · 1 línea que no era un producto',
    )
  })
})
