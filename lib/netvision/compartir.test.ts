import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { emptyProject, projectForCloud, projectFromPartial } from '@/lib/netvision/storage'
import {
  esTokenCompartir,
  huellaPlano,
  partesDataUrl,
  planoTrasBajar,
  proyectoParaCliente,
  rutaPlanoNube,
  tienePlanoAparte,
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

describe('plano del proyecto en la nube', () => {
  const chico = `data:image/png;base64,${'A'.repeat(2000)}`
  const grande = `data:image/png;base64,${'B'.repeat(500_000)}`
  const otro = `data:image/png;base64,${'C'.repeat(500_000)}`
  const base = emptyProject({ id: 'p', name: 'Casa' })

  it('la copia que sube a la nube dice si hay plano y cuál', () => {
    const sinPlano = projectForCloud({ ...base, planoUrl: null })
    assert.equal(sinPlano.planoHuella, '')
    const conChico = projectForCloud({ ...base, planoUrl: chico })
    assert.equal(conChico.planoUrl, chico)
    assert.equal(conChico.planoHuella, huellaPlano(chico))
    // El plano grande no viaja dentro, pero su huella sí.
    const conGrande = projectForCloud({ ...base, planoUrl: grande })
    assert.equal(conGrande.planoUrl, null)
    assert.equal(conGrande.planoHuella, huellaPlano(grande))
    // La huella sobrevive al guardado en la nube y a la copia del cliente.
    const deVuelta = projectFromPartial(JSON.parse(JSON.stringify(conGrande)), 'p')
    assert.equal(deVuelta.planoHuella, huellaPlano(grande))
    assert.equal(proyectoParaCliente(deVuelta).planoHuella, huellaPlano(grande))
    // Una huella vieja guardada en el equipo no engaña: se recalcula al subir.
    assert.equal(projectForCloud({ ...base, planoUrl: null, planoHuella: 'vieja' }).planoHuella, '')
  })

  it('al cliente solo se le firma el plano si el proyecto tiene uno', () => {
    // «Nuevo plano» o quitar el plano: ya no se entrega el viejo de Storage.
    assert.equal(tienePlanoAparte(projectForCloud({ ...base, planoUrl: null })), false)
    assert.equal(tienePlanoAparte(projectForCloud({ ...base, planoUrl: grande })), true)
    // Plano chico: viaja dentro del proyecto, no hace falta firmar nada.
    assert.equal(tienePlanoAparte(projectForCloud({ ...base, planoUrl: chico })), false)
    // Proyectos subidos antes de este control: se sigue intentando.
    assert.equal(tienePlanoAparte({ planoUrl: null }), true)
  })

  it('al bajar de la nube se elige el plano correcto', () => {
    const remoto = projectForCloud({ ...base, planoUrl: grande })
    assert.equal(planoTrasBajar(remoto, grande), 'local')
    assert.equal(planoTrasBajar(remoto, otro), 'bajar')
    assert.equal(planoTrasBajar(remoto, null), 'bajar')
    assert.equal(planoTrasBajar(projectForCloud({ ...base, planoUrl: chico }), otro), 'remoto')
    // La nube no tiene plano: no se le pega el de este equipo.
    assert.equal(planoTrasBajar(projectForCloud({ ...base, planoUrl: null }), otro), 'ninguno')
    // Copias antiguas sin huella: como antes.
    assert.equal(planoTrasBajar({ planoUrl: null }, otro), 'local')
    assert.equal(planoTrasBajar({ planoUrl: null }, null), 'bajar')
  })
})
