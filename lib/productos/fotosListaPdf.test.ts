import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  cajasDeImagenes,
  claveFotoPdf,
  escalaDeFoto,
  escalaParaRecortar,
  pixelesARgba,
  recortesDeFotos,
  type ImagenPdf,
  type UbicacionFila,
} from './fotosListaPdf'
import { leerListaPdf, type TrozoPdf } from './leerListaPdf'

// Geometría inventada: ninguna lista real.
const OPS = { save: 10, restore: 11, transform: 12, paintFormXObjectBegin: 74, paintFormXObjectEnd: 75, paintImageXObject: 85, paintInlineImageXObject: 86 }
/** Página de 600 × 800 puntos: en el PDF la «y» sube; en la vista, baja. */
const VISTA = [1, 0, 0, -1, 0, 800]
const redondo = (c: { x: number; y: number; w: number; h: number }) => [c.x, c.y, c.w, c.h].map((v) => Math.round(v * 10) / 10)

describe('dónde está cada imagen de la página', () => {
  it('lee el rectángulo de cada imagen con la matriz vigente y vuelve al estado anterior', () => {
    const cajas = cajasDeImagenes(
      [OPS.save, OPS.transform, OPS.paintImageXObject, OPS.restore, OPS.save, OPS.transform, OPS.paintImageXObject, OPS.restore],
      [null, [50, 0, 0, 60, 400, 500], ['img_1', 200, 240], null, null, [70, 0, 0, 40, 380, 300], ['img_2', 280, 160], null],
      OPS,
      VISTA,
    )
    // 60 de alto desde y=500 hacia arriba → en la vista, de 240 a 300.
    assert.deepEqual(cajas.map(redondo), [[400, 240, 50, 60], [380, 460, 70, 40]])
    assert.deepEqual(cajas.map((c) => c.id), ['img_1', 'img_2'])
    assert.deepEqual(cajas[0]!.matriz, [50, 0, 0, -60, 400, 300])
  })

  it('suma las transformaciones anidadas y las de un formulario', () => {
    const cajas = cajasDeImagenes(
      [OPS.transform, OPS.save, OPS.transform, OPS.paintImageXObject, OPS.restore, OPS.paintFormXObjectBegin, OPS.transform, OPS.paintImageXObject, OPS.paintFormXObjectEnd, OPS.paintImageXObject],
      [[2, 0, 0, 2, 0, 0], null, [10, 0, 0, 10, 100, 100], ['a'], null, [[1, 0, 0, 1, 50, 0], null], [20, 0, 0, 20, 0, 0], ['b'], [], ['c']],
      OPS,
      VISTA,
    )
    assert.deepEqual(cajas.map(redondo), [
      [200, 580, 20, 20], // escala 2 × (10 en 100,100)
      [100, 760, 40, 40], // dentro del formulario, desplazado 50 (×2)
      [0, 798, 2, 2], // al salir del formulario queda solo la escala 2
    ])
  })

  it('una imagen girada da el rectángulo que la encierra; la escrita en la página se guarda tal cual', () => {
    const enLinea = { width: 2, height: 2, kind: 2, data: [0] }
    const cajas = cajasDeImagenes(
      [OPS.save, OPS.transform, OPS.paintImageXObject, OPS.restore, OPS.transform, OPS.paintInlineImageXObject],
      [null, [0, 30, -30, 0, 200, 100], ['giro'], null, [10, 0, 0, 10, 0, 0], [enLinea]],
      OPS,
      VISTA,
    )
    assert.deepEqual(redondo(cajas[0]!), [170, 670, 30, 30])
    assert.equal(cajas[1]!.enLinea, enLinea)
    assert.equal(cajas[1]!.id, undefined)
  })
})

describe('a qué renglón va cada foto', () => {
  const fila = (n: number, y: number, pagina = 1): UbicacionFila => ({ n, pagina, y, yEncabezado: 120 })
  const img = (x: number, y: number, w: number, h: number, id = `i${x}-${y}`): ImagenPdf => ({ x, y, w, h, id })
  const FILAS = [fila(1, 200), fila(2, 270), fila(3, 330), fila(4, 400)]

  it('cada foto va al renglón que tiene a su altura; el membrete y los renglones sin foto quedan fuera', () => {
    const recortes = recortesDeFotos(
      [{ numero: 1, ancho: 600, alto: 800, imagenes: [img(400, 40, 120, 50, 'logo'), img(390, 170, 55, 60), img(385, 305, 60, 50), img(380, 372, 70, 55)] }],
      FILAS,
    )
    assert.deepEqual(recortes.map((r) => [r.n, r.clave, r.piezas.length]), [
      [1, 'pdf-p1-n1.jpg', 1],
      [3, 'pdf-p1-n3.jpg', 1],
      [4, 'pdf-p1-n4.jpg', 1],
    ])
    assert.deepEqual(redondo(recortes[0]!.caja), [390, 170, 55, 60])
    assert.equal(claveFotoPdf(3, 12), 'pdf-p3-n12.jpg')
  })

  it('una foto guardada en tiras de un píxel sale entera, con su etiqueta encima', () => {
    const tiras = Array.from({ length: 80 }, (_, i) => img(383, 240 + i * 0.6, 66, 0.6, `tira${i}`))
    const etiqueta = img(414, 232, 54, 31, 'nuevo')
    const recortes = recortesDeFotos([{ numero: 1, ancho: 600, alto: 800, imagenes: [...tiras, etiqueta] }], FILAS)
    assert.equal(recortes.length, 1)
    assert.equal(recortes[0]!.n, 2)
    assert.equal(recortes[0]!.piezas.length, 81)
    // En el orden en que se pintan: la etiqueta, la última.
    assert.equal(recortes[0]!.piezas[80]!.id, 'nuevo')
    assert.deepEqual(redondo(recortes[0]!.caja), [383, 232, 85, 56])
  })

  it('dos imágenes que se tocan en el mismo renglón (un kit) son una sola foto', () => {
    const recortes = recortesDeFotos([{ numero: 1, imagenes: [img(395, 234, 45, 61), img(424, 229, 53, 30)] }], FILAS)
    assert.deepEqual(recortes.map((r) => [r.n, r.piezas.length]), [[2, 2]])
    assert.deepEqual(redondo(recortes[0]!.caja), [395, 229, 82, 66])
  })

  it('dos fotos pegadas de renglones vecinos no se mezclan', () => {
    const recortes = recortesDeFotos([{ numero: 1, imagenes: [img(390, 240, 60, 61), img(390, 300, 60, 60)] }], FILAS)
    assert.deepEqual(recortes.map((r) => [r.n, r.piezas.length]), [[2, 1], [3, 1]])
  })

  it('descarta rayas, fondos de media página y lo que no está a la altura de ningún renglón', () => {
    const recortes = recortesDeFotos(
      [{ numero: 1, ancho: 600, alto: 800, imagenes: [img(20, 199, 560, 1, 'raya'), img(0, 130, 600, 600, 'fondo'), img(400, 600, 40, 40, 'lejos'), img(400, 196, 6, 6, 'icono')] }],
      FILAS,
    )
    assert.deepEqual(recortes, [])
  })

  it('cada página con sus renglones', () => {
    const recortes = recortesDeFotos(
      [
        { numero: 1, imagenes: [img(390, 170, 55, 60)] },
        { numero: 2, imagenes: [img(390, 170, 55, 60)] },
        { numero: 3, imagenes: [img(390, 170, 55, 60)] },
      ],
      [fila(1, 200, 1), fila(9, 205, 2)],
    )
    assert.deepEqual(recortes.map((r) => [r.pagina, r.n]), [[1, 1], [2, 9]])
  })
})

describe('la lista leída dice a qué altura quedó cada renglón', () => {
  const t = (str: string, x: number, y: number, h = 8): TrozoPdf => ({ str, x, y, w: str.length * h * 0.5, h })
  it('con encabezado y sin él', () => {
    const con = leerListaPdf([
      { numero: 1, trozos: [t('MODELO', 70, 50), t('DESCRIPCIÓN', 215, 50), t('PRECIO USD', 520, 50), t('MOD-PRUEBA-700', 70, 90), t('Uno', 215, 90), t('$ 12.34', 520, 90), t('MOD-PRUEBA-701', 70, 130), t('Dos', 215, 130), t('$ 5.00', 520, 130)] },
    ])
    assert.deepEqual(con.ubicaciones, [
      { n: 1, pagina: 1, y: 94, yEncabezado: 58 },
      { n: 2, pagina: 1, y: 134, yEncabezado: 58 },
    ])
    const sin = leerListaPdf([{ numero: 3, trozos: [t('MOD-PRUEBA-702', 40, 50), t('Tres', 200, 50), t('12.34', 520, 50)] }])
    assert.deepEqual(sin.ubicaciones, [{ n: 1, pagina: 3, y: 54, yEncabezado: 0 }])
    assert.deepEqual(leerListaPdf([{ numero: 1, trozos: [] }]).ubicaciones, [])
  })
})

describe('tamaño y píxeles de la foto', () => {
  it('la foto sale con la nitidez que trae en el PDF, sin pasar del tope', () => {
    assert.equal(escalaDeFoto({ x: 0, y: 0, w: 50, h: 60 }, [{ w: 50, anchoPx: 200 }]), 4)
    assert.equal(escalaDeFoto({ x: 0, y: 0, w: 50, h: 60 }, [{ w: 50, anchoPx: 20 }]), 1)
    // Una imagen enorme en una casilla chica: se limita el lado mayor a 1400 px.
    assert.equal(Math.round(escalaDeFoto({ x: 0, y: 0, w: 100, h: 200 }, [{ w: 100, anchoPx: 5000 }]) * 200), 1400)
    assert.equal(escalaParaRecortar(595, 842) > 3, true)
    assert.equal(escalaParaRecortar(5000, 5000), 1)
  })

  it('pasa RGB, RGBA y blanco y negro de un bit a RGBA', () => {
    assert.deepEqual(Array.from(pixelesARgba([1, 2, 3, 4, 5, 6], 2, 1, 2)!), [1, 2, 3, 255, 4, 5, 6, 255])
    assert.deepEqual(Array.from(pixelesARgba([1, 2, 3, 4], 1, 1, 3)!), [1, 2, 3, 4])
    // 0b10100000 → blanco, negro, blanco
    assert.deepEqual(Array.from(pixelesARgba([0b10100000], 3, 1, 1)!), [255, 255, 255, 255, 0, 0, 0, 255, 255, 255, 255, 255])
    assert.equal(pixelesARgba([1, 2, 3], 2, 1, 2), null)
    assert.equal(pixelesARgba([1, 2, 3], 1, 1, 9), null)
  })
})
