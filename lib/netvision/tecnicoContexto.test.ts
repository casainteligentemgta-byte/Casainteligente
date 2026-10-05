import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { CAMERA_CATALOG } from '@/lib/netvision/catalog/cameras'
import { NETWORK_CATALOG } from '@/lib/netvision/catalog/network'
import {
  TECNICO_HISTORIAL_MAX,
  TECNICO_PREGUNTA_MAX,
  construirContextoCatalogo,
  construirPromptTecnico,
  escaparHtmlTelegram,
  lineaCamara,
  marcasDelCatalogo,
  normalizarHistorial,
  normalizarPregunta,
  partirMensajeTelegram,
  preguntaDeComandoTecnico,
} from './tecnicoContexto'

describe('técnico de dispositivos · contexto', () => {
  it('el contexto lista todas las cámaras y equipos de red del catálogo', () => {
    const ctx = construirContextoCatalogo()
    const lineas = ctx.split('\n').filter((l) => l.startsWith('- '))
    assert.equal(lineas.length, CAMERA_CATALOG.length + NETWORK_CATALOG.length)
    for (const m of CAMERA_CATALOG) assert.ok(ctx.includes(`${m.brand} ${m.name}`), m.id)
    for (const m of NETWORK_CATALOG) assert.ok(ctx.includes(m.name), m.id)
  })

  it('cubre las marcas pedidas: Ezviz, Hikvision y UniFi (Ubiquiti)', () => {
    const marcas = marcasDelCatalogo()
    for (const marca of ['Ezviz', 'Hikvision', 'Ubiquiti']) assert.ok(marcas.includes(marca), marca)
    assert.ok(!marcas.includes('Generic'))
  })

  it('la ficha de la H9c dice consumo, ángulo y adaptador PoE', () => {
    const h9c = CAMERA_CATALOG.find((m) => m.id === 'ezviz-h9c')!
    const linea = lineaCamara(h9c)
    assert.match(linea, /Ezviz H9c Dual 2K/)
    assert.match(linea, /ángulo Dual 108°\+55°/)
    assert.match(linea, /consumo 12 W/)
    assert.match(linea, /adaptador PoE \(splitter\) de 12 V/)
  })

  it('distingue PoE nativo, Wi-Fi y batería', () => {
    const linea = (id: string) => lineaCamara(CAMERA_CATALOG.find((m) => m.id === id)!)
    assert.match(linea('ezviz-h4-poe'), /conexión: cableada PoE ·/)
    assert.match(linea('ezviz-h4'), /conexión: Wi-Fi con su fuente/)
    assert.match(linea('ezviz-bc1c'), /conexión: batería/)
  })

  it('no expone precios al técnico', () => {
    const ctx = construirContextoCatalogo()
    assert.ok(!/USD|\$\s?\d/.test(ctx))
  })

  it('las instrucciones incluyen el catálogo y las reglas de respuesta', () => {
    const prompt = construirPromptTecnico('- CÁMARA DE PRUEBA')
    assert.match(prompt, /Casa Inteligente C\.A\./)
    assert.match(prompt, /Nunca inventes/)
    assert.match(prompt, /contraseña/)
    assert.ok(prompt.endsWith('- CÁMARA DE PRUEBA'))
    assert.ok(construirPromptTecnico().includes('UniFi Switch Lite 8 PoE'))
  })
})

describe('técnico de dispositivos · entrada y formato', () => {
  it('limpia y acota la pregunta', () => {
    assert.equal(normalizarPregunta('  ¿cuánto\n consume   la H9c? '), '¿cuánto consume la H9c?')
    assert.equal(normalizarPregunta('x'.repeat(5000)).length, TECNICO_PREGUNTA_MAX)
    assert.equal(normalizarPregunta(null), '')
  })

  it('el historial conserva los últimos turnos válidos y empieza por el usuario', () => {
    const crudo = [
      { role: 'assistant', text: 'respuesta suelta' },
      { role: 'user', text: 'hola' },
      { role: 'sistema', text: 'ignórame' },
      { role: 'assistant', text: '  ' },
      { role: 'assistant', text: 'respuesta' },
    ]
    assert.deepEqual(normalizarHistorial(crudo), [
      { role: 'user', text: 'hola' },
      { role: 'assistant', text: 'respuesta' },
    ])
    const largo = Array.from({ length: 30 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      text: `t${i}`,
    }))
    const h = normalizarHistorial(largo)
    assert.ok(h.length <= TECNICO_HISTORIAL_MAX)
    assert.equal(h[0]!.role, 'user')
    assert.equal(h[h.length - 1]!.text, 't29')
    assert.deepEqual(normalizarHistorial('nada'), [])
  })

  it('extrae la pregunta del comando de Telegram', () => {
    assert.equal(preguntaDeComandoTecnico('/tecnico ¿cuántos W consume la H9c?'), '¿cuántos W consume la H9c?')
    assert.equal(preguntaDeComandoTecnico('/tecnico@CasaBot   reset C6N'), 'reset C6N')
    assert.equal(preguntaDeComandoTecnico('/tecnico'), '')
  })

  it('escapa HTML para Telegram', () => {
    assert.equal(escaparHtmlTelegram('PoE <30 W> & más'), 'PoE &lt;30 W&gt; &amp; más')
  })

  it('parte respuestas largas sin pasar el límite ni perder texto', () => {
    assert.deepEqual(partirMensajeTelegram('corto'), ['corto'])
    assert.deepEqual(partirMensajeTelegram('   '), [])
    const parrafos = Array.from({ length: 40 }, (_, i) => `Paso ${i + 1}: ${'detalle '.repeat(20)}`)
    const partes = partirMensajeTelegram(parrafos.join('\n\n'), 1000)
    assert.ok(partes.length > 1)
    for (const p of partes) assert.ok(p.length <= 1000)
    const unido = partes.join(' ').replace(/\s+/g, ' ')
    assert.equal(unido, parrafos.join(' ').replace(/\s+/g, ' ').trim())
  })
})
