import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { verificarInitDataTelegram, VENTANA_INITDATA_SEG } from './miniAppInitData';

const TOKEN = '123456:TEST_TOKEN';
const AHORA = 1_800_000_000;

function firmar(campos: Record<string, string>, token = TOKEN): string {
  const params = new URLSearchParams(campos);
  const cadena = Array.from(params.entries())
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
  const secreto = createHmac('sha256', 'WebAppData').update(token).digest();
  const hash = createHmac('sha256', secreto).update(cadena).digest('hex');
  params.set('hash', hash);
  return params.toString();
}

const usuario = JSON.stringify({ id: 987654, first_name: 'Juan', last_name: 'Pérez' });

describe('verificarInitDataTelegram', () => {
  it('acepta una firma válida y reciente', () => {
    const init = firmar({ auth_date: String(AHORA - 60), user: usuario });
    const r = verificarInitDataTelegram(init, TOKEN, AHORA);
    assert.deepEqual(r, { ok: true, telegramId: '987654', nombre: 'Juan Pérez' });
  });

  it('rechaza si alguien cambia el usuario', () => {
    const init = firmar({ auth_date: String(AHORA - 60), user: usuario });
    const alterado = init.replace('987654', '111111');
    assert.equal(verificarInitDataTelegram(alterado, TOKEN, AHORA).ok, false);
  });

  it('rechaza una firma hecha con otro token', () => {
    const init = firmar({ auth_date: String(AHORA - 60), user: usuario }, 'otro:token');
    assert.equal(verificarInitDataTelegram(init, TOKEN, AHORA).ok, false);
  });

  it('rechaza datos vencidos', () => {
    const init = firmar({ auth_date: String(AHORA - VENTANA_INITDATA_SEG - 10), user: usuario });
    assert.equal(verificarInitDataTelegram(init, TOKEN, AHORA).ok, false);
  });

  it('rechaza sin firma o sin datos', () => {
    assert.equal(verificarInitDataTelegram('', TOKEN, AHORA).ok, false);
    assert.equal(verificarInitDataTelegram('user=%7B%7D&auth_date=1', TOKEN, AHORA).ok, false);
    assert.equal(verificarInitDataTelegram(firmar({ auth_date: String(AHORA), user: usuario }), '', AHORA).ok, false);
  });
});
