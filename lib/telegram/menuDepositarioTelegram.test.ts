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
  it('el menú nativo del depositario no incluye /procura y sí conserva facturas, ingreso, salida y stock', () => {
    const nombres = TELEGRAM_BOT_COMMANDS_DEPOSITARIO.map((c) => c.command);
    assert.ok(!nombres.includes('procura'));
    for (const c of ['facturas', 'ingreso', 'salida', 'stock']) assert.ok(nombres.includes(c), c);
    assert.equal(TELEGRAM_BOT_COMMANDS.length - TELEGRAM_BOT_COMMANDS_DEPOSITARIO.length, 1);
  });

  it('/menu del depositario no muestra procuras; el general sí', () => {
    const dep = mensajeMenuTelegram({ depositario: true });
    assert.ok(!/procura/i.test(dep));
    assert.match(dep, /\/facturas/);
    assert.match(dep, /\/ingreso/);
    assert.match(dep, /\/salida/);
    assert.match(dep, /\/stock/);
    assert.match(mensajeMenuTelegram(), /\/procura/);
  });

  it('/ayuda del depositario no muestra procuras; el general sí', () => {
    assert.ok(!/procura/i.test(mensajeAyudaTelegram({ depositario: true })));
    assert.match(mensajeAyudaTelegram(), /\/procura/);
  });

  it('los textos por defecto siguen siendo los del personal de compras', () => {
    assert.equal(MENSAJE_MENU_TELEGRAM, mensajeMenuTelegram());
    assert.equal(MENSAJE_AYUDA_TELEGRAM, mensajeAyudaTelegram());
  });
});
