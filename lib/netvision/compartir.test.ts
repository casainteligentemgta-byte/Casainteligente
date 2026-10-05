import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { emptyProject } from '@/lib/netvision/storage'
import {
  esTokenCompartir,
  huellaPlano,
  partesDataUrl,
  proyectoParaCliente,
  rutaPlanoNube,
  tokenDesdeBytes,
  urlCompartida,
} from './compartir'

describe('enlace para el cliente', () => {
  it('el código sale de bytes aleatorios y es apto para URL', () => {
    const bytes = new Uint8Array(32).map((_, i) => (i * 37 + 11) % 256)
    const token = tokenDesdeBytes(bytes)
    assert.equal(token.length, 32)
    assert.match(token, /^[A-Za-z0-9_-]+$/)
    assert.ok(esTokenCompartir(token))
    assert.notEqual(tokenDesdeBytes(new Uint8Array(32).fill(1)), token)
  })

  it('rechaza códigos con forma inválida', () => {
    for (const malo of ['', 'corto', 'a'.repeat(23), 'a'.repeat(129), 'con espacio '.repeat(4), "x'; drop table--".padEnd(30, 'a'), null, 42]) {
      assert.equal(esTokenCompartir(malo), false, String(malo))
    }
    assert.ok(esTokenCompartir('a'.repeat(24)))
  })

  it('arma el enlace del cliente', () => {
    const t = 'A'.repeat(32)
    assert.equal(urlCompartida('https://casainteligente.company', t), `https://casainteligente.company/nexus/vision/cliente?c=${t}`)
    assert.equal(urlCompartida('https://casainteligente.company/', t, 'cam-1'), `https://casainteligente.company/nexus/vision/cliente?c=${t}&cam=cam-1`)
  })

  it('la ruta del plano va en la carpeta del usuario', () => {
    assert.equal(rutaPlanoNube('2b0a8231-aac1', 'lx3k-ab12'), '2b0a8231-aac1/lx3k-ab12')
    // Nada de subir de carpeta ni separadores raros.
    assert.equal(rutaPlanoNube('u1', '../otro/proyecto'), 'u1/.._otro_proyecto')
    assert.equal(rutaPlanoNube('u1', 'a b/c').split('/').length, 2)
  })

  it('al cliente no le llegan datos internos del instalador', () => {
    const p = {
      ...emptyProject({ id: 'p1', name: 'Casa Pérez' }),
      client: 'Ana Pérez',
      description: 'Cliente regatea; dejar 30 % de margen',
      distributorMarginPct: 30,
      zanjaModo: 'cobrar' as const,
    }
    const c = proyectoParaCliente(p)
    assert.equal(c.name, 'Casa Pérez')
    assert.equal(c.client, 'Ana Pérez')
    assert.equal(c.description, '')
    assert.equal(c.distributorMarginPct, 0)
    assert.equal(c.zanjaModo, 'no_cobrar')
    assert.equal(c.cameras, p.cameras)
    // El original no cambia.
    assert.equal(p.distributorMarginPct, 30)
  })

  it('la huella del plano cambia si cambia el plano', () => {
    const a = `data:image/png;base64,${'A'.repeat(50_000)}`
    const b = `data:image/png;base64,${'A'.repeat(25_000)}B${'A'.repeat(24_999)}`
    assert.equal(huellaPlano(a), huellaPlano(a))
    assert.notEqual(huellaPlano(a), huellaPlano(`${a}A`))
    assert.equal(huellaPlano(null), '')
    assert.equal(huellaPlano(''), '')
    // Mismo largo, contenido distinto en una posición muestreada.
    const c = `data:image/png;base64,B${'A'.repeat(49_999)}`
    assert.notEqual(huellaPlano(a), huellaPlano(c))
    assert.equal(huellaPlano(b).split(':')[0], String(b.length))
  })

  it('separa un data URL', () => {
    assert.deepEqual(partesDataUrl('data:image/png;base64,QUJD'), { mime: 'image/png', base64: 'QUJD' })
    assert.deepEqual(partesDataUrl('data:image/jpeg;charset=x;base64,QQ=='), { mime: 'image/jpeg', base64: 'QQ==' })
    assert.equal(partesDataUrl('https://ejemplo.com/plano.png'), null)
    assert.equal(partesDataUrl('data:text/plain,hola'), null)
  })
})
