import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  AVISO_SIN_TELEFONO_WHATSAPP,
  mensajeWhatsAppPresupuesto,
  urlChatWhatsApp,
} from './whatsapp';

describe('WhatsApp de presupuesto', () => {
  it('normaliza 0414, 412 y +58 a 58XXXXXXXXXX', () => {
    const msg = 'hola';
    assert.equal(urlChatWhatsApp('0414-123 45 67', msg).ok, true);
    assert.equal((urlChatWhatsApp('0414-123 45 67', msg) as { numero: string }).numero, '584141234567');
    assert.equal((urlChatWhatsApp('4121234567', msg) as { numero: string }).numero, '584121234567');
    assert.equal((urlChatWhatsApp('+58 414 1234567', msg) as { numero: string }).numero, '584141234567');
    const url = (urlChatWhatsApp('04141234567', msg) as { url: string }).url;
    assert.match(url, /^https:\/\/wa\.me\/584141234567\?text=/);
  });

  it('sin teléfono avisa y no abre wa.me/58', () => {
    for (const t of ['', null, undefined, '123', '58']) {
      const r = urlChatWhatsApp(t, 'x');
      assert.equal(r.ok, false, String(t));
      if (!r.ok) {
        assert.equal(r.motivo, AVISO_SIN_TELEFONO_WHATSAPP);
      }
    }
    const vacio = urlChatWhatsApp('', 'presupuesto');
    assert.equal(vacio.ok, false);
    assert.doesNotMatch(JSON.stringify(vacio), /wa\.me\/58(?:\?|$)/);
  });

  it('el mensaje lleva resumen, IVA y el enlace del documento', () => {
    const m = mensajeWhatsAppPresupuesto({
      numero: 'P-501',
      cliente: 'María',
      subtotal: 1000,
      ivaPct: 16,
      urlDocumento: 'https://casainteligente.company/presupuestos/documento?t=abc',
    });
    assert.match(m, /P-501/);
    assert.match(m, /María/);
    assert.match(m, /\$1,160\.00/);
    assert.match(m, /IVA \(16%\)/);
    assert.match(m, /presupuestos\/documento\?t=abc/);
    assert.match(m, /enlace seguro/);
    assert.doesNotMatch(m, /margen|ganancia|total_cost/i);
  });
});
