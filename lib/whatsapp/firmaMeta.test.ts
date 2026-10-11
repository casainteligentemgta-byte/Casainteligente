import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { firmaMetaValida } from './firmaMeta'

const SECRETO = 'secreto-de-la-app-de-prueba'
const CUERPO = JSON.stringify({ entry: [{ changes: [{ value: { messages: [{ from: '584141234567', id: 'm1', type: 'text' }] } }] }] })
const firmar = (cuerpo: string, secreto = SECRETO) =>
  'sha256=' + createHmac('sha256', secreto).update(cuerpo, 'utf8').digest('hex')

describe('firma de los avisos de WhatsApp', () => {
  it('acepta el aviso firmado con el secreto de la app', () => {
    assert.equal(firmaMetaValida(CUERPO, firmar(CUERPO), SECRETO), true)
    assert.equal(firmaMetaValida(CUERPO, firmar(CUERPO).toUpperCase().replace('SHA256=', 'sha256='), SECRETO), true)
  })

  it('rechaza si cambia una letra del aviso o el secreto es otro', () => {
    assert.equal(firmaMetaValida(CUERPO.replace('584141234567', '584149999999'), firmar(CUERPO), SECRETO), false)
    assert.equal(firmaMetaValida(CUERPO, firmar(CUERPO, 'otro-secreto'), SECRETO), false)
  })

  it('rechaza sin firma, con firma mal formada o sin secreto configurado', () => {
    assert.equal(firmaMetaValida(CUERPO, null, SECRETO), false)
    assert.equal(firmaMetaValida(CUERPO, '', SECRETO), false)
    assert.equal(firmaMetaValida(CUERPO, 'sha1=abcdef', SECRETO), false)
    assert.equal(firmaMetaValida(CUERPO, 'sha256=xyz', SECRETO), false)
    assert.equal(firmaMetaValida(CUERPO, firmar(CUERPO), ''), false)
    assert.equal(firmaMetaValida(CUERPO, firmar(CUERPO), null), false)
    // Sin secreto no vale ni la firma hecha con la cadena vacía.
    assert.equal(firmaMetaValida(CUERPO, firmar(CUERPO, ''), ''), false)
  })
})
