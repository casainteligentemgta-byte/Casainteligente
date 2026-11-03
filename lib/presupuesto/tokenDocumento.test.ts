import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  firmarDocumentoPresupuesto,
  leerDocumentoPresupuesto,
  urlDocumentoPresupuesto,
  urlPdfDocumentoPresupuesto,
} from './tokenDocumento';

const ID = '11111111-1111-4111-8111-111111111111';
const SECRETO = 'clave-de-prueba-presupuesto';

describe('token firmado del documento', () => {
  it('firma y verifica el id', () => {
    const token = firmarDocumentoPresupuesto(ID, SECRETO);
    assert.match(token, new RegExp(`^${ID}\\.[0-9a-f]{32}$`));
    assert.equal(leerDocumentoPresupuesto(token, SECRETO), ID);
  });

  it('rechaza firma o id alterados', () => {
    const token = firmarDocumentoPresupuesto(ID, SECRETO);
    assert.equal(leerDocumentoPresupuesto(token + 'x', SECRETO), null);
    assert.equal(leerDocumentoPresupuesto(token, 'otra-clave'), null);
    assert.equal(leerDocumentoPresupuesto(ID, SECRETO), null);
    assert.equal(leerDocumentoPresupuesto('', SECRETO), null);
  });

  it('arma las URLs públicas', () => {
    const t = firmarDocumentoPresupuesto(ID, SECRETO);
    assert.equal(
      urlDocumentoPresupuesto('https://casainteligente.company/', t),
      `https://casainteligente.company/presupuestos/documento?t=${encodeURIComponent(t)}`,
    );
    assert.match(urlPdfDocumentoPresupuesto('https://casainteligente.company', t), /\/api\/budgets\/documento\?t=/);
  });
});
