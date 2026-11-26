import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  TEXTO_ESPERA_SIGUIENTE,
  TEXTO_LECTURA_FALLIDA,
  textoFacturaLista,
  textoLecturaFallida,
  textoLeyendoFactura,
} from './facturaProgresoTelegram'

describe('textoLeyendoFactura', () => {
  it('pide esperar y alterna ⏳/⌛ en cada edición', () => {
    const a = textoLeyendoFactura(40, 'Extrayendo…', 0)
    const b = textoLeyendoFactura(40, 'Extrayendo…', 1)
    assert.match(a, /^⏳ <b>Leyendo factura… 40%<\/b>/)
    assert.match(b, /^⌛ <b>Leyendo factura… 40%<\/b>/)
    assert.notEqual(a, b)
    assert.ok(a.includes(TEXTO_ESPERA_SIGUIENTE))
  })

  it('acota el porcentaje y escapa la etapa', () => {
    assert.match(textoLeyendoFactura(250, '<b>', 0), /100%/)
    assert.match(textoLeyendoFactura(-5, 'a & b', 0), /0%/)
    assert.ok(textoLeyendoFactura(10, 'a & b', 0).includes('a &amp; b'))
  })
})

describe('textoFacturaLista', () => {
  it('avisa número y proveedor y que ya puede mandar la próxima', () => {
    assert.equal(
      textoFacturaLista({ invoice_number: '35412', supplier_name: 'Maderas Manzanillo' }),
      '✅ Lista la factura 35412 de Maderas Manzanillo. Ya puedes mandar la próxima',
    )
  })

  it('escapa HTML del proveedor y tolera datos faltantes', () => {
    assert.ok(
      textoFacturaLista({ invoice_number: '1', supplier_name: 'A & B <C>' }).includes(
        'A &amp; B &lt;C&gt;',
      ),
    )
    assert.equal(
      textoFacturaLista({ invoice_number: '', supplier_name: '' }),
      '✅ Lista la factura sin número. Ya puedes mandar la próxima',
    )
  })

  it('sin datos usa el cierre genérico y agrega el detalle', () => {
    assert.equal(textoFacturaLista(null), '✅ Lectura terminada. Ya puedes mandar la próxima')
    assert.match(textoFacturaLista(null, 'Use los botones.'), /\n<i>Use los botones\.<\/i>$/)
  })
})

describe('textoLecturaFallida', () => {
  it('usa el ❌ pedido y respeta avisos que ya traen su icono', () => {
    assert.equal(textoLecturaFallida(''), `${TEXTO_LECTURA_FALLIDA}.`)
    assert.equal(textoLecturaFallida('⚠️ Falta una parte. Reenvía la foto del final.'), '⚠️ Falta una parte. Reenvía la foto del final.')
    assert.equal(textoLecturaFallida(TEXTO_LECTURA_FALLIDA), TEXTO_LECTURA_FALLIDA)
    assert.match(textoLecturaFallida('detalle'), /^❌ No pude leer la foto, mándala de nuevo\.\n\ndetalle$/)
  })
})

describe('crearNotificadorProgresoFacturaTelegram (ensayo simulado)', () => {
  it('manda un solo mensaje, lo edita en cada avance y lo cierra en ✅ sin pisarlo después', async () => {
    const { enSimulacionBot } = await import('./simulacion/contexto')
    const { crearNotificadorProgresoFacturaTelegram } = await import('./facturaProgresoTelegram')
    const guardados: number[] = []
    const { envios } = await enSimulacionBot(async () => {
      const n = crearNotificadorProgresoFacturaTelegram('111', {
        onMessageId: (id) => {
          guardados.push(id)
        },
      })
      void n.reportar(10, 'a')
      void n.reportar(30, 'b')
      await n.reportar(50, 'c')
      await n.ok('Use los botones.', { invoice_number: '35412', supplier_name: 'Maderas Manzanillo' })
      await n.reportar(90, 'tarde') // una edición tardía no debe pisar el ✅
    })
    const mensajes = envios.filter((e) => e.metodo === 'sendMessage' || e.metodo === 'editMessageText')
    assert.equal(mensajes.filter((e) => e.metodo === 'sendMessage').length, 1)
    assert.equal(mensajes.length, 4) // 1 envío + 2 ediciones de avance + 1 edición final
    assert.equal(guardados.length, 1)
    assert.match(mensajes[0].texto ?? '', /Leyendo factura/)
    assert.match(mensajes[3].texto ?? '', /^✅ Lista la factura 35412 de Maderas Manzanillo\. Ya puedes mandar la próxima/)
  })

  it('con un mensaje previo (reintento) edita ese mismo y termina en ❌ si falla', async () => {
    const { enSimulacionBot } = await import('./simulacion/contexto')
    const { crearNotificadorProgresoFacturaTelegram } = await import('./facturaProgresoTelegram')
    const { envios } = await enSimulacionBot(async () => {
      const n = crearNotificadorProgresoFacturaTelegram('111', { messageId: 7465 })
      await n.reportar(10, 'a')
      await n.bad('❌ No pude leer la foto, mándala de nuevo')
    })
    const mensajes = envios.filter((e) => e.metodo === 'sendMessage' || e.metodo === 'editMessageText')
    assert.equal(mensajes.filter((e) => e.metodo === 'sendMessage').length, 0)
    assert.equal(mensajes.length, 2)
    assert.equal(mensajes[1].texto, '❌ No pude leer la foto, mándala de nuevo')
  })
})
