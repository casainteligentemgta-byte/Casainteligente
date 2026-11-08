import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { esImagenMimeFactura, esPdfMimeFactura } from './facturaDocumentoMime';

describe('esImagenMimeFactura / esPdfMimeFactura', () => {
  it('trata image/* como imagen y application/pdf como PDF', () => {
    assert.equal(esImagenMimeFactura('image/jpeg', 'https://x/a.jpg'), true);
    assert.equal(esImagenMimeFactura('image/png', null), true);
    assert.equal(esPdfMimeFactura('application/pdf'), true);
    assert.equal(esImagenMimeFactura('application/pdf', 'https://x/a.pdf'), false);
  });

  it('si no hay mime, asume imagen cuando hay URL (lógica previa)', () => {
    assert.equal(esImagenMimeFactura(null, 'https://signed.example/doc'), true);
    assert.equal(esImagenMimeFactura(undefined, null), false);
  });
});
