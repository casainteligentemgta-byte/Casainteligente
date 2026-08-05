import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { nacionalidadRepresentanteSegunGenero } from '@/lib/talento/nacionalidadRepresentanteSegunGenero';

describe('nacionalidadRepresentanteSegunGenero', () => {
  it('Sra. → venezolana (aunque venga venezolano)', () => {
    assert.equal(nacionalidadRepresentanteSegunGenero('venezolano', true), 'venezolana');
    assert.equal(nacionalidadRepresentanteSegunGenero('Venezolano', true), 'venezolana');
    assert.equal(nacionalidadRepresentanteSegunGenero('venezolano(a)', true), 'venezolana');
    assert.equal(nacionalidadRepresentanteSegunGenero('', true), 'venezolana');
    assert.equal(nacionalidadRepresentanteSegunGenero(null, true), 'venezolana');
  });

  it('Sr. → venezolano', () => {
    assert.equal(nacionalidadRepresentanteSegunGenero('venezolana', false), 'venezolano');
    assert.equal(nacionalidadRepresentanteSegunGenero('', false), 'venezolano');
  });

  it('extranjero / extranjera según género', () => {
    assert.equal(nacionalidadRepresentanteSegunGenero('extranjero', true), 'extranjera');
    assert.equal(nacionalidadRepresentanteSegunGenero('extranjera', false), 'extranjero');
  });
});
