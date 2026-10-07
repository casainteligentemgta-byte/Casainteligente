import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  cambioParaProducto,
  categoriaSugerida,
  efectoEnProducto,
  leerCsv,
  leerEstatus,
  leerListaCsv,
  leerPrecio,
  nombreDesdeDescripcion,
  normalizarModelo,
  planificarImportacion,
  precioUsable,
  productoNuevoDesdeFila,
  resumirPlan,
  type FilaLista,
  type ProductoActual,
} from './importarListaPrecios'

// Datos inventados: aquí no va ningún precio real del proveedor.
const CSV = [
  '﻿n,pagina,seccion,marca,codigo,modelo,descripcion,precio_usd,estatus,foto,nota',
  '1,1,CAMARAS IP 2MP,MARCA,MOD-PRUEBA-100,MOD-PRUEBA-100 2.8MM,"CAMARA DE PRUEBA, CON ""COMILLAS"" Y COMA",12.34,disponible,p01-01.jpg,',
  '2,1,CAMARAS IP 2MP,MARCA,MOD-PRUEBA-200,MOD-PRUEBA-200,"DOS',
  'LINEAS",,no_disponible,p01-02.jpg,',
  '3,2,SWITCH / INYECTOR POE,MARCA,MOD-PRUEBA-300,MOD-PRUEBA-300,SWITCH DE PRUEBA,"1,250.50",en_transito,,',
  '4,2,SWITCH / INYECTOR POE,MARCA,MOD-PRUEBA-400,MOD-PRUEBA-400,RELLENO,1.00,no_disponible,,no usarlo',
  '',
].join('\r\n')

const producto = (id: number, modelo: string | null, costo: number | null, precio: number | null): ProductoActual => ({
  id,
  nombre: `Producto ${id}`,
  marca: 'MARCA',
  modelo,
  categoria: 'Cámaras IP',
  costo,
  precio,
  imagen: null,
})

const fila = (n: number, modelo: string, precioUsd: number | null, estatus: FilaLista['estatus'] = 'disponible'): FilaLista => ({
  n,
  pagina: 1,
  seccion: 'CAMARAS IP 2MP',
  marca: 'MARCA',
  codigo: modelo.split(' ')[0]!,
  modelo,
  descripcion: `DESCRIPCION ${modelo}`,
  precioUsd,
  estatus,
  foto: '',
  nota: '',
})

test('leerCsv respeta comillas, comas y saltos dentro de un campo', () => {
  const t = leerCsv(CSV)
  assert.equal(t.length, 5)
  assert.equal(t[1]![6], 'CAMARA DE PRUEBA, CON "COMILLAS" Y COMA')
  assert.equal(t[2]![6], 'DOS\r\nLINEAS')
  assert.equal(t[3]![7], '1,250.50')
})

test('leerCsv acepta punto y coma como separador', () => {
  const t = leerCsv('modelo;precio_usd\nA-1;10,25\n')
  assert.deepEqual(t, [['modelo', 'precio_usd'], ['A-1', '10,25']])
})

test('leerPrecio entiende punto, coma y miles', () => {
  assert.equal(leerPrecio('10.25'), 10.25)
  assert.equal(leerPrecio('10,25'), 10.25)
  assert.equal(leerPrecio('1,825.00'), 1825)
  assert.equal(leerPrecio('1.825,00'), 1825)
  assert.equal(leerPrecio('1,825'), 1825)
  assert.equal(leerPrecio('$ 12'), 12)
  assert.equal(leerPrecio('-'), null)
  assert.equal(leerPrecio(''), null)
  assert.equal(leerPrecio('abc'), null)
})

test('leerEstatus', () => {
  assert.equal(leerEstatus('disponible'), 'disponible')
  assert.equal(leerEstatus('NO DISPONIBLE'), 'no_disponible')
  assert.equal(leerEstatus('no_disponible'), 'no_disponible')
  assert.equal(leerEstatus('En tránsito'), 'en_transito')
  assert.equal(leerEstatus('quién sabe'), null)
})

test('leerListaCsv arma las filas de la lista', () => {
  const { filas, error } = leerListaCsv(CSV)
  assert.equal(error, null)
  assert.equal(filas.length, 4)
  assert.deepEqual(
    filas.map((f) => [f.codigo, f.precioUsd, f.estatus, f.foto]),
    [
      ['MOD-PRUEBA-100', 12.34, 'disponible', 'p01-01.jpg'],
      ['MOD-PRUEBA-200', null, 'no_disponible', 'p01-02.jpg'],
      ['MOD-PRUEBA-300', 1250.5, 'en_transito', ''],
      ['MOD-PRUEBA-400', 1, 'no_disponible', ''],
    ],
  )
  assert.equal(filas[1]!.descripcion, 'DOS LINEAS')
})

test('leerListaCsv rechaza archivos que no son la lista', () => {
  assert.match(leerListaCsv('').error ?? '', /vacío/)
  assert.match(leerListaCsv('nombre,telefono\nAna,123\n').error ?? '', /modelo/)
  assert.match(leerListaCsv('modelo,descripcion\nA-1,algo\n').error ?? '', /precio/)
})

test('sin columna de estatus, lo que tiene precio se toma como disponible', () => {
  const { filas } = leerListaCsv('modelo,precio\nABCDE-1,5\nABCDE-2,\n')
  assert.equal(filas[0]!.estatus, 'disponible')
  assert.equal(filas[0]!.codigo, 'ABCDE-1')
  assert.equal(filas[1]!.estatus, null)
})

test('normalizarModelo quita guiones raros, espacios y símbolos', () => {
  assert.equal(normalizarModelo('DS-2CE76K0T-LPFS'), 'DS2CE76K0TLPFS')
  assert.equal(normalizarModelo('cs‐ty1‐c0'), 'CSTY1C0')
  assert.equal(normalizarModelo('STC--6PP48 '), 'STC6PP48')
  assert.equal(normalizarModelo(null), '')
})

test('precioUsable: solo si está disponible o en tránsito', () => {
  assert.equal(precioUsable(fila(1, 'A', 10)), 10)
  assert.equal(precioUsable(fila(1, 'A', 10, 'en_transito')), 10)
  assert.equal(precioUsable(fila(1, 'A', 1, 'no_disponible')), null)
  assert.equal(precioUsable(fila(1, 'A', null)), null)
  assert.equal(precioUsable(fila(1, 'A', 10, null)), null)
})

test('plan: cambia, igual, sin precio, dudoso y nuevos', () => {
  const lista = [
    fila(1, 'MOD-PRUEBA-100', 12.34),
    fila(2, 'MOD-PRUEBA-200', 20),
    fila(3, 'MOD-PRUEBA-300', null, 'no_disponible'),
    fila(4, 'MOD-PRUEBA-400-LUF', 40),
    fila(5, 'MOD-PRUEBA-500', 50),
    fila(6, 'MOD-PRUEBA-500', 50), // repetido igual: no molesta
  ]
  const productos = [
    producto(1, 'MOD-PRUEBA-100', 10, 20),
    producto(2, 'mod prueba 200', 20, 30),
    producto(3, 'MOD-PRUEBA-300', 30, 45),
    producto(4, 'MOD-PRUEBA-400', 35, 50),
    producto(5, null, 5, 9),
    producto(6, 'RV1', 5, 9),
    producto(7, 'OTRA-MARCA-XYZ', 5, 9),
  ]
  const plan = planificarImportacion(lista, productos)
  const tipos: Record<number, string> = {}
  plan.coincidencias.forEach((c) => (tipos[c.producto.id] = c.tipo))
  assert.deepEqual(tipos, { 1: 'cambia', 2: 'igual', 3: 'sin_precio', 4: 'dudoso' })
  const dudoso = plan.coincidencias.filter((c) => c.producto.id === 4)[0]!
  assert.equal(dudoso.elegida, null)
  assert.equal(dudoso.opciones[0]!.modelo, 'MOD-PRUEBA-400-LUF')
  // Nuevos: lo no cruzado exacto, sin repetir modelo. El dudoso sigue disponible como nuevo.
  assert.deepEqual(plan.nuevos.map((f) => f.modelo), ['MOD-PRUEBA-400-LUF', 'MOD-PRUEBA-500'])
  assert.deepEqual(resumirPlan(plan), { cambian: 1, iguales: 1, sinPrecio: 1, dudosos: 1, nuevos: 2 })
})

test('plan: el modelo completo gana al código, y precios distintos van a dudosos', () => {
  const lista = [fila(1, 'MOD-PRUEBA-700 2.8MM', 10), fila(2, 'MOD-PRUEBA-700 4MM', 12)]
  // Con el lente escrito, se sabe cuál es.
  let plan = planificarImportacion(lista, [producto(1, 'MOD-PRUEBA-700 4mm', 9, 15)])
  assert.equal(plan.coincidencias[0]!.tipo, 'cambia')
  assert.equal(plan.coincidencias[0]!.opciones[0]!.precioUsd, 12)
  assert.deepEqual(plan.nuevos.map((f) => f.modelo), ['MOD-PRUEBA-700 2.8MM'])
  // Solo con el código: dos precios posibles, que elija el dueño.
  plan = planificarImportacion(lista, [producto(1, 'MOD-PRUEBA-700', 9, 15)])
  assert.equal(plan.coincidencias[0]!.tipo, 'dudoso')
  assert.equal(plan.coincidencias[0]!.opciones.length, 2)
  assert.match(plan.coincidencias[0]!.motivo, /varias veces/)
  assert.equal(plan.nuevos.length, 0)
})

test('plan: entre repetidos nuevos se queda con el que trae precio', () => {
  const plan = planificarImportacion(
    [fila(1, 'MOD-PRUEBA-800', null, 'no_disponible'), fila(2, 'MOD-PRUEBA-800', 80)],
    [],
  )
  assert.equal(plan.nuevos.length, 1)
  assert.equal(plan.nuevos[0]!.precioUsd, 80)
})

test('efecto: cambia el costo y deja el precio de venta quieto', () => {
  const e = efectoEnProducto(producto(1, 'M', 10, 20), fila(1, 'M', 12.34), { mantenerMargen: false })
  assert.deepEqual(e, {
    costo: 12.34,
    precio: 20,
    utilidad: 7.66,
    cambiaCosto: true,
    cambiaPrecio: false,
    disponibilidad: 'disponible',
    vendeBajoCosto: false,
  })
})

test('efecto: mantener el margen sube el precio en la misma proporción', () => {
  const e = efectoEnProducto(producto(1, 'M', 10, 20), fila(1, 'M', 12.5), { mantenerMargen: true })
  assert.equal(e.precio, 25)
  assert.equal(e.utilidad, 12.5)
  assert.equal(e.cambiaPrecio, true)
  // Sin costo o sin precio previos no hay margen que mantener.
  const sin = efectoEnProducto(producto(1, 'M', null, 20), fila(1, 'M', 12.5), { mantenerMargen: true })
  assert.equal(sin.precio, 20)
  assert.equal(sin.cambiaPrecio, false)
  assert.equal(sin.cambiaCosto, true)
})

test('efecto: avisa si el costo nuevo supera el precio de venta', () => {
  const e = efectoEnProducto(producto(1, 'M', 10, 20), fila(1, 'M', 25), { mantenerMargen: false })
  assert.equal(e.vendeBajoCosto, true)
  assert.equal(e.utilidad, -5)
})

test('efecto: no disponible no toca el costo aunque traiga precio de relleno', () => {
  const e = efectoEnProducto(producto(1, 'M', 10, 20), fila(1, 'M', 1, 'no_disponible'), { mantenerMargen: true })
  assert.equal(e.costo, 10)
  assert.equal(e.precio, 20)
  assert.equal(e.cambiaCosto, false)
  assert.equal(e.disponibilidad, 'no_disponible')
})

test('cambioParaProducto escribe solo lo que cambia', () => {
  const p = producto(1, 'M', 10, 20)
  assert.deepEqual(cambioParaProducto(p, fila(1, 'M', 12.34), { mantenerMargen: false }, '2026-09-20', 'AHORA'), {
    disponibilidad_proveedor: 'disponible',
    lista_proveedor_fecha: '2026-09-20',
    modificado: 'AHORA',
    costo: 12.34,
    utilidad: 7.66,
  })
  assert.deepEqual(cambioParaProducto(p, fila(1, 'M', 10), { mantenerMargen: true }, '2026-09-20', 'AHORA'), {
    disponibilidad_proveedor: 'disponible',
    lista_proveedor_fecha: '2026-09-20',
    modificado: 'AHORA',
  })
  assert.deepEqual(
    cambioParaProducto(p, fila(1, 'M', null, 'no_disponible'), { mantenerMargen: true }, '2026-09-20', 'AHORA'),
    { disponibilidad_proveedor: 'no_disponible', lista_proveedor_fecha: '2026-09-20', modificado: 'AHORA' },
  )
  const conMargen = cambioParaProducto(p, fila(1, 'M', 15), { mantenerMargen: true }, '2026-09-20', 'AHORA')
  assert.equal(conMargen.costo, 15)
  assert.equal(conMargen.precio, 30)
  assert.equal(conMargen.utilidad, 15)
})

test('nombreDesdeDescripcion corta en un sitio decente', () => {
  assert.equal(nombreDesdeDescripcion('', 'MOD-1'), 'MOD-1')
  assert.equal(nombreDesdeDescripcion('CAMARA CORTA', 'MOD-1'), 'CAMARA CORTA')
  const largo =
    'CAMARA TIPO DOMO IP 2MP PoE INTEMPERIE IP67, IMAGEN A COLOR 24/7, ANGULO DE VISION 103 GRADOS, COMPRESION H.265+, MICROFONO'
  const n = nombreDesdeDescripcion(largo, 'MOD-1')
  assert.ok(n.length <= 90)
  assert.equal(n, 'CAMARA TIPO DOMO IP 2MP PoE INTEMPERIE IP67, IMAGEN A COLOR 24/7')
})

test('categoriaSugerida', () => {
  assert.equal(categoriaSugerida('CAMARAS IP 4MP'), 'Cámaras IP')
  assert.equal(categoriaSugerida('CAMARAS DOMO PTZ IP'), 'Cámaras IP')
  assert.equal(categoriaSugerida('CAMARAS IP COLOR VU (IMAGEN A COLOR 24/7)'), 'Cámaras IP')
  assert.equal(categoriaSugerida('UNIFI PROTECT'), 'Cámaras IP')
  assert.equal(categoriaSugerida('CAMARAS TURBO HD 1080P'), 'Cámaras Análogas')
  assert.equal(categoriaSugerida('SERIE COLORVU (IMAGEN A COLOR 24/7)'), 'Cámaras Análogas')
  assert.equal(categoriaSugerida('DVRs HIKVISION TURBO HD'), 'C.C.T.V')
  assert.equal(categoriaSugerida('NVRs HIKVISION'), 'C.C.T.V')
  assert.equal(categoriaSugerida('DISCOS DUROS'), 'C.C.T.V')
  assert.equal(categoriaSugerida('SWITCH / INYECTOR POE / REPETIDOR POE'), 'Network')
  assert.equal(categoriaSugerida('CABLES UTP / COAXIAL'), 'Network')
  assert.equal(categoriaSugerida('METALMECANICA'), 'Network')
  assert.equal(categoriaSugerida('FUENTES'), 'C.C.T.V')
})

test('productoNuevoDesdeFila', () => {
  const f = fila(1, 'MOD-PRUEBA-900 2.8MM', 33)
  assert.deepEqual(productoNuevoDesdeFila(f, '', '2026-09-20', 'AHORA'), {
    nombre: 'DESCRIPCION MOD-PRUEBA-900 2.8MM',
    modelo: 'MOD-PRUEBA-900 2.8MM',
    marca: 'MARCA',
    categoria: 'Cámaras IP',
    descripcion: 'DESCRIPCION MOD-PRUEBA-900 2.8MM',
    costo: 33,
    precio: null,
    utilidad: null,
    cantidad: 0,
    disponibilidad_proveedor: 'disponible',
    lista_proveedor_fecha: '2026-09-20',
    modificado: 'AHORA',
  })
  assert.equal(productoNuevoDesdeFila(fila(2, 'X-12345', 1, 'no_disponible'), 'Network', 'F', 'A').costo, null)
  assert.equal(productoNuevoDesdeFila(f, 'Network', 'F', 'A').categoria, 'Network')
})
