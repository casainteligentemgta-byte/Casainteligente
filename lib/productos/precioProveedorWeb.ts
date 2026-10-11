/**
 * Costo de un producto leído de la web de su proveedor: lógica pura.
 *
 * Cada producto puede guardar el enlace de su página en la tienda del proveedor
 * (`products.proveedor_url`). El servidor abre esa página y lee el precio que publica.
 *
 * Solo se admiten proveedores de esta lista, y de cada uno solo sus páginas de producto:
 * - el servidor no abre direcciones arbitrarias;
 * - se respetan las reglas del propio sitio (su `robots.txt` no permite usar el buscador
 *   con un programa, pero sí visitar las páginas de producto).
 */
import { leerPrecio, type FilaLista } from './importarListaPrecios'

export type ProveedorWeb = {
  id: string
  nombre: string
  /** Nombres de dominio que se aceptan (sin «www.»). */
  dominios: readonly string[]
  /** ¿Esta ruta es la página de un producto? */
  esProducto: (ruta: string) => boolean
  /** ¿Esta ruta es de su buscador? (para explicarle al usuario qué enlace copiar). */
  esBuscador: (ruta: string, consulta: string) => boolean
}

export const PROVEEDORES_WEB: readonly ProveedorWeb[] = [
  {
    id: 'electronica',
    nombre: 'Electrónica (electronica.com.ve)',
    dominios: ['electronica.com.ve'],
    // Tienda PrestaShop: «/categoria/123-nombre-del-producto.html».
    esProducto: (ruta) => /^\/(?:[a-z0-9_-]+\/)*\d+(?:-\d+)?-[a-z0-9_-]+\.html$/i.test(ruta),
    esBuscador: (ruta, consulta) => /^\/(?:[a-z]{2}\/)?(buscar|busqueda|search)\b/i.test(ruta) || /(^|[?&])(controller=search|s=|search_query=|q=)/i.test(consulta),
  },
]

/** Los dominios admitidos, para mostrarlos al usuario. */
export function proveedoresAdmitidos(): string {
  return PROVEEDORES_WEB.map((p) => p.dominios[0]).join(', ')
}

export type EnlaceProveedor =
  | { ok: true; url: string; proveedor: ProveedorWeb }
  | { ok: false; motivo: string }

function sinAcentos(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/**
 * Revisa el enlace que escribió el usuario y lo deja en su forma limpia (https, sin «www.»
 * de más, sin lo que va después de «?» o «#»). Dice por qué no sirve, si no sirve.
 */
export function revisarEnlaceProveedor(raw: string | null | undefined): EnlaceProveedor {
  let texto = String(raw ?? '').trim()
  if (!texto) return { ok: false, motivo: 'Falta el enlace.' }
  if (/\s/.test(texto)) return { ok: false, motivo: 'El enlace no puede llevar espacios.' }
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(texto)) texto = `https://${texto}`
  // «electrónica.com.ve» escrito con acento es el mismo sitio.
  texto = texto.replace(/^([a-z]+:\/\/)([^/?#]+)/i, (_todo, protocolo: string, sitio: string) => protocolo + sinAcentos(sitio))
  let url: URL
  try {
    url = new URL(texto)
  } catch {
    return { ok: false, motivo: 'Eso no es un enlace. Copia la dirección de la página del producto.' }
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return { ok: false, motivo: 'El enlace debe empezar por https://' }
  if (url.username || url.password || url.port) return { ok: false, motivo: 'El enlace no puede llevar usuario, clave ni puerto.' }
  const sitio = url.hostname.toLowerCase().replace(/^www\./, '')
  const proveedor = PROVEEDORES_WEB.find((p) => p.dominios.indexOf(sitio) >= 0)
  if (!proveedor) {
    return { ok: false, motivo: `Ese proveedor todavía no está configurado. Por ahora se puede leer el precio de: ${proveedoresAdmitidos()}.` }
  }
  if (proveedor.esBuscador(url.pathname, url.search)) {
    return { ok: false, motivo: 'Ese enlace es del buscador. Abre el producto y copia el enlace de su página.' }
  }
  if (!proveedor.esProducto(url.pathname)) {
    return { ok: false, motivo: 'Ese enlace no es de un producto (parece una categoría o la portada). Abre el producto y copia el enlace de su página.' }
  }
  return { ok: true, url: `https://${sitio}${url.pathname}`, proveedor }
}

export type PrecioDePagina = {
  precio: number | null
  /** Moneda tal como la declara la página («USD»); null si no la dice. */
  moneda: string | null
  titulo: string | null
}

function sinEntidades(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Las etiquetas <meta> de la página: nombre (property, name o itemprop) → contenido. */
function metasDePagina(html: string): Record<string, string> {
  const metas: Record<string, string> = {}
  const etiquetas = html.match(/<meta\b[^>]*>/gi) ?? []
  for (const etiqueta of etiquetas) {
    const atributos: Record<string, string> = {}
    const patron = /([a-zA-Z][\w:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g
    let m: RegExpExecArray | null
    while ((m = patron.exec(etiqueta)) !== null) atributos[m[1]!.toLowerCase()] = m[2] ?? m[3] ?? ''
    const clave = (atributos.property ?? atributos.name ?? atributos.itemprop ?? '').toLowerCase()
    if (clave && atributos.content != null && metas[clave] == null) metas[clave] = sinEntidades(atributos.content)
  }
  return metas
}

function numeroDePrecio(texto: string | null | undefined): number | null {
  const t = String(texto ?? '').trim()
  if (!t) return null
  const n = /^\d+(\.\d+)?$/.test(t) ? Number(t) : leerPrecio(t)
  return n != null && Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null
}

/**
 * Lee el precio que publica la página de un producto. Las tiendas en línea lo declaran en
 * etiquetas pensadas para eso (las mismas que usan Google o Facebook); no se adivina
 * buscando cifras por el texto.
 */
export function leerPrecioDePagina(html: string): PrecioDePagina {
  const metas = metasDePagina(html)
  let precio = numeroDePrecio(metas['product:price:amount'] ?? metas['og:price:amount'] ?? metas['price'])
  let moneda = metas['product:price:currency'] ?? metas['og:price:currency'] ?? metas['pricecurrency'] ?? null

  if (precio == null) {
    // Datos estructurados (schema.org) dentro de la página.
    const bloques = html.match(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi) ?? []
    for (const bloque of bloques) {
      const p = /"price"\s*:\s*"?(\d+(?:[.,]\d+)?)"?/.exec(bloque)
      if (!p) continue
      precio = numeroDePrecio(p[1])
      const c = /"priceCurrency"\s*:\s*"([A-Za-z]{3})"/.exec(bloque)
      if (c) moneda = c[1]!
      if (precio != null) break
    }
  }

  const tituloHtml = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)
  const titulo = metas['og:title'] ?? (tituloHtml ? sinEntidades(tituloHtml[1]!) : null)
  return { precio, moneda: moneda ? moneda.toUpperCase() : null, titulo: titulo || null }
}

/** El precio de la web, como si fuera un renglón de lista, para aplicar las mismas reglas. */
export function filaDesdePrecioWeb(precioUsd: number): FilaLista {
  return {
    n: 0,
    pagina: null,
    seccion: '',
    marca: '',
    codigo: '',
    modelo: '',
    descripcion: '',
    precioUsd,
    estatus: 'disponible',
    foto: '',
    nota: '',
  }
}

export type ResultadoConsulta =
  | { ok: true; url: string; precio: number; titulo: string | null }
  | { ok: false; error: string }

type RespuestaMinima = {
  status: number
  headers: { get: (nombre: string) => string | null }
  text: () => Promise<string>
}
export type FetchMinimo = (url: string, opciones: { redirect: 'manual'; headers: Record<string, string>; signal?: AbortSignal }) => Promise<RespuestaMinima>

const MAX_SALTOS = 3
/** Tope de lo que se lee de una página (las de producto pesan mucho menos). */
export const MAX_BYTES_PAGINA = 3_000_000

/**
 * Abre la página del producto en la web del proveedor y devuelve su precio en dólares.
 * Cada salto de una redirección se vuelve a revisar: nunca se sale de las páginas de
 * producto de un proveedor admitido.
 */
export async function consultarPrecioProveedor(raw: string, fetchImpl: FetchMinimo, signal?: AbortSignal): Promise<ResultadoConsulta> {
  let enlace = revisarEnlaceProveedor(raw)
  if (!enlace.ok) return { ok: false, error: enlace.motivo }

  for (let salto = 0; salto <= MAX_SALTOS; salto++) {
    let res: RespuestaMinima
    try {
      res = await fetchImpl(enlace.url, {
        redirect: 'manual',
        headers: {
          'user-agent': 'Mozilla/5.0 (compatible; CasaInteligente-Costos/1.0)',
          accept: 'text/html,application/xhtml+xml',
          'accept-language': 'es',
        },
        signal,
      })
    } catch {
      return { ok: false, error: 'No se pudo abrir la página del proveedor (no respondió a tiempo).' }
    }

    if (res.status >= 300 && res.status < 400) {
      const destino = res.headers.get('location')
      if (!destino) return { ok: false, error: 'La página del proveedor redirige a ninguna parte.' }
      let absoluto: string
      try {
        absoluto = new URL(destino, enlace.url).toString()
      } catch {
        return { ok: false, error: 'La página del proveedor redirige a una dirección que no se entiende.' }
      }
      const siguiente = revisarEnlaceProveedor(absoluto)
      if (!siguiente.ok) return { ok: false, error: 'El producto ya no está en ese enlace (el proveedor lo movió o lo quitó). Actualiza el enlace.' }
      enlace = siguiente
      continue
    }
    if (res.status === 404 || res.status === 410) return { ok: false, error: 'El proveedor ya no tiene esa página. Actualiza el enlace.' }
    if (res.status < 200 || res.status >= 300) return { ok: false, error: `La web del proveedor respondió con error (${res.status}).` }

    const html = (await res.text()).slice(0, MAX_BYTES_PAGINA)
    const leido = leerPrecioDePagina(html)
    if (leido.precio == null) return { ok: false, error: 'La página no publica el precio (o hay que entrar con usuario para verlo).' }
    if (leido.moneda && leido.moneda !== 'USD') {
      return { ok: false, error: `El precio está en ${leido.moneda}, no en dólares. No se toma.` }
    }
    return { ok: true, url: enlace.url, precio: leido.precio, titulo: leido.titulo }
  }
  return { ok: false, error: 'La página del proveedor redirige demasiadas veces.' }
}
