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
  it('el menú nativo del depositario solo incluye facturas, ingreso, salida, menú, ayuda y cancelar', () => {
    const nombres = TELEGRAM_BOT_COMMANDS_DEPOSITARIO.map((c) => c.command).sort();
    assert.deepEqual(nombres, ['ayuda', 'cancelar', 'facturas', 'ingreso', 'menu', 'nota', 'salida']);
    for (const c of ['procura', 'stock', 'agenda', 'tecnico', 'bitacora', 'agua', 'limpiar_agenda']) {
      assert.ok(!nombres.includes(c), c);
    }
  });

  it('/menu del depositario no muestra procuras; el general sí', () => {
    const dep = mensajeMenuTelegram({ depositario: true });
    assert.ok(!/procura/i.test(dep));
    assert.match(dep, /\/facturas/);
    assert.match(dep, /\/nota/);
    assert.match(dep, /\/ingreso/);
    assert.match(dep, /\/salida/);
    assert.ok(!/stock|bitacora|agua|agenda|tecnico|campo|consulta/i.test(dep));
    assert.match(mensajeMenuTelegram(), /\/procura/);
  });

  it('/ayuda del depositario no muestra procuras ni funciones de campo, consultas, agenda o técnico', () => {
    const ayuda = mensajeAyudaTelegram({ depositario: true });
    assert.ok(!/procura/i.test(ayuda));
    assert.match(ayuda, /\/nota/);
    assert.ok(!/stock|bitacora|agua|agenda|tecnico|campo|consulta/i.test(ayuda));
    assert.match(mensajeAyudaTelegram(), /\/procura/);
  });

  it('los textos por defecto siguen siendo los del personal de compras', () => {
    assert.equal(MENSAJE_MENU_TELEGRAM, mensajeMenuTelegram());
    assert.equal(MENSAJE_AYUDA_TELEGRAM, mensajeAyudaTelegram());
  });
});
