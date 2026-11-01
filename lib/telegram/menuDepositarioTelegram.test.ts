import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  MENSAJE_AYUDA_TELEGRAM,
  MENSAJE_MENU_TELEGRAM,
  TELEGRAM_BOT_COMMANDS,
  TELEGRAM_BOT_COMMANDS_DEPOSITARIO,
  mensajeAyudaTelegram,
  mensajeMenuTelegram,
} from '@/lib/telegram/botCommands';

describe('menú del depositario (sin procuras)', () => {
  it('el menú nativo del depositario solo incluye factura, ingreso, salida, agua, stock y cancelar', () => {
    const nombres = TELEGRAM_BOT_COMMANDS_DEPOSITARIO.map((c) => c.command);
    assert.deepEqual(nombres, ['factura', 'ingreso', 'salida', 'agua', 'stock', 'cancelar']);
    for (const c of ['procura', 'facturas', 'nota', 'menu', 'ayuda', 'agenda', 'tecnico', 'bitacora', 'limpiar_agenda']) {
      assert.ok(!nombres.includes(c), c);
    }
  });

  it('/menu del depositario no muestra procuras; el general sí', () => {
    const dep = mensajeMenuTelegram({ depositario: true });
    assert.ok(!/procura/i.test(dep));
    assert.match(dep, /\/factura\b/);
    assert.match(dep, /\/ingreso/);
    assert.match(dep, /\/salida/);
    assert.match(dep, /\/agua/);
    assert.match(dep, /\/stock/);
    assert.ok(!/bitacora|agenda|tecnico|\/nota|\/facturas/i.test(dep));
    assert.match(mensajeMenuTelegram(), /\/procura/);
  });

  it('/ayuda del depositario no muestra procuras ni funciones de campo, consultas, agenda o técnico', () => {
    const ayuda = mensajeAyudaTelegram({ depositario: true });
    assert.ok(!/procura/i.test(ayuda));
    assert.match(ayuda, /\/stock/);
    assert.ok(!/bitacora|agenda|tecnico/i.test(ayuda));
    assert.match(mensajeAyudaTelegram(), /\/procura/);
  });

  it('los textos por defecto siguen siendo los del personal de compras', () => {
    assert.equal(MENSAJE_MENU_TELEGRAM, mensajeMenuTelegram());
    assert.equal(MENSAJE_AYUDA_TELEGRAM, mensajeAyudaTelegram());
  });
});
