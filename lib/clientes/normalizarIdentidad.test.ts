import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  hrefTelegram,
  normalizarDocumentoVe,
  normalizarTelegramUsername,
  normalizarTelefonoVe,
} from './normalizarIdentidad';

describe('normalizarDocumentoVe', () => {
  it('deja V-12.345.678 como V12345678', () => {
    assert.equal(normalizarDocumentoVe('V-12.345.678'), 'V12345678');
    assert.equal(normalizarDocumentoVe('v 12.345.678-9'), 'V123456789');
    assert.equal(normalizarDocumentoVe('J-12345678-9'), 'J123456789');
  });

  it('sin letra se queda en dígitos', () => {
    assert.equal(normalizarDocumentoVe('12.345.678'), '12345678');
    assert.equal(normalizarDocumentoVe(''), '');
    assert.equal(normalizarDocumentoVe(null), '');
  });
});

describe('normalizarTelefonoVe', () => {
  it('unifica 0414 y +58 414', () => {
    assert.equal(normalizarTelefonoVe('0414-123 45 67'), '584141234567');
    assert.equal(normalizarTelefonoVe('+58 414 1234567'), '584141234567');
  });
});

describe('hrefTelegram', () => {
  it('usa el usuario si está', () => {
    assert.equal(hrefTelegram('@casa.ve', '04141234567'), 'https://t.me/casa.ve');
    assert.equal(normalizarTelegramUsername(' @Luis '), 'Luis');
  });

  it('sin usuario no ofrece Telegram (aunque haya teléfono)', () => {
    assert.equal(hrefTelegram('', '0414-1234567'), null);
    assert.equal(hrefTelegram(null, null), null);
  });
});
