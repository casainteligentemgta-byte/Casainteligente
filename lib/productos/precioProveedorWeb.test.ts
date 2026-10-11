import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  consultarPrecioProveedor,
  filaDesdePrecioWeb,
  leerPrecioDePagina,
  revisarEnlaceProveedor,
  type FetchMinimo,
} from './precioProveedorWeb'
import { efectoEnProducto, type ProductoActual } from './importarListaPrecios'

// Páginas y precios inventados.
const PRODUCTO = 'https://electronica.com.ve/cables/2-cable-de-prueba.html'

describe('el enlace del proveedor', () => {
  it('acepta la página de un producto y la deja limpia', () => {
    for (const escrito of [
      PRODUCTO,
      'electronica.com.ve/cables/2-cable-de-prueba.html',
      'http://www.electronica.com.ve/cables/2-cable-de-prueba.html?utm=1#/color-rojo',
      'https://electrónica.com.ve/cables/2-cable-de-prueba.html',
      '  https://ELECTRONICA.com.ve/cables/2-cable-de-prueba.html  ',
    ]) {
      const r = revisarEnlaceProveedor(escrito)
      assert.equal(r.ok && r.url, PRODUCTO, escrito)
    }
    const conVariante = revisarEnlaceProveedor('https://electronica.com.ve/router/2140-12-router-de-prueba-ax.html')
    assert.equal(conVariante.ok, true)
  })

  it('rechaza el buscador, las categorías y la portada, y dice qué copiar', () => {
    const motivo = (u: string) => {
      const r = revisarEnlaceProveedor(u)
      return r.ok ? 'ACEPTADO' : r.motivo
    }
    assert.match(motivo('https://electronica.com.ve/buscar?controller=search&s=router'), /buscador/)
    assert.match(motivo('https://electronica.com.ve/index.php?controller=search&search_query=router'), /buscador/)
    assert.match(motivo('https://electronica.com.ve/2140-mikrotik'), /no es de un producto/)
    assert.match(motivo('https://electronica.com.ve/'), /no es de un producto/)
    assert.match(motivo(''), /Falta/)
    assert.match(motivo('esto no es un enlace'), /espacios/)
  })

  it('no abre otros sitios, ni direcciones internas, ni con puerto o clave', () => {
    const motivo = (u: string) => {
      const r = revisarEnlaceProveedor(u)
      return r.ok ? 'ACEPTADO' : r.motivo
    }
    assert.match(motivo('https://otra-tienda.example/p/1-cosa.html'), /todavía no está configurado/)
    assert.match(motivo('https://electronica.com.ve.malo.example/c/1-cosa.html'), /todavía no está configurado/)
    assert.match(motivo('http://127.0.0.1/c/1-cosa.html'), /todavía no está configurado/)
    assert.match(motivo('http://localhost/c/1-cosa.html'), /todavía no está configurado/)
    assert.match(motivo('https://electronica.com.ve:8443/c/1-cosa.html'), /puerto/)
    assert.match(motivo('https://usuario:clave@electronica.com.ve/c/1-cosa.html'), /clave/)
    assert.match(motivo('ftp://electronica.com.ve/c/1-cosa.html'), /https/)
    assert.match(motivo('file:///etc/passwd'), /https|configurado/)
  })
})

describe('el precio que publica la página', () => {
  const pagina = (metas: string, extra = '') => `<!doctype html><html><head><title>Cable de prueba &amp; m&aacute;s</title>${metas}</head><body>${extra}</body></html>`

  it('lo lee de las etiquetas de la tienda, en cualquier orden de atributos', () => {
    const html = pagina(
      `<meta property="og:title" content="CABLE DE PRUEBA &amp; CONECTOR">
       <meta content="12.34" property="product:price:amount" />
       <meta property='product:price:currency' content='USD'>
       <meta property="product:pretax_price:amount" content="10.64">`,
    )
    assert.deepEqual(leerPrecioDePagina(html), { precio: 12.34, moneda: 'USD', titulo: 'CABLE DE PRUEBA & CONECTOR' })
  })

  it('también de los datos estructurados, y del título si no hay otro', () => {
    const html = pagina('', `<script type="application/ld+json">{"@type":"Product","offers":{"@type":"Offer","price":"7.5","priceCurrency":"usd"}}</script>`)
    const leido = leerPrecioDePagina(html)
    assert.equal(leido.precio, 7.5)
    assert.equal(leido.moneda, 'USD')
    assert.match(leido.titulo ?? '', /^Cable de prueba &/)
  })

  it('no adivina un precio por el texto de la página', () => {
    assert.equal(leerPrecioDePagina(pagina('', '<p>Oferta: $ 99,99 solo hoy</p><span>00,00 $</span>')).precio, null)
    assert.equal(leerPrecioDePagina(pagina('<meta property="product:price:amount" content="0">')).precio, null)
    assert.equal(leerPrecioDePagina('').precio, null)
  })
})

describe('consultar el precio en la web del proveedor', () => {
  const htmlCon = (precio: string, moneda = 'USD') =>
    `<html><head><meta property="og:title" content="Producto de prueba"><meta property="product:price:amount" content="${precio}"><meta property="product:price:currency" content="${moneda}"></head></html>`
  type Respuesta = { status: number; location?: string; html?: string }
  const servidor = (rutas: Record<string, Respuesta>) => {
    const pedidas: string[] = []
    const fetchFalso: FetchMinimo = async (url, opciones) => {
      pedidas.push(url)
      assert.equal(opciones.redirect, 'manual')
      const r = rutas[url]
      if (!r) throw new Error('sin red')
      return { status: r.status, headers: { get: (n) => (n.toLowerCase() === 'location' ? r.location ?? null : null) }, text: async () => r.html ?? '' }
    }
    return { fetchFalso, pedidas }
  }

  it('devuelve el precio en dólares', async () => {
    const { fetchFalso, pedidas } = servidor({ [PRODUCTO]: { status: 200, html: htmlCon('12.34') } })
    assert.deepEqual(await consultarPrecioProveedor('www.electronica.com.ve/cables/2-cable-de-prueba.html?x=1', fetchFalso), {
      ok: true,
      url: PRODUCTO,
      precio: 12.34,
      titulo: 'Producto de prueba',
    })
    assert.deepEqual(pedidas, [PRODUCTO])
  })

  it('sigue una redirección a otra página de producto, pero no a otro sitio ni a una categoría', async () => {
    const nueva = 'https://electronica.com.ve/cables/2-cable-de-prueba-v2.html'
    const bien = servidor({ [PRODUCTO]: { status: 301, location: '/cables/2-cable-de-prueba-v2.html' }, [nueva]: { status: 200, html: htmlCon('5') } })
    const r1 = await consultarPrecioProveedor(PRODUCTO, bien.fetchFalso)
    assert.deepEqual(r1, { ok: true, url: nueva, precio: 5, titulo: 'Producto de prueba' })

    const fuera = servidor({ [PRODUCTO]: { status: 302, location: 'http://169.254.169.254/latest/meta-data/' } })
    const r2 = await consultarPrecioProveedor(PRODUCTO, fuera.fetchFalso)
    assert.equal(r2.ok, false)
    assert.deepEqual(fuera.pedidas, [PRODUCTO])

    const categoria = servidor({ [PRODUCTO]: { status: 302, location: 'https://electronica.com.ve/12-cables' } })
    const r3 = await consultarPrecioProveedor(PRODUCTO, categoria.fetchFalso)
    assert.match(r3.ok ? '' : r3.error, /ya no está en ese enlace/)
    assert.deepEqual(categoria.pedidas, [PRODUCTO])
  })

  it('no pide nada si el enlace no es de un proveedor admitido', async () => {
    const { fetchFalso, pedidas } = servidor({})
    const r = await consultarPrecioProveedor('https://otra-tienda.example/p/1-cosa.html', fetchFalso)
    assert.equal(r.ok, false)
    assert.deepEqual(pedidas, [])
  })

  it('explica cada fallo: sin precio, otra moneda, página borrada, error del sitio, sin respuesta', async () => {
    const error = async (r: Respuesta | null) => {
      const { fetchFalso } = servidor(r ? { [PRODUCTO]: r } : {})
      const res = await consultarPrecioProveedor(PRODUCTO, fetchFalso)
      return res.ok ? 'OK' : res.error
    }
    assert.match(await error({ status: 200, html: '<html><head><title>x</title></head></html>' }), /no publica el precio/)
    assert.match(await error({ status: 200, html: htmlCon('100', 'VES') }), /VES/)
    assert.match(await error({ status: 404 }), /ya no tiene esa página/)
    assert.match(await error({ status: 503 }), /503/)
    assert.match(await error(null), /no respondió/)
    assert.match(await error({ status: 301 }), /ninguna parte/)
  })

  it('una cadena de redirecciones sin fin se corta', async () => {
    const a = 'https://electronica.com.ve/c/1-a.html'
    const b = 'https://electronica.com.ve/c/2-b.html'
    const { fetchFalso, pedidas } = servidor({ [a]: { status: 302, location: b }, [b]: { status: 302, location: a } })
    const r = await consultarPrecioProveedor(a, fetchFalso)
    assert.match(r.ok ? '' : r.error, /demasiadas veces/)
    assert.equal(pedidas.length, 4)
  })
})

describe('el precio de la web se aplica como el de una lista', () => {
  const producto = (costo: number | null, precio: number | null): ProductoActual => ({ id: 1, nombre: 'P', marca: null, modelo: null, categoria: null, costo, precio, imagen: null })

  it('si el precio era igual al costo, sigue al costo; si tenía ganancia propia, no se toca', () => {
    const sigue = efectoEnProducto(producto(10, 10), filaDesdePrecioWeb(12.5), { mantenerMargen: false })
    assert.deepEqual([sigue.costo, sigue.precio, sigue.cambiaCosto, sigue.cambiaPrecio], [12.5, 12.5, true, true])
    const propio = efectoEnProducto(producto(10, 15), filaDesdePrecioWeb(12), { mantenerMargen: false })
    assert.deepEqual([propio.costo, propio.precio, propio.cambiaPrecio], [12, 15, false])
    const conMargen = efectoEnProducto(producto(10, 15), filaDesdePrecioWeb(12), { mantenerMargen: true })
    assert.deepEqual([conMargen.costo, conMargen.precio], [12, 18])
    const igual = efectoEnProducto(producto(12, 12), filaDesdePrecioWeb(12), { mantenerMargen: false })
    assert.equal(igual.cambiaCosto, false)
  })
})
